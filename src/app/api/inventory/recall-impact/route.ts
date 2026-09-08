import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest,AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { InventoryRecallImpactService } from "@/lib/inventory/inventory-recall-impact";
const service=new InventoryRecallImpactService();
export async function GET(request:NextRequest){try{const context=await authenticateRequest(request);const materialRecallId=request.nextUrl.searchParams.get("materialRecallId")||undefined;if(materialRecallId&&!z.string().uuid().safeParse(materialRecallId).success)return NextResponse.json({error:"Invalid recall identifier"},{status:422});return NextResponse.json({data:await service.list(context,context.organizationId,materialRecallId)});}catch(error){if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});return NextResponse.json({error:"Unable to load recall impact"},{status:500});}}
