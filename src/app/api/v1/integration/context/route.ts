import { NextRequest, NextResponse } from "next/server";
import { authenticateIntegrationBearer, IntegrationClientError, requireIntegrationScope } from "@/lib/integrations/integration-clients";

export async function GET(request: NextRequest) {
  try {
    const context = await authenticateIntegrationBearer(request.headers.get("authorization"));
    requireIntegrationScope(context, "qms.read");
    return NextResponse.json({ data: {
      apiVersion: "v1",
      integrationClientId: context.integrationClientId,
      organizationId: context.organizationId,
      scopes: context.scopes,
    }});
  } catch (error) {
    if (error instanceof IntegrationClientError) return NextResponse.json({ error: error.message }, { status: error.message === "Integration scope denied" ? 403 : 401 });
    console.error("External integration authentication failure", error);
    return NextResponse.json({ error: "Integration authentication failed" }, { status: 500 });
  }
}
