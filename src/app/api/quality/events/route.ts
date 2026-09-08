import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { PrismaQualityEventStore } from "@/lib/quality/events-store";
import { QualityEventService, QualityEventValidationError } from "@/lib/quality/events";

const service=new QualityEventService(new PrismaQualityEventStore());
const statusSchema=z.enum(["OPEN","INVESTIGATING","ACTION_REQUIRED","VERIFICATION","CLOSED"]);
const createSchema=z.object({
  type:z.enum(["NONCONFORMANCE","PATIENT_COMPLAINT","PHYSICIAN_COMPLAINT","SPECIMEN_PROBLEM","TESTING_ERROR","QC_FAILURE","PT_FAILURE","EQUIPMENT_FAILURE","REPORTING_ERROR","BILLING_ADMINISTRATIVE","SAFETY_EVENT","PERSONNEL_EVENT","DEVIATION","OTHER"]),
  severity:z.enum(["LOW","MEDIUM","HIGH","CRITICAL"]),
  source:z.enum(["MANUAL","SYSTEM"]).optional(),
  summary:z.string().max(240), description:z.string().max(5000).nullish(), discoveredAt:z.coerce.date(), ownerUserId:z.string().uuid().nullish(), dueAt:z.coerce.date().nullish(),
});

export async function GET(request:NextRequest){
  try{const context=await authenticateRequest(request);const raw=new URL(request.url).searchParams.get("status");const status=raw?statusSchema.parse(raw):undefined;return NextResponse.json({data:await service.listEvents(context,context.organizationId,status)});}catch(error){return respond(error);}
}
export async function POST(request:NextRequest){
  try{const context=await authenticateRequest(request);const input=createSchema.parse(await request.json());return NextResponse.json({data:await service.createEvent(context,{organizationId:context.organizationId,...input})},{status:201});}catch(error){return respond(error);}
}
function respond(error:unknown){if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});if(error instanceof z.ZodError)return NextResponse.json({error:"Invalid quality event request"},{status:422});if(error instanceof QualityEventValidationError)return NextResponse.json({error:error.message},{status:409});if(error instanceof Error&&error.message==="Access denied")return NextResponse.json({error:"Access denied"},{status:403});return NextResponse.json({error:"Quality event operation failed"},{status:500});}
