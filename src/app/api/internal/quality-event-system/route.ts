import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { PrismaQualityEventSystemIntakeStore } from "@/lib/quality/system-intake-store";
import { QualityEventValidationError } from "@/lib/quality/events";

const store=new PrismaQualityEventSystemIntakeStore();
const schema=z.object({
  organizationId:z.string().uuid(),
  sourceSystem:z.string().trim().min(1).max(120),
  sourceKey:z.string().trim().min(1).max(240),
  reportedByUserId:z.string().uuid(),
  ownerUserId:z.string().uuid().nullish(),
  type:z.enum(["NONCONFORMANCE","PATIENT_COMPLAINT","PHYSICIAN_COMPLAINT","SPECIMEN_PROBLEM","TESTING_ERROR","QC_FAILURE","PT_FAILURE","EQUIPMENT_FAILURE","REPORTING_ERROR","BILLING_ADMINISTRATIVE","SAFETY_EVENT","PERSONNEL_EVENT","DEVIATION","OTHER"]),
  severity:z.enum(["LOW","MEDIUM","HIGH","CRITICAL"]),
  summary:z.string().trim().min(1).max(240),
  description:z.string().trim().max(5000).nullish(),
  discoveredAt:z.coerce.date(),
  dueAt:z.coerce.date().nullish(),
});

export async function POST(request:NextRequest){
  if(!isAuthorizedCronRequest(request.headers.get("authorization")))return NextResponse.json({error:"Not found"},{status:404});
  try{
    const raw=await request.json();
    const input=schema.parse(raw);
    const payloadHash=createHash("sha256").update(JSON.stringify(raw)).digest("hex");
    const result=await store.ingest({
      ...input,
      description:input.description??null,
      ownerUserId:input.ownerUserId??null,
      dueAt:input.dueAt??null,
      payloadHash,
    });
    return NextResponse.json({data:result},{status:result.created?201:200});
  }catch(error){
    if(error instanceof z.ZodError)return NextResponse.json({error:"Invalid system quality event request"},{status:422});
    if(error instanceof QualityEventValidationError)return NextResponse.json({error:error.message},{status:409});
    return NextResponse.json({error:"Unable to ingest system quality event"},{status:500});
  }
}
