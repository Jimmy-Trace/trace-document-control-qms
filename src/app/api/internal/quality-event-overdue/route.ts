import { NextRequest, NextResponse } from "next/server";
import { PrismaQualityEventEscalationStore } from "@/lib/quality/escalation-store";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";

const store = new PrismaQualityEventEscalationStore();

export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    return NextResponse.json({ data: { created: await store.notifyAllOverdue(new Date()) } });
  } catch {
    return NextResponse.json(
      { error: "Unable to monitor overdue quality events" },
      { status: 500 },
    );
  }
}
