import { NextRequest,NextResponse } from "next/server";
import { InventoryAutomationService } from "@/lib/inventory/inventory-automation";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
const service=new InventoryAutomationService();
export async function POST(request:NextRequest){if(!isAuthorizedCronRequest(request.headers.get("authorization")))return NextResponse.json({error:"Not found"},{status:404});try{return NextResponse.json({data:await service.evaluateAllSystem()});}catch{return NextResponse.json({error:"Unable to process inventory automation"},{status:500});}}
