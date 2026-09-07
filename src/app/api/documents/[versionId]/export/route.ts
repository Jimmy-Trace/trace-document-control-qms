import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { exportControlledDocument, ControlledExportIntegrityError, ControlledExportValidationError } from "@/lib/documents/export";

const requestSchema = z.object({ reason: z.string().max(500) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const context = await authenticateRequest(request);
    const versionId = z.string().uuid().parse((await params).versionId);
    const input = requestSchema.parse(await request.json());
    const exported = await exportControlledDocument(context, { organizationId: context.organizationId, versionId, reason: input.reason });
    const safeName = exported.filename.replace(/["\\]/g, "_");
    return new NextResponse(Buffer.from(exported.bytes), {
      headers: {
        "content-type": exported.mimeType,
        "content-disposition": `attachment; filename="${safeName}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "x-controlled-document-number": exported.documentNumber,
        "x-controlled-revision": exported.revisionLabel,
        "x-controlled-status": exported.status,
        "x-content-sha256": exported.sha256,
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid controlled export request" }, { status: 422 });
    if (error instanceof ControlledExportValidationError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof ControlledExportIntegrityError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
    return NextResponse.json({ error: "Controlled document could not be exported" }, { status: 500 });
  }
}
