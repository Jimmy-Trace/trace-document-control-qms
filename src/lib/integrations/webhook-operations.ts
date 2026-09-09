import { Prisma } from "@prisma/client";
import { db } from "../db";
import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";
import { IntegrationClientError } from "./integration-clients";

export type WebhookDeliveryDiagnostic = {
  id: string;
  integrationClientId: string;
  integrationClientName: string;
  subscriptionId: string;
  eventId: string;
  eventName: string;
  status: "PENDING" | "PROCESSING" | "RETRY" | "SUCCEEDED" | "DEAD_LETTER";
  attemptCount: number;
  nextAttemptAt: Date;
  lastAttemptAt: Date | null;
  responseStatus: number | null;
  lastError: string | null;
  createdAt: Date;
  deliveredAt: Date | null;
};

function normalizeLimit(limit: unknown) {
  const parsed = typeof limit === "number" ? limit : Number(limit ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(100, Math.trunc(parsed)));
}

export async function listWebhookDeliveryDiagnostics(
  context: AuthorizationContext,
  organizationId: string,
  limit: unknown = 50,
) {
  requireAuthorization(context, { organizationId, permission: "integration.manage" });
  const bounded = normalizeLimit(limit);
  return db.$queryRaw<WebhookDeliveryDiagnostic[]>(Prisma.sql`
    SELECT d.id,
           d."integrationClientId",
           c.name AS "integrationClientName",
           d."subscriptionId",
           d."eventId",
           d."eventName",
           d.status,
           d."attemptCount",
           d."nextAttemptAt",
           d."lastAttemptAt",
           d."responseStatus",
           d."lastError",
           d."createdAt",
           d."deliveredAt"
    FROM "IntegrationWebhookDelivery" d
    JOIN "IntegrationClient" c
      ON c.id=d."integrationClientId" AND c."organizationId"=d."organizationId"
    WHERE d."organizationId"=${organizationId}::uuid
    ORDER BY d."createdAt" DESC, d.id DESC
    LIMIT ${bounded}
  `);
}

export async function requeueDeadLetterWebhookDelivery(
  context: AuthorizationContext,
  input: { organizationId: string; deliveryId: string; reason: string },
) {
  requireAuthorization(context, { organizationId: input.organizationId, permission: "integration.manage" });
  const reason = input.reason.trim();
  if (!reason) throw new IntegrationClientError("Webhook delivery requeue reason is required");

  return db.$transaction(async tx => {
    const row = (await tx.$queryRaw<Array<{
      id: string;
      subscriptionId: string;
      eventId: string;
      eventName: string;
      attemptCount: number;
      responseStatus: number | null;
      lastError: string | null;
    }>>(Prisma.sql`
      SELECT d.id,d."subscriptionId",d."eventId",d."eventName",d."attemptCount",d."responseStatus",d."lastError"
      FROM "IntegrationWebhookDelivery" d
      JOIN "IntegrationWebhookSubscription" s
        ON s.id=d."subscriptionId" AND s."organizationId"=d."organizationId"
      JOIN "IntegrationClient" c
        ON c.id=d."integrationClientId" AND c."organizationId"=d."organizationId"
      WHERE d."organizationId"=${input.organizationId}::uuid
        AND d.id=${input.deliveryId}::uuid
        AND d.status='DEAD_LETTER'
        AND s.status='REGISTERED'
        AND c.status='ACTIVE'
      FOR UPDATE OF d
    `))[0];
    if (!row) throw new IntegrationClientError("Eligible dead-letter webhook delivery not found");

    await tx.$executeRaw(Prisma.sql`
      UPDATE "IntegrationWebhookDelivery"
      SET status='PENDING',
          "attemptCount"=0,
          "nextAttemptAt"=CURRENT_TIMESTAMP,
          "lastAttemptAt"=NULL,
          "responseStatus"=NULL,
          "lastError"=NULL,
          "deliveredAt"=NULL
      WHERE id=${row.id}::uuid AND "organizationId"=${input.organizationId}::uuid AND status='DEAD_LETTER'
    `);

    await tx.auditEvent.create({ data: {
      organizationId: input.organizationId,
      actorUserId: context.userId,
      action: "INTEGRATION_WEBHOOK_DELIVERY_REQUEUED",
      entityType: "IntegrationWebhookDelivery",
      entityId: row.id,
      reason,
      metadata: {
        subscriptionId: row.subscriptionId,
        eventId: row.eventId,
        eventName: row.eventName,
        previousAttemptCount: row.attemptCount,
        previousResponseStatus: row.responseStatus,
        previousLastError: row.lastError,
      },
    }});

    return { id: row.id, status: "PENDING" as const };
  });
}
