import { NextRequest,NextResponse } from "next/server";
import { authenticateRequest,AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { QmsNotificationRouter,QmsNotificationRoutingError } from "@/lib/notifications/qms-router";

const router=new QmsNotificationRouter();

export async function POST(request:NextRequest){
  try{
    const context=await authenticateRequest(request);
    const body=await request.json();
    const operation=body.operation as string;
    if(operation==="create-rule")return NextResponse.json({data:await router.createRule(context,body)});
    if(operation==="list-rules")return NextResponse.json({data:await router.listRules(context,body.organizationId)});
    return NextResponse.json({error:"Unsupported notification routing operation"},{status:400});
  }catch(error){
    if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});
    if(error instanceof QmsNotificationRoutingError)return NextResponse.json({error:error.message},{status:400});
    console.error("Notification routing API failure",error);
    return NextResponse.json({error:"Notification routing operation failed"},{status:500});
  }
}
