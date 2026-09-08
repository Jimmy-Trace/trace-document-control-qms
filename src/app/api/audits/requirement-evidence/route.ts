import { NextRequest,NextResponse } from "next/server";
import { authenticateRequest,AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { RequirementEvidenceError,RequirementEvidenceService } from "@/lib/audits/requirement-evidence";

const service=new RequirementEvidenceService();

export async function POST(request:NextRequest){
  try{
    const context=await authenticateRequest(request);
    const body=await request.json();
    const operation=body.operation as string;
    if(operation==="add-evidence")return NextResponse.json({data:await service.addEvidence(context,body)});
    if(operation==="assess-requirement")return NextResponse.json({data:await service.assessRequirement(context,body)});
    if(operation==="list-coverage")return NextResponse.json({data:await service.listCoverage(context,body)});
    return NextResponse.json({error:"Unsupported requirement evidence operation"},{status:400});
  }catch(error){
    if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});
    if(error instanceof RequirementEvidenceError)return NextResponse.json({error:error.message},{status:400});
    console.error("Requirement evidence API failure",error);
    return NextResponse.json({error:"Requirement evidence operation failed"},{status:500});
  }
}
