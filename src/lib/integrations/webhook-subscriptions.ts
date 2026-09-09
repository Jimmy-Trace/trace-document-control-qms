import { createHmac } from "node:crypto";
import net from "node:net";
import { Prisma } from "@prisma/client";
import { db } from "../db";
import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";
import { IntegrationClientError } from "./integration-clients";

export const approvedWebhookEvents = [
  "document.effective",
  "equipment.status",
  "inventory.lot.status",
  "quality_event.status",
  "validation_project.status",
] as const;
export type IntegrationWebhookEvent = (typeof approvedWebhookEvents)[number];

export type IntegrationWebhookSubscription = {
  id: string;
  integrationClientId: string;
  endpointUrl: string;
  events: IntegrationWebhookEvent[];
  status: "REGISTERED" | "REVOKED";
  signingKeyVersion: number;
  createdAt: Date;
  revokedAt: Date | null;
};

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a,b] = parts;
  return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 0;
}

export function validateWebhookEndpoint(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new IntegrationClientError("Webhook endpoint must be a valid URL"); }
  if (url.protocol !== "https:") throw new IntegrationClientError("Webhook endpoint must use HTTPS");
  if (url.username || url.password) throw new IntegrationClientError("Webhook endpoint must not contain embedded credentials");
  const hostname = url.hostname.toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) throw new IntegrationClientError("Webhook endpoint host is not allowed");
  if (net.isIP(hostname) === 4 && isPrivateIpv4(hostname)) throw new IntegrationClientError("Webhook endpoint host is not allowed");
  if (net.isIP(hostname) === 6 && (hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe8") || hostname.startsWith("fe9") || hostname.startsWith("fea") || hostname.startsWith("feb"))) throw new IntegrationClientError("Webhook endpoint host is not allowed");
  url.hash = "";
  return url.toString();
}

export function validateWebhookEvents(events: unknown): IntegrationWebhookEvent[] {
  if (!Array.isArray(events) || events.length === 0) throw new IntegrationClientError("At least one webhook event is required");
  const normalized = [...new Set(events)];
  if (normalized.some(event => typeof event !== "string" || !approvedWebhookEvents.includes(event as IntegrationWebhookEvent))) throw new IntegrationClientError("Unsupported webhook event");
  return normalized as IntegrationWebhookEvent[];
}

export function deriveWebhookSigningSecret(subscriptionId: string, keyVersion = 1, source = process.env) {
  const master = source.WEBHOOK_SIGNING_MASTER_SECRET?.trim();
  if (!master || master.length < 32) throw new IntegrationClientError("WEBHOOK_SIGNING_MASTER_SECRET must contain at least 32 characters");
  return createHmac("sha256", master).update(`${subscriptionId}:v${keyVersion}`).digest("base64url");
}

export class IntegrationWebhookSubscriptionService {
  async list(context: AuthorizationContext, organizationId: string) {
    requireAuthorization(context,{organizationId,permission:"integration.manage"});
    return db.$queryRaw<IntegrationWebhookSubscription[]>(Prisma.sql`
      SELECT id,"integrationClientId","endpointUrl",events,status,"signingKeyVersion","createdAt","revokedAt"
      FROM "IntegrationWebhookSubscription"
      WHERE "organizationId"=${organizationId}::uuid
      ORDER BY "createdAt" DESC,id ASC
    `);
  }

  async create(context: AuthorizationContext,input:{organizationId:string;integrationClientId:string;endpointUrl:string;events:unknown}) {
    requireAuthorization(context,{organizationId:input.organizationId,permission:"integration.manage"});
    const endpointUrl=validateWebhookEndpoint(input.endpointUrl);
    const events=validateWebhookEvents(input.events);
    return db.$transaction(async tx=>{
      const client=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`
        SELECT id FROM "IntegrationClient" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.integrationClientId}::uuid AND status='ACTIVE'
      `))[0];
      if(!client) throw new IntegrationClientError("Active integration client not found");
      const row=(await tx.$queryRaw<Array<{id:string;signingKeyVersion:number}>>(Prisma.sql`
        INSERT INTO "IntegrationWebhookSubscription" ("organizationId","integrationClientId","endpointUrl",events,"createdByUserId")
        VALUES (${input.organizationId}::uuid,${input.integrationClientId}::uuid,${endpointUrl},${events}::text[],${context.userId}::uuid)
        RETURNING id,"signingKeyVersion"
      `))[0];
      if(!row) throw new IntegrationClientError("Webhook subscription could not be created");
      const signingSecret=deriveWebhookSigningSecret(row.id,row.signingKeyVersion);
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"INTEGRATION_WEBHOOK_SUBSCRIPTION_CREATED",entityType:"IntegrationWebhookSubscription",entityId:row.id,metadata:{integrationClientId:input.integrationClientId,endpointUrl,events,signingKeyVersion:row.signingKeyVersion}}});
      return {id:row.id,integrationClientId:input.integrationClientId,endpointUrl,events,status:"REGISTERED" as const,signingKeyVersion:row.signingKeyVersion,signingSecret};
    });
  }

  async rotateSigningKey(context: AuthorizationContext,input:{organizationId:string;subscriptionId:string;reason:string}) {
    requireAuthorization(context,{organizationId:input.organizationId,permission:"integration.manage"});
    const reason=input.reason.trim();
    if(!reason) throw new IntegrationClientError("Webhook signing key rotation reason is required");
    return db.$transaction(async tx=>{
      const row=(await tx.$queryRaw<Array<{id:string;signingKeyVersion:number}>>(Prisma.sql`
        UPDATE "IntegrationWebhookSubscription" s
        SET "signingKeyVersion"="signingKeyVersion"+1
        FROM "IntegrationClient" c
        WHERE s."organizationId"=${input.organizationId}::uuid
          AND s.id=${input.subscriptionId}::uuid
          AND s.status='REGISTERED'
          AND c.id=s."integrationClientId"
          AND c."organizationId"=s."organizationId"
          AND c.status='ACTIVE'
        RETURNING s.id,s."signingKeyVersion"
      `))[0];
      if(!row) throw new IntegrationClientError("Registered webhook subscription for an active integration client not found");
      const signingSecret=deriveWebhookSigningSecret(row.id,row.signingKeyVersion);
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"INTEGRATION_WEBHOOK_SIGNING_KEY_ROTATED",entityType:"IntegrationWebhookSubscription",entityId:row.id,reason,metadata:{signingKeyVersion:row.signingKeyVersion}}});
      return {id:row.id,signingKeyVersion:row.signingKeyVersion,signingSecret};
    });
  }

  async revoke(context: AuthorizationContext,input:{organizationId:string;subscriptionId:string;reason:string}) {
    requireAuthorization(context,{organizationId:input.organizationId,permission:"integration.manage"});
    const reason=input.reason.trim();
    if(!reason) throw new IntegrationClientError("Webhook revocation reason is required");
    return db.$transaction(async tx=>{
      const row=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`
        UPDATE "IntegrationWebhookSubscription"
        SET status='REVOKED',"revokedByUserId"=${context.userId}::uuid,"revokedAt"=CURRENT_TIMESTAMP
        WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.subscriptionId}::uuid AND status='REGISTERED'
        RETURNING id
      `))[0];
      if(!row) throw new IntegrationClientError("Registered webhook subscription not found");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"INTEGRATION_WEBHOOK_SUBSCRIPTION_REVOKED",entityType:"IntegrationWebhookSubscription",entityId:row.id,reason}});
      return {id:row.id};
    });
  }
}
