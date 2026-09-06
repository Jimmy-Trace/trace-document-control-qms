import { NextRequest, NextResponse } from "next/server";
import { processScheduledEffectiveness } from "@/lib/documents/scheduled-effectiveness";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";

export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    return NextResponse.json({
      data: await processScheduledEffectiveness(new Date()),
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to process scheduled document effectiveness" },
      { status: 500 },
    );
  }
}
