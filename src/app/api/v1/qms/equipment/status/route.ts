import { NextResponse } from "next/server";
import { authenticateIntegrationBearer, IntegrationClientError } from "../../../../../../lib/integrations/integration-clients";
import { listEquipmentStatusReferences, normalizeReferenceLimit } from "../../../../../../lib/integrations/qms-reference";

export async function GET(request: Request) {
  try {
    const context = await authenticateIntegrationBearer(request.headers.get("authorization"));
    const url = new URL(request.url);
    const limit = normalizeReferenceLimit(url.searchParams.get("limit"));
    const equipment = await listEquipmentStatusReferences(context, { limit });
    return NextResponse.json({ apiVersion: "v1", equipment });
  } catch (error) {
    if (error instanceof IntegrationClientError) {
      const status = error.message === "Integration scope denied" ? 403 : error.message.startsWith("limit must") ? 400 : 401;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
