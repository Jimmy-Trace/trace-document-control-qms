import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import net from "node:net";
import { Prisma } from "@prisma/client";
import { db } from "../db";
import { IntegrationClientError } from "./integration-clients";
import { approvedWebhookEvents, deriveWebhookSigningSecret, validateWebhookEndpoint, type IntegrationWebhookEvent } from "./webhook-subscriptions";

const MAX_PAYLOAD_BYTES = 64 * 1024;
const MAX_ATTEMPTS = 5;
const DELIVERY_TIMEOUT_MS = 5_000;
const RETRY_SECONDS = [60, 300, 1_800, 7_200] as const;
const OUTBOX_RETRY_SECONDS = [30, 60, 300, 900, 3_600] as const;

export type WebhookEventEnvelope = {
  id: string;
  type: IntegrationWebhookEvent;
  createdAt: string;
  data: unknown;
};

type DeliveryRow = {
  id: string;
  organizationId: string;
  integrationClientId: string;
  subscriptionId: string;
  eventId: string;
  eventName: IntegrationWebhookEvent;
  payload: unknown;
  attemptCount: number;
  endpointUrl: string;
  signingKeyVersion: number;
  subscriptionStatus: "REGISTERED" | "REVOKED";
  clientStatus: "ACTIVE" | "REVOKED";
};

type OutboxRow = {
  id: string;
  organizationId: string;
  eventId: string;
  eventName: IntegrationWebhookEvent;
  data: unknown;
  occurredAt: Date;
  attemptCount: number;
};

function payloadText(payload: unknown) {
  let serialized: string;
  try { serialized = JSON.stringify(payload); } catch { throw new IntegrationClientError("Webhook payload must be JSON serializable"); }
  if (!serialized || Buffer.byteLength(serialized, "utf8") > MAX_PAYLOAD_BYTES) throw new IntegrationClientError("Webhook payload exceeds 64 KiB");
  return serialized;
}

function isPrivateIpv4(address: string) {
  const p = address.split(".").map(Number);
  const [a,b] = p;
  return p.length === 4 && (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168));
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
}

export async function assertWebhookDestinationSafe(endpointUrl: string) {
  const normalized = validateWebhookEndpoint(endpointUrl);
  const url = new URL(normalized);
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length) throw new IntegrationClientError("Webhook endpoint DNS resolution returned no addresses");
  if (addresses.some(({ address }) => (net.isIP(address) === 4 ? isPrivateIpv4(address) : isPrivateIpv6(address)))) {
    throw new IntegrationClientError("Webhook endpoint resolved to a non-public address");
  }
  return normalized;
}

export function signWebhookBody(body: string, signingSecret: string) {
  return `v1=${createHmac("sha256", signingSecret).update(body).digest("hex")}`;
}

