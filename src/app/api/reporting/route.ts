import { NextRequest,NextResponse } from "next/server";
import { authenticateRequest,AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { ReportingError,ReportingService } from "@/lib/reporting/reporting";

const service=new ReportingService();

export async function GET(request:NextRequest){
  try{
    const context=await authenticateRequest(request);
    const reportDefinitionId=request.nextUrl.searchParams.get("reportDefinitionId");
    if(reportDefinitionId)return NextResponse.json({data:await service.listExecutions(context,context.organizationId,reportDefinitionId)});
    return NextResponse.json({data:await service.listDefinitions(context,context.organizationId)});
  }catch(error){
    if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});
    if(error instanceof ReportingError)return NextResponse.json({error:error.message},{status:400});
    if(error instanceof Error&&error.message==="Access denied")return NextResponse.json({error:"Access denied"},{status:403});
    console.error("Reporting API failure",error);
    return NextResponse.json({error:"Reporting operation failed"},{status:500});
  }
}

export async function POST(request:NextRequest){
  try{
    const context=await authenticateRequest(request);
    const body=await request.json();
    if(body.operation==="create-definition")return NextResponse.json({data:await service.createDefinition(context,{...body,organizationId:context.organizationId})});
    if(body.operation==="execute")return NextResponse.json({data:await service.execute(context,{...body,organizationId:context.organizationId})});
    return NextResponse.json({error:"Unsupported reporting operation"},{status:400});
  }catch(error){
    if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});
    if(error instanceof ReportingError)return NextResponse.json({error:error.message},{status:400});
    if(error instanceof Error&&error.message==="Access denied")return NextResponse.json({error:"Access denied"},{status:403});
    console.error("Reporting API failure",error);
    return NextResponse.json({error:"Reporting operation failed"},{status:500});
  }
}
