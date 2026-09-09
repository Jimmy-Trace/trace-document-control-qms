import { NextResponse } from "next/server";
import { authenticateIntegrationBearer, IntegrationClientError } from "../../../../../../lib/integrations/integration-clients";
import { listEffectiveDocumentReferences } from "../../../../../../lib/integrations/qms-reference";

export async function GET(request: Request) {
  try {
    const context = await authenticateIntegrationBearer(request.headers.get("authorization"));
    const url = new URL(request.url);
    const rawLimit = url.searchParams.get("limit");
    let limit: number | undefined;
    if (rawLimit !== null) {
      const parsed = Number(rawLimit);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
        return NextResponse.json({ error: "limit must be an integer from 1 to 100" }, { status: 400 });
      }
      limit = parsed;
    }
    const documents = await listEffectiveDocumentReferences(context, { limit });
    return NextResponse.json({ apiVersion: "v1", documents });
  } catch (error) {
    if (error instanceof IntegrationClientError) {
      return NextResponse.json({ error: error.message }, { status: error.message === "Integration scope denied" ? 403 : 401 });
    }
    throw error;
  }
}
