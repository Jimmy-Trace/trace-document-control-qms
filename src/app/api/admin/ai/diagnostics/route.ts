import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { getAiAdminDiagnostics } from "@/lib/ai/ai-admin-diagnostics";

export async function GET(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const data = await getAiAdminDiagnostics(context, context.organizationId);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Access denied") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unable to load AI diagnostics" }, { status: 500 });
  }
}
