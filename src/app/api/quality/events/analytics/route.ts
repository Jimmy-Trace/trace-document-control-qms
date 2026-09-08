import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { PrismaQualityEventAnalyticsStore } from "@/lib/quality/analytics-store";
import { QualityEventAnalyticsService } from "@/lib/quality/analytics";

const service=new QualityEventAnalyticsService(new PrismaQualityEventAnalyticsStore());

export async function GET(request:NextRequest){
  try{
    const context=await authenticateRequest(request);
    const raw=new URL(request.url).searchParams.get("months")??"12";
    const months=Number(raw);
    return NextResponse.json({data:await service.report(context,context.organizationId,months)});
  }catch(error){
    if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});
    if(error instanceof Error&&error.message==="Access denied")return NextResponse.json({error:"Access denied"},{status:403});
    if(error instanceof Error&&error.message==="Invalid analytics window")return NextResponse.json({error:error.message},{status:422});
    return NextResponse.json({error:"Unable to load quality event analytics"},{status:500});
  }
}
