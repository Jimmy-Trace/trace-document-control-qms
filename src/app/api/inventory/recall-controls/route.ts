import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest,AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { InventoryRecallControlService } from "@/lib/inventory/inventory-recall-controls";
import { InventoryValidationError } from "@/lib/inventory/inventory";
const service=new InventoryRecallControlService();
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("disposition"),impactId:z.string().uuid(),disposition:z.enum(["NO_IMPACT","POTENTIAL_IMPACT","CONFIRMED_IMPACT"]),reason:z.string().max(5000)}),
 z.object({action:z.literal("close"),impactId:z.string().uuid(),reason:z.string().max(5000)}),
 z.object({action:z.literal("evaluate")})
]);
export async function POST(request:NextRequest){try{const context=await authenticateRequest(request);const input=schema.parse(await request.json());if(input.action==="disposition")return NextResponse.json({data:await service.dispositionImpact(context,{organizationId:context.organizationId,...input})},{status:201});if(input.action==="close")return NextResponse.json({data:await service.closeImpact(context,{organizationId:context.organizationId,...input})},{status:201});return NextResponse.json({data:await service.evaluateEscalations(context,context.organizationId)});}catch(error){if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});if(error instanceof z.ZodError)return NextResponse.json({error:"Invalid recall control request"},{status:422});if(error instanceof InventoryValidationError)return NextResponse.json({error:error.message},{status:409});return NextResponse.json({error:"Recall control operation failed"},{status:500});}}
