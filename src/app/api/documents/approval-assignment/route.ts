import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticateRequest,
  AuthenticationRequiredError,
} from "@/lib/security/authenticated-request";
import {
  ApprovalAssignmentConflictError,
  ApprovalAssignmentService,
  ApprovalAssignmentValidationError,
} from "@/lib/documents/approval-assignment";
import { PrismaApprovalAssignmentStore } from "@/lib/documents/approval-assignment-store";

const schema = z.object({
  workflowTaskId: z.string().uuid(),
  approverUserId: z.string().uuid(),
  reason: z.string().trim().min(1).max(4000),
});

const service = new ApprovalAssignmentService(new PrismaApprovalAssignmentStore());

export async function POST(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const input = schema.parse(await request.json());
    const result = await service.assign(context, {
      organizationId: context.organizationId,
      ...input,
    });
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError)
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (error instanceof ApprovalAssignmentConflictError)
      return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof z.ZodError || error instanceof ApprovalAssignmentValidationError)
      return NextResponse.json({ error: "The approval assignment is invalid" }, { status: 422 });
    if (error instanceof Error && error.message === "Access denied")
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    return NextResponse.json({ error: "Unable to assign approval" }, { status: 500 });
  }
}
