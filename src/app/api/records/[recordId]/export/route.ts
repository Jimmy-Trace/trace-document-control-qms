import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { exportQualityRecord, RecordExportIntegrityError, RecordExportValidationError } from "@/lib/records/export";

const requestSchema = z.object({ reason: z.string().max(500) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ recordId: string }> }) {
  try {
    const context = await authenticateRequest(request);
    const recordId = z.string().uuid().parse((await params).recordId);
    const input = requestSchema.parse(await request.json());
    const exported = await exportQualityRecord(context, { organizationId: context.organizationId, recordId, reason: input.reason });
    const safeName = exported.filename.replace(/["\\]/g, "_");
    return new NextResponse(Buffer.from(exported.bytes), {
      headers: {
        "content-type": exported.mimeType,
        "content-disposition": `attachment; filename="${safeName}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "x-quality-record-number": exported.recordNumber,
        "x-quality-record-status": exported.status,
        "x-quality-record-type": exported.recordTypeCode,
        "x-content-sha256": exported.sha256,
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid regulated record export request" }, { status: 422 });
    if (error instanceof RecordExportValidationError || error instanceof RecordExportIntegrityError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
    return NextResponse.json({ error: "Regulated record could not be exported" }, { status: 500 });
  }
}
