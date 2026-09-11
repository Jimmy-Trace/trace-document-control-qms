import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { PrismaQualityCapaStore } from "@/lib/quality/capa-store";
import { QualityCapaService, QualityCapaValidationError } from "@/lib/quality/capa";

const service=new QualityCapaService(new PrismaQualityCapaStore());
const schema=z.discriminatedUnion("operation",[
  z.object({operation:z.literal("COMPLETE"),completionEvidence:z.string().max(5000),completionEvidenceFileId:z.string().uuid().nullish()}),
  z.object({operation:z.literal("VERIFY"),result:z.enum(["PASS","FAIL"]),evidence:z.string().max(5000),evidenceFileId:z.string().uuid().nullish()}),
]);

export async function POST(request:NextRequest,{params}:{params:Promise<{eventId:string;capaActionId:string}>}){try{const context=await authenticateRequest(request);const {eventId,capaActionId}=await params;const input=schema.parse(await request.json());const data=input.operation==="COMPLETE"?await service.complete(context,{organizationId:context.organizationId,eventId,capaActionId,completionEvidence:input.completionEvidence,completionEvidenceFileId:input.completionEvidenceFileId}):await service.verify(context,{organizationId:context.organizationId,eventId,capaActionId,result:input.result,evidence:input.evidence,evidenceFileId:input.evidenceFileId});return NextResponse.json({data});}catch(error){return respond(error);}}
function respond(error:unknown){if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});if(error instanceof z.ZodError)return NextResponse.json({error:"Invalid CAPA lifecycle request"},{status:422});if(error instanceof QualityCapaValidationError)return NextResponse.json({error:error.message},{status:409});if(error instanceof Error&&error.message==="Access denied")return NextResponse.json({error:"Access denied"},{status:403});return NextResponse.json({error:"CAPA lifecycle operation failed"},{status:500});}
