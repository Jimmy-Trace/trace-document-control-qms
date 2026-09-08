import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest,AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { ProficiencyTestingError,ProficiencyTestingService } from "@/lib/laboratory/proficiency-testing";

const service=new ProficiencyTestingService();
const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("create_program"),programCode:z.string().max(120),providerName:z.string().max(240),laboratoryTestId:z.string().uuid(),laboratoryMethodId:z.string().uuid()}),
  z.object({action:z.literal("create_event"),proficiencyTestingProgramId:z.string().uuid(),eventCode:z.string().max(120),laboratoryMethodVersionId:z.string().uuid(),dueAt:z.string().datetime().nullish()}),
  z.object({action:z.literal("transition_event"),proficiencyTestingEventId:z.string().uuid(),toStatus:z.enum(["OPEN","CANCELLED","CLOSED"]),reason:z.string().max(2000)}),
  z.object({action:z.literal("submit_result"),proficiencyTestingEventId:z.string().uuid(),reportedResult:z.string().max(10000),evidenceFileId:z.string().uuid().nullish(),reason:z.string().max(2000)}),
  z.object({action:z.literal("score_event"),proficiencyTestingEventId:z.string().uuid(),outcome:z.enum(["SATISFACTORY","UNSATISFACTORY"]),scoreSummary:z.string().max(10000),evidenceFileId:z.string().uuid().nullish(),reason:z.string().max(2000)}),
  z.object({action:z.literal("add_follow_up"),proficiencyTestingEventId:z.string().uuid(),description:z.string().max(10000),evidenceFileId:z.string().uuid().nullish()})
]);

export async function GET(request:NextRequest){
  try{const context=await authenticateRequest(request);return NextResponse.json({data:await service.list(context,context.organizationId)});}
  catch(error){if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});return NextResponse.json({error:"Unable to load proficiency testing"},{status:500});}
}

export async function POST(request:NextRequest){
  try{
    const context=await authenticateRequest(request);
    const input=schema.parse(await request.json());
    if(input.action==="create_program")return NextResponse.json({data:await service.createProgram(context,{organizationId:context.organizationId,...input})},{status:201});
    if(input.action==="create_event")return NextResponse.json({data:await service.createEvent(context,{organizationId:context.organizationId,...input})},{status:201});
    if(input.action==="transition_event")return NextResponse.json({data:await service.transitionEvent(context,{organizationId:context.organizationId,...input})});
    if(input.action==="submit_result")return NextResponse.json({data:await service.submitResult(context,{organizationId:context.organizationId,...input})});
    if(input.action==="score_event")return NextResponse.json({data:await service.scoreEvent(context,{organizationId:context.organizationId,...input})});
    return NextResponse.json({data:await service.addFollowUp(context,{organizationId:context.organizationId,...input})});
  }catch(error){
    if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});
    if(error instanceof z.ZodError)return NextResponse.json({error:"Invalid proficiency testing request"},{status:422});
    if(error instanceof ProficiencyTestingError)return NextResponse.json({error:error.message},{status:409});
    return NextResponse.json({error:"Proficiency testing operation failed"},{status:500});
  }
}
