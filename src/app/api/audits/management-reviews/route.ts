import { NextRequest,NextResponse } from "next/server";
import { authenticateRequest,AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { ManagementReviewError,ManagementReviewService } from "@/lib/audits/management-reviews";

const service=new ManagementReviewService();

export async function POST(request:NextRequest){
  try{
    const context=await authenticateRequest(request);
    const body=await request.json();
    const operation=body.operation as string;
    if(operation==="create-review")return NextResponse.json({data:await service.createReview(context,body)});
    if(operation==="add-input")return NextResponse.json({data:await service.addInput(context,body)});
    if(operation==="add-decision")return NextResponse.json({data:await service.addDecision(context,body)});
    if(operation==="add-action")return NextResponse.json({data:await service.addAction(context,body)});
    if(operation==="transition-review")return NextResponse.json({data:await service.transitionReview(context,body)});
    if(operation==="transition-action")return NextResponse.json({data:await service.transitionAction(context,body)});
    return NextResponse.json({error:"Unsupported management review operation"},{status:400});
  }catch(error){
    if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});
    if(error instanceof ManagementReviewError)return NextResponse.json({error:error.message},{status:400});
    console.error("Management review API failure",error);
    return NextResponse.json({error:"Management review operation failed"},{status:500});
  }
}
