import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { processWebhookDeliveryBatch } from "@/lib/integrations/webhook-delivery";

function authorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a,b);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(rawLimit) ? rawLimit : 10;
  try {
    return NextResponse.json({ data: await processWebhookDeliveryBatch(limit) });
  } catch (error) {
    console.error("Webhook delivery worker failure", error);
    return NextResponse.json({ error: "Webhook delivery worker failed" }, { status: 500 });
  }
}
