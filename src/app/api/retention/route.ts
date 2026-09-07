import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { PrismaRetentionStore } from "@/lib/retention/prisma-store";
import { RetentionService, RetentionValidationError } from "@/lib/retention/service";

const uuid = z.string().uuid();
const entityType = z.enum(["Document", "DocumentVersion", "FileObject", "QualityRecord"]);
const command = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("CREATE_POLICY"), recordType: z.string().max(80), jurisdiction: z.string().max(120).nullable().optional(), retentionDays: z.number().int() }),
  z.object({ operation: z.literal("SET_POLICY_ACTIVE"), policyId: uuid, active: z.boolean() }),
  z.object({ operation: z.literal("CREATE_HOLD"), entityType, entityId: uuid, reason: z.string().max(500) }),
  z.object({ operation: z.literal("RELEASE_HOLD"), holdId: uuid, reason: z.string().max(500) }),
]);
const service = new RetentionService(new PrismaRetentionStore());

export async function GET(request: NextRequest) {
  try {
    const context = await authenticateRequest(request), params = request.nextUrl.searchParams;
    const requestedType = params.get("entityType"), requestedId = params.get("entityId");
    if (requestedType || requestedId) {
      const parsed = z.object({ entityType, entityId: uuid }).parse({ entityType: requestedType, entityId: requestedId });
      return NextResponse.json({ data: await service.dispositionStatus(context, { organizationId: context.organizationId, ...parsed }) });
    }
    return NextResponse.json({ data: await service.list(context, context.organizationId) });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid retention query" }, { status: 422 });
    if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
    return NextResponse.json({ error: "Unable to load retention controls" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await authenticateRequest(request), input = command.parse(await request.json());
    if (input.operation === "CREATE_POLICY") return NextResponse.json({ data: await service.createPolicy(context, { organizationId: context.organizationId, recordType: input.recordType, jurisdiction: input.jurisdiction, retentionDays: input.retentionDays }) }, { status: 201 });
    if (input.operation === "SET_POLICY_ACTIVE") { await service.setPolicyActive(context, { organizationId: context.organizationId, policyId: input.policyId, active: input.active }); return NextResponse.json({ data: { updated: true } }); }
    if (input.operation === "CREATE_HOLD") return NextResponse.json({ data: await service.createHold(context, { organizationId: context.organizationId, entityType: input.entityType, entityId: input.entityId, reason: input.reason }) }, { status: 201 });
    await service.releaseHold(context, { organizationId: context.organizationId, holdId: input.holdId, reason: input.reason });
    return NextResponse.json({ data: { released: true } });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid retention request" }, { status: 422 });
    if (error instanceof RetentionValidationError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
    return NextResponse.json({ error: "Retention change could not be completed" }, { status: 500 });
  }
}
