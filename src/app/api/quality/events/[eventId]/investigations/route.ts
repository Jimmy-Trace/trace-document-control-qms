import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest,AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { PrismaQualityInvestigationStore } from "@/lib/quality/investigations-store";
import { QualityInvestigationService,QualityInvestigationValidationError } from "@/lib/quality/investigations";

const service=new QualityInvestigationService(new PrismaQualityInvestigationStore());
const createSchema=z.object({findings:z.string().max(10000),affectedScope:z.string().max(5000),evidenceSummary:z.string().max(5000).nullish(),rootCauseMethod:z.enum(["FIVE_WHYS","FISHBONE","FAULT_TREE","OTHER"]),rootCause:z.string().max(5000),riskLikelihood:z.number().int().min(1).max(5),riskImpact:z.number().int().min(1).max(5)});

export async function GET(request:NextRequest,{params}:{params:Promise<{eventId:string}>}){try{const context=await authenticateRequest(request);const {eventId}=await params;return NextResponse.json({data:await service.list(context,context.organizationId,eventId)});}catch(error){return respond(error);}}
export async function POST(request:NextRequest,{params}:{params:Promise<{eventId:string}>}){try{const context=await authenticateRequest(request);const {eventId}=await params;const input=createSchema.parse(await request.json());return NextResponse.json({data:await service.create(context,{organizationId:context.organizationId,eventId,...input})},{status:201});}catch(error){return respond(error);}}
function respond(error:unknown){if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});if(error instanceof z.ZodError)return NextResponse.json({error:"Invalid investigation request"},{status:422});if(error instanceof QualityInvestigationValidationError)return NextResponse.json({error:error.message},{status:409});if(error instanceof Error&&error.message==="Access denied")return NextResponse.json({error:"Access denied"},{status:403});return NextResponse.json({error:"Investigation operation failed"},{status:500});}
