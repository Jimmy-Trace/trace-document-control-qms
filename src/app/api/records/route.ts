import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { PrismaRecordStore } from "@/lib/records/record-store";
import { RecordEligibilityError, RecordService, RecordValidationError } from "@/lib/records/records";
import { DispositionBlockedError } from "@/lib/retention/service";

const createSchema = z.object({
  operation: z.literal("CREATE").optional(),
  recordTypeId: z.string().uuid(),
  recordNumber: z.string().max(120),
  title: z.string().max(300),
  occurredAt: z.string().datetime().nullish(),
  fileId: z.string().uuid().nullish(),
});
const archiveSchema = z.object({
  operation: z.literal("ARCHIVE"),
  recordId: z.string().uuid(),
  reason: z.string().max(1000),
});

const service = new RecordService(new PrismaRecordStore());

export async function GET(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    return NextResponse.json({ data: await service.listRecords(context, context.organizationId) });
  } catch (error) {
    return respond(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const body = await request.json();
    if (body?.operation === "ARCHIVE") {
      const input = archiveSchema.parse(body);
      return NextResponse.json({ data: await service.archiveRecord(context, { organizationId: context.organizationId, recordId: input.recordId, reason: input.reason }) });
    }
    const input = createSchema.parse(body);
    return NextResponse.json({
      data: await service.createRecord(context, {
        organizationId: context.organizationId,
        recordTypeId: input.recordTypeId,
        recordNumber: input.recordNumber,
        title: input.title,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : null,
        fileId: input.fileId ?? null,
      }),
    }, { status: 201 });
  } catch (error) {
    return respond(error);
  }
}

function respond(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid record request" }, { status: 422 });
  if (error instanceof RecordValidationError || error instanceof RecordEligibilityError || error instanceof DispositionBlockedError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof Error && error.message === "Access denied") return NextResponse.json({ error: "Access denied" }, { status: 403 });
  return NextResponse.json({ error: "Record operation failed" }, { status: 500 });
}
