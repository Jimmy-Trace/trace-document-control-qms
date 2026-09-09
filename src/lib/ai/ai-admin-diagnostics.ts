import { Prisma } from "@prisma/client";
import { db } from "../db";
import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";
import { getAiTenantPolicy } from "./ai-policy";
import { listAiProviderProfiles } from "./ai-providers";
import { listAiProviderCredentialBindings } from "./ai-provider-credentials";

export type AiExecutionDiagnosticEvent = {
  correlationId: string;
  eventType: "REQUESTED" | "COMPLETED" | "REJECTED" | "FAILED";
  useCase: string;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  inputSha256: string | null;
  outputSha256: string | null;
  provider: string | null;
  model: string | null;
  createdAt: Date;
};

export async function getAiAdminDiagnostics(context: AuthorizationContext, organizationId: string) {
  requireAuthorization(context, { organizationId, permission: "ai.manage" });
  const [policy, providers, credentials, recentEvents] = await Promise.all([
    getAiTenantPolicy(context, organizationId),
    listAiProviderProfiles(context, organizationId),
    listAiProviderCredentialBindings(context, organizationId),
    db.$queryRaw<AiExecutionDiagnosticEvent[]>(Prisma.sql`
      SELECT "correlationId","eventType","useCase","sourceEntityType","sourceEntityId",
        "inputSha256","outputSha256",provider,model,"createdAt"
      FROM "AiAssistanceEvent"
      WHERE "organizationId"=${organizationId}::uuid
      ORDER BY "createdAt" DESC,id DESC
      LIMIT 100
    `),
  ]);

  return {
    policy,
    providers,
    credentials: credentials.map(binding => ({
      id: binding.id,
      providerProfileId: binding.providerProfileId,
      runtimeSecretName: binding.runtimeSecretName,
      status: binding.status,
      credentialVersion: binding.credentialVersion,
      createdAt: binding.createdAt,
      updatedAt: binding.updatedAt,
    })),
    recentEvents,
  };
}
