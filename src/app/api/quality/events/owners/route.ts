import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { PrismaQualityEventStore } from "@/lib/quality/events-store";
import { QualityEventService } from "@/lib/quality/events";

const service=new QualityEventService(new PrismaQualityEventStore());

export async function GET(request:NextRequest){
  try{
    const context=await authenticateRequest(request);
    return NextResponse.json({data:await service.listAssignableOwners(context,context.organizationId)});
  }catch(error){
    if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});
    if(error instanceof Error&&error.message==="Access denied")return NextResponse.json({error:"Access denied"},{status:403});
    return NextResponse.json({error:"Quality event owner options could not be loaded"},{status:500});
  }
}
