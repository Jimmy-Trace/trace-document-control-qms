import { NextRequest,NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { PrismaEquipmentEscalationStore } from "@/lib/equipment/escalation-store";
const store=new PrismaEquipmentEscalationStore();
export async function POST(request:NextRequest){if(!isAuthorizedCronRequest(request.headers.get("authorization")))return NextResponse.json({error:"Not found"},{status:404});try{return NextResponse.json({data:{created:await store.notifyAll(new Date())}});}catch{return NextResponse.json({error:"Unable to process equipment escalations"},{status:500});}}