export function verifyWebhookSignature(body: string, signature: string, signingSecret: string) {
  const expected = Buffer.from(signWebhookBody(body, signingSecret));
  const supplied = Buffer.from(signature);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export async function queueWebhookEvent(input: { organizationId: string; eventId: string; eventName: IntegrationWebhookEvent; data: unknown; occurredAt?: Date }) {
  if (!approvedWebhookEvents.includes(input.eventName)) throw new IntegrationClientError("Unsupported webhook event");
  const eventId = input.eventId.trim();
  if (!eventId || eventId.length > 200) throw new IntegrationClientError("Webhook event ID must contain 1 to 200 characters");
  const occurredAt = input.occurredAt ?? new Date();
  const envelope: WebhookEventEnvelope = { id: eventId, type: input.eventName, createdAt: occurredAt.toISOString(), data: input.data };
  const body = payloadText(envelope);
  const payloadHash = createHash("sha256").update(body).digest("hex");
  return db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO "IntegrationWebhookDelivery" ("organizationId","integrationClientId","subscriptionId","eventId","eventName",payload,"payloadHash")
    SELECT s."organizationId",s."integrationClientId",s.id,${eventId},${input.eventName},${body}::jsonb,${payloadHash}
    FROM "IntegrationWebhookSubscription" s
    JOIN "IntegrationClient" c ON c.id=s."integrationClientId" AND c."organizationId"=s."organizationId"
    WHERE s."organizationId"=${input.organizationId}::uuid
      AND s.status='REGISTERED'
      AND c.status='ACTIVE'
      AND s.events @> ARRAY[${input.eventName}]::text[]
      AND s."createdAt" <= ${occurredAt}
    ON CONFLICT ("subscriptionId","eventId") DO NOTHING
    RETURNING id
  `);
}

async function claimNextOutbox(): Promise<OutboxRow | null> {
  return db.$transaction(async tx => {
    const claimed = (await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      WITH candidate AS (
        SELECT id FROM "IntegrationWebhookOutbox"
        WHERE "publishedAt" IS NULL AND "nextAttemptAt" <= CURRENT_TIMESTAMP
        ORDER BY "nextAttemptAt" ASC,"createdAt" ASC,id ASC
        FOR UPDATE SKIP LOCKED LIMIT 1
      )
      UPDATE "IntegrationWebhookOutbox" o
      SET "lastAttemptAt"=CURRENT_TIMESTAMP,
          "attemptCount"="attemptCount"+1,
          "nextAttemptAt"=CURRENT_TIMESTAMP + INTERVAL '5 minutes'
      FROM candidate WHERE o.id=candidate.id
      RETURNING o.id
    `))[0];
    if (!claimed) return null;
    return (await tx.$queryRaw<OutboxRow[]>(Prisma.sql`
      SELECT id,"organizationId","eventId","eventName",data,"occurredAt","attemptCount"
      FROM "IntegrationWebhookOutbox"
      WHERE id=${claimed.id}::uuid
    `))[0] ?? null;
  });
}

async function finishOutboxFailure(row: OutboxRow, message: string) {
  const delay = OUTBOX_RETRY_SECONDS[Math.min(Math.max(row.attemptCount - 1, 0), OUTBOX_RETRY_SECONDS.length - 1)] ?? OUTBOX_RETRY_SECONDS[OUTBOX_RETRY_SECONDS.length - 1];
  await db.$executeRaw(Prisma.sql`
    UPDATE "IntegrationWebhookOutbox"
    SET "nextAttemptAt"=${new Date(Date.now() + delay * 1000)},"lastError"=${message.slice(0,500)}
    WHERE id=${row.id}::uuid AND "publishedAt" IS NULL
  `);
}

export async function processWebhookOutboxBatch(limit = 10) {
  const bounded = Math.max(1, Math.min(20, Math.trunc(limit)));
  const result = { processed: 0, published: 0, retry: 0 };
  for (let i = 0; i < bounded; i += 1) {
    const row = await claimNextOutbox();
    if (!row) break;
    result.processed += 1;
    try {
      await queueWebhookEvent({
        organizationId: row.organizationId,
        eventId: row.eventId,
        eventName: row.eventName,
        data: row.data,
        occurredAt: row.occurredAt,
      });
      await db.$executeRaw(Prisma.sql`
        UPDATE "IntegrationWebhookOutbox"
        SET "publishedAt"=CURRENT_TIMESTAMP,"lastError"=NULL
        WHERE id=${row.id}::uuid AND "publishedAt" IS NULL
      `);
      result.published += 1;
    } catch (error) {
      await finishOutboxFailure(row, error instanceof Error ? error.message : "Webhook outbox publication failed");
      result.retry += 1;
    }
  }
  return result;
}

