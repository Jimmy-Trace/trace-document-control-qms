import { NextRequest,NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { EquipmentComplianceService } from "@/lib/equipment/compliance";
import { PrismaEquipmentComplianceStore } from "@/lib/equipment/compliance-store";
const service=new EquipmentComplianceService(new PrismaEquipmentComplianceStore());
export async function POST(request:NextRequest){if(!isAuthorizedCronRequest(request.headers.get("authorization")))return NextResponse.json({error:"Not found"},{status:404});try{return NextResponse.json({data:{createdHolds:await service.detectOverdue()}});}catch{return NextResponse.json({error:"Equipment overdue monitor failed"},{status:500});}}
