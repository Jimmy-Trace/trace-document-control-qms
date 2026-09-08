import { NextRequest,NextResponse } from "next/server";
import { authenticateRequest,AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { NotificationPolicyError,NotificationPolicyService } from "@/lib/notifications/policy";

const service=new NotificationPolicyService();

export async function POST(request:NextRequest){
  try{
    const context=await authenticateRequest(request);
    const body=await request.json();
    const operation=body.operation as string;
    if(operation==="create-topic")return NextResponse.json({data:await service.createTopic(context,body)});
    if(operation==="set-preference")return NextResponse.json({data:await service.setPreference(context,body)});
    if(operation==="list-my-preferences")return NextResponse.json({data:await service.listMyPreferences(context,body.organizationId)});
    return NextResponse.json({error:"Unsupported notification policy operation"},{status:400});
  }catch(error){
    if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});
    if(error instanceof NotificationPolicyError)return NextResponse.json({error:error.message},{status:400});
    console.error("Notification policy API failure",error);
    return NextResponse.json({error:"Notification policy operation failed"},{status:500});
  }
}
