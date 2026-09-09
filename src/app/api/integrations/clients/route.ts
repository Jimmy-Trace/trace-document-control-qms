import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { IntegrationClientError, IntegrationClientService } from "@/lib/integrations/integration-clients";

const service = new IntegrationClientService();

export async function GET(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    return NextResponse.json({ data: await service.list(context, context.organizationId) });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
    if (error instanceof IntegrationClientError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Integration client API failure", error);
    return NextResponse.json({ error: "Integration client operation failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const body = await request.json();
    if (body.operation === "create") return NextResponse.json({ data: await service.create(context, { organizationId: context.organizationId, name: body.name ?? "", scopes: body.scopes }) });
    if (body.operation === "rotate-credential") return NextResponse.json({ data: await service.rotateCredential(context, { organizationId: context.organizationId, integrationClientId: body.integrationClientId ?? "", reason: body.reason ?? "" }) });
    if (body.operation === "revoke") return NextResponse.json({ data: await service.revoke(context, { organizationId: context.organizationId, integrationClientId: body.integrationClientId ?? "", reason: body.reason ?? "" }) });
    return NextResponse.json({ error: "Unsupported integration client operation" }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
    if (error instanceof IntegrationClientError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Integration client API failure", error);
    return NextResponse.json({ error: "Integration client operation failed" }, { status: 500 });
  }
}
