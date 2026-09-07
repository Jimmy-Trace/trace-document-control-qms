import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest, AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { PrismaCompetencyStore } from "@/lib/training/competency-store";
import { CompetencyEligibilityError, CompetencyService, CompetencyValidationError } from "@/lib/training/competency";

const service=new CompetencyService(new PrismaCompetencyStore());
const createSchema=z.object({programId:z.string().uuid(),code:z.string().max(80),title:z.string().max(240),method:z.string().max(500).nullish(),required:z.boolean().optional(),sortOrder:z.number().int().nonnegative().optional()});
export async function GET(request:NextRequest){try{const context=await authenticateRequest(request);const programId=new URL(request.url).searchParams.get("programId");if(!programId)return NextResponse.json({error:"programId is required"},{status:422});return NextResponse.json({data:await service.listElements(context,context.organizationId,programId)});}catch(error){return respond(error);}}
export async function POST(request:NextRequest){try{const context=await authenticateRequest(request);const input=createSchema.parse(await request.json());return NextResponse.json({data:await service.createElement(context,{organizationId:context.organizationId,...input})},{status:201});}catch(error){return respond(error);}}
function respond(error:unknown){if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});if(error instanceof z.ZodError)return NextResponse.json({error:"Invalid competency element request"},{status:422});if(error instanceof CompetencyValidationError||error instanceof CompetencyEligibilityError)return NextResponse.json({error:error.message},{status:409});if(error instanceof Error&&error.message==="Access denied")return NextResponse.json({error:"Access denied"},{status:403});return NextResponse.json({error:"Competency element operation failed"},{status:500});}
