import { NextRequest,NextResponse } from "next/server";
import { authenticateRequest,AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { ReportingError } from "@/lib/reporting/reporting";
import { FinalizedReportService } from "@/lib/reporting/finalized-reports";

const service=new FinalizedReportService();

export async function GET(request:NextRequest){
  try{
    const context=await authenticateRequest(request);
    const finalizedReportId=request.nextUrl.searchParams.get("finalizedReportId");
    if(finalizedReportId){
      const exported=await service.exportCsv(context,{organizationId:context.organizationId,finalizedReportId});
      return new NextResponse(exported.csv,{status:200,headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="${exported.filename}"`}});
    }
    return NextResponse.json({data:await service.list(context,context.organizationId)});
  }catch(error){
    if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});
    if(error instanceof ReportingError)return NextResponse.json({error:error.message},{status:400});
    if(error instanceof Error&&error.message==="Access denied")return NextResponse.json({error:"Access denied"},{status:403});
    console.error("Finalized reporting API failure",error);
    return NextResponse.json({error:"Finalized reporting operation failed"},{status:500});
  }
}

export async function POST(request:NextRequest){
  try{
    const context=await authenticateRequest(request);
    const body=await request.json();
    if(body.operation!=="finalize-execution")return NextResponse.json({error:"Unsupported finalized reporting operation"},{status:400});
    return NextResponse.json({data:await service.finalizeExecution(context,{organizationId:context.organizationId,reportExecutionId:body.reportExecutionId})});
  }catch(error){
    if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});
    if(error instanceof ReportingError)return NextResponse.json({error:error.message},{status:400});
    if(error instanceof Error&&error.message==="Access denied")return NextResponse.json({error:"Access denied"},{status:403});
    console.error("Finalized reporting API failure",error);
    return NextResponse.json({error:"Finalized reporting operation failed"},{status:500});
  }
}
