import { NextRequest,NextResponse } from "next/server";
import { authenticateRequest,AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { EquipmentOperationsService } from "@/lib/equipment/operations";
import { PrismaEquipmentOperationsStore } from "@/lib/equipment/operations-store";
const service=new EquipmentOperationsService(new PrismaEquipmentOperationsStore());
export async function GET(request:NextRequest){try{const context=await authenticateRequest(request);const [analytics,equipment]=await Promise.all([service.analytics(context,context.organizationId),service.workspace(context,context.organizationId)]);return NextResponse.json({data:{analytics,equipment}});}catch(error){if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});if(error instanceof Error&&error.message==="Access denied")return NextResponse.json({error:"Access denied"},{status:403});return NextResponse.json({error:"Equipment operations could not be loaded"},{status:500});}}
