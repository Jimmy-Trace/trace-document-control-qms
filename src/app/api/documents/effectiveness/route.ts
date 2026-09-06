import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticateRequest,
  AuthenticationRequiredError,
} from "@/lib/security/authenticated-request";
import {
  scheduleDocumentEffectiveness,
  ScheduledEffectivenessConcurrencyError,
  ScheduledEffectivenessError,
} from "@/lib/documents/scheduled-effectiveness";

const schema = z.object({
  versionId: z.string().uuid(),
  expectedLockVersion: z.number().int().nonnegative(),
  effectiveAt: z.coerce.date(),
  reason: z.string().trim().min(1).max(4000),
});

export async function POST(request: NextRequest) {
  try {
    const context = await authenticateRequest(request);
    const input = schema.parse(await request.json());
    const result = await scheduleDocumentEffectiveness(context, {
      ...input,
      organizationId: context.organizationId,
    });
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }
    if (error instanceof ScheduledEffectivenessConcurrencyError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof z.ZodError || error instanceof ScheduledEffectivenessError) {
      return NextResponse.json(
        { error: "The scheduled effectiveness request is invalid" },
        { status: 422 },
      );
    }
    if (error instanceof Error && error.message === "Access denied") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Unable to schedule document effectiveness" },
      { status: 500 },
    );
  }
}
