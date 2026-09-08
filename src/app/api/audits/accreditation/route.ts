import { NextRequest,NextResponse } from "next/server";
import { authenticateRequest,AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { AuditAccreditationError,AuditAccreditationService } from "@/lib/audits/accreditation";

const service=new AuditAccreditationService();

export async function POST(request:NextRequest){
  try{
    const context=await authenticateRequest(request);
    const body=await request.json();
    const operation=body.operation as string;
    if(operation==="create-program")return NextResponse.json({data:await service.createProgram(context,body)});
    if(operation==="add-requirement")return NextResponse.json({data:await service.addRequirement(context,body)});
    if(operation==="create-audit")return NextResponse.json({data:await service.createAudit(context,body)});
    if(operation==="add-finding")return NextResponse.json({data:await service.addFinding(context,body)});
    if(operation==="transition-audit")return NextResponse.json({data:await service.transitionAudit(context,body)});
    if(operation==="transition-finding")return NextResponse.json({data:await service.transitionFinding(context,body)});
    return NextResponse.json({error:"Unsupported audit/accreditation operation"},{status:400});
  }catch(error){
    if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});
    if(error instanceof AuditAccreditationError)return NextResponse.json({error:error.message},{status:400});
    console.error("Audit/accreditation API failure",error);
    return NextResponse.json({error:"Audit/accreditation operation failed"},{status:500});
  }
}