async function claimNextDelivery(): Promise<DeliveryRow | null> {
  return db.$transaction(async tx => {
    const claimed = (await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      WITH candidate AS (
        SELECT id FROM "IntegrationWebhookDelivery"
        WHERE status IN ('PENDING','RETRY') AND "nextAttemptAt" <= CURRENT_TIMESTAMP
        ORDER BY "nextAttemptAt" ASC,"createdAt" ASC,id ASC
        FOR UPDATE SKIP LOCKED LIMIT 1
      )
      UPDATE "IntegrationWebhookDelivery" d SET status='PROCESSING',"lastAttemptAt"=CURRENT_TIMESTAMP,"attemptCount"="attemptCount"+1
      FROM candidate WHERE d.id=candidate.id RETURNING d.id
    `))[0];
    if (!claimed) return null;
    return (await tx.$queryRaw<DeliveryRow[]>(Prisma.sql`
      SELECT d.id,d."organizationId",d."integrationClientId",d."subscriptionId",d."eventId",d."eventName",d.payload,d."attemptCount",
             s."endpointUrl",s."signingKeyVersion",s.status AS "subscriptionStatus",c.status AS "clientStatus"
      FROM "IntegrationWebhookDelivery" d
      JOIN "IntegrationWebhookSubscription" s ON s.id=d."subscriptionId" AND s."organizationId"=d."organizationId"
      JOIN "IntegrationClient" c ON c.id=d."integrationClientId" AND c."organizationId"=d."organizationId"
      WHERE d.id=${claimed.id}::uuid
    `))[0] ?? null;
  });
}

async function finishFailure(row: DeliveryRow, message: string, responseStatus: number | null = null) {
  const dead = row.attemptCount >= MAX_ATTEMPTS || row.subscriptionStatus !== "REGISTERED" || row.clientStatus !== "ACTIVE";
  const delay = RETRY_SECONDS[Math.min(Math.max(row.attemptCount - 1, 0), RETRY_SECONDS.length - 1)] ?? RETRY_SECONDS[RETRY_SECONDS.length - 1];
  await db.$executeRaw(Prisma.sql`
    UPDATE "IntegrationWebhookDelivery"
    SET status=${dead ? "DEAD_LETTER" : "RETRY"}::"IntegrationWebhookDeliveryStatus",
        "nextAttemptAt"=${dead ? new Date() : new Date(Date.now() + delay * 1000)},
        "responseStatus"=${responseStatus},"lastError"=${message.slice(0,500)}
    WHERE id=${row.id}::uuid AND status='PROCESSING'
  `);
}

async function deliverClaimed(row: DeliveryRow) {
  if (row.subscriptionStatus !== "REGISTERED" || row.clientStatus !== "ACTIVE") {
    await finishFailure(row, "Subscription or integration client is no longer active");
    return "dead-letter" as const;
  }
  const endpointUrl = await assertWebhookDestinationSafe(row.endpointUrl);
  const body = payloadText(row.payload);
  const signingSecret = deriveWebhookSigningSecret(row.subscriptionId, row.signingKeyVersion);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "user-agent": "Trace-QMS-Webhook/1.0",
        "x-trace-event-id": row.eventId,
        "x-trace-event": row.eventName,
        "x-trace-signature": signWebhookBody(body, signingSecret),
      },
      body,
    });
    if (response.status >= 200 && response.status < 300) {
      await db.$executeRaw(Prisma.sql`
        UPDATE "IntegrationWebhookDelivery" SET status='SUCCEEDED',"deliveredAt"=CURRENT_TIMESTAMP,"responseStatus"=${response.status},"lastError"=NULL
        WHERE id=${row.id}::uuid AND status='PROCESSING'
      `);
      return "succeeded" as const;
    }
    await finishFailure(row, `Webhook endpoint returned HTTP ${response.status}`, response.status);
    return row.attemptCount >= MAX_ATTEMPTS ? "dead-letter" as const : "retry" as const;
  } catch (error) {
    await finishFailure(row, error instanceof Error ? error.message : "Webhook delivery failed");
    return row.attemptCount >= MAX_ATTEMPTS ? "dead-letter" as const : "retry" as const;
  } finally {
    clearTimeout(timer);
  }
}

export async function processWebhookDeliveryBatch(limit = 10) {
  const bounded = Math.max(1, Math.min(20, Math.trunc(limit)));
  const result = { processed: 0, succeeded: 0, retry: 0, deadLetter: 0 };
  for (let i = 0; i < bounded; i += 1) {
    const row = await claimNextDelivery();
    if (!row) break;
    result.processed += 1;
    try {
      const outcome = await deliverClaimed(row);
      if (outcome === "succeeded") result.succeeded += 1;
      else if (outcome === "retry") result.retry += 1;
      else result.deadLetter += 1;
    } catch (error) {
      await finishFailure(row, error instanceof Error ? error.message : "Webhook delivery failed");
      if (row.attemptCount >= MAX_ATTEMPTS) result.deadLetter += 1; else result.retry += 1;
    }
  }
  return result;
}
