import { NextRequest,NextResponse } from "next/server";
import { authenticateRequest,AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { LaboratoryValidationError,LaboratoryValidationService } from "@/lib/laboratory/validation";

const service=new LaboratoryValidationService();

export async function POST(request:NextRequest){
  try{
    const context=await authenticateRequest(request);
    const body=await request.json();
    const operation=body.operation as string;
    if(operation==="create-project") return NextResponse.json({data:await service.createProject(context,body)});
    if(operation==="add-criterion") return NextResponse.json({data:await service.addCriterion(context,body)});
    if(operation==="transition-project") return NextResponse.json({data:await service.transitionProject(context,body)});
    if(operation==="record-result") return NextResponse.json({data:await service.recordResult(context,body)});
    if(operation==="activate-method") return NextResponse.json({data:await service.activateValidatedMethod(context,body)});
    return NextResponse.json({error:"Unsupported validation operation"},{status:400});
  }catch(error){
    if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});
    if(error instanceof LaboratoryValidationError)return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json({error:"Laboratory validation operation failed"},{status:500});
  }
}
