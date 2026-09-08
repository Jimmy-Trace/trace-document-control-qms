import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest,AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { EquipmentService,EquipmentValidationError } from "@/lib/equipment/equipment";
import { PrismaEquipmentStore } from "@/lib/equipment/equipment-store";
const service=new EquipmentService(new PrismaEquipmentStore());
const schema=z.object({status:z.enum(["PLANNED","ACTIVE","OUT_OF_SERVICE","RETIRED"]),reason:z.string().max(1000)});
export async function PATCH(request:NextRequest,{params}:{params:Promise<{equipmentId:string}>}){try{const context=await authenticateRequest(request);const {equipmentId}=await params;const input=schema.parse(await request.json());return NextResponse.json({data:await service.transition(context,{organizationId:context.organizationId,equipmentId,...input})});}catch(error){if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});if(error instanceof z.ZodError)return NextResponse.json({error:"Invalid equipment lifecycle request"},{status:422});if(error instanceof EquipmentValidationError)return NextResponse.json({error:error.message},{status:409});if(error instanceof Error&&error.message==="Access denied")return NextResponse.json({error:"Access denied"},{status:403});return NextResponse.json({error:"Equipment lifecycle operation failed"},{status:500});}}
