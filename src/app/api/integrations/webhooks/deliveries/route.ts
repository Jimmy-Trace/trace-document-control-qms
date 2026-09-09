import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { IntegrationClientError } from "@/lib/integrations/integration-clients";
import { listWebhookDeliveryDiagnostics, requeueDeadLetterWebhookDelivery } from "@/lib/integrations/webhook-operations";

export async function GET(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const limit = request.nextUrl.searchParams.get("limit");
    return NextResponse.json({ data: await listWebhookDeliveryDiagnostics(context, context.organizationId, limit) });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
    if (error instanceof IntegrationClientError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Webhook delivery administration failure", error);
    return NextResponse.json({ error: "Webhook delivery administration failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const body = await request.json();
    if (body.operation !== "requeue") return NextResponse.json({ error: "Unsupported webhook delivery operation" }, { status: 400 });
    return NextResponse.json({ data: await requeueDeadLetterWebhookDelivery(context, {
      organizationId: context.organizationId,
      deliveryId: body.deliveryId ?? "",
      reason: body.reason ?? "",
    }) });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
    if (error instanceof IntegrationClientError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Webhook delivery administration failure", error);
    return NextResponse.json({ error: "Webhook delivery administration failed" }, { status: 500 });
  }
}
