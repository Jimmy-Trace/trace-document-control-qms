import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { IntegrationClientError } from "@/lib/integrations/integration-clients";
import { IntegrationWebhookSubscriptionService } from "@/lib/integrations/webhook-subscriptions";

const service = new IntegrationWebhookSubscriptionService();

export async function GET(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    return NextResponse.json({ data: await service.list(context, context.organizationId) });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
    if (error instanceof IntegrationClientError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Integration webhook API failure", error);
    return NextResponse.json({ error: "Integration webhook operation failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const body = await request.json();
    if (body.operation === "create") return NextResponse.json({ data: await service.create(context, {
      organizationId: context.organizationId,
      integrationClientId: body.integrationClientId ?? "",
      endpointUrl: body.endpointUrl ?? "",
      events: body.events,
    }) });
    if (body.operation === "revoke") return NextResponse.json({ data: await service.revoke(context, {
      organizationId: context.organizationId,
      subscriptionId: body.subscriptionId ?? "",
      reason: body.reason ?? "",
    }) });
    return NextResponse.json({ error: "Unsupported webhook subscription operation" }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
    if (error instanceof IntegrationClientError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Integration webhook API failure", error);
    return NextResponse.json({ error: "Integration webhook operation failed" }, { status: 500 });
  }
}
