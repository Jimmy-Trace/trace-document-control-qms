import { NextRequest,NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { InventoryRecallControlService } from "@/lib/inventory/inventory-recall-controls";
const service=new InventoryRecallControlService();
export async function POST(request:NextRequest){if(!isAuthorizedCronRequest(request.headers.get("authorization")))return NextResponse.json({error:"Unauthorized"},{status:401});const organizations=await db.organization.findMany({select:{id:true}});let eventsCreated=0,notificationsQueued=0;for(const {id} of organizations){const result=await service.evaluateOrganization(id);eventsCreated+=result.eventsCreated;notificationsQueued+=result.notificationsQueued;}return NextResponse.json({data:{organizationsEvaluated:organizations.length,eventsCreated,notificationsQueued}});}
