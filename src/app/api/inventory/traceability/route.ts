import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest,AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { InventoryTraceabilityService } from "@/lib/inventory/inventory-traceability";
import { InventoryValidationError } from "@/lib/inventory/inventory";
const service=new InventoryTraceabilityService();
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("acceptance_certificate"),lotId:z.string().uuid(),evidenceFileId:z.string().uuid(),summary:z.string().max(5000)}),
 z.object({action:z.literal("equipment_use"),lotId:z.string().uuid(),equipmentId:z.string().uuid(),referenceType:z.string().max(120),referenceId:z.string().max(240),quantityUsed:z.number().positive().nullish(),unitOfMeasure:z.string().max(80).nullish(),usedAt:z.coerce.date()}),
 z.object({action:z.literal("manufacturer_recall"),manufacturer:z.string().max(240),externalReference:z.string().max(240),reason:z.string().max(5000),evidenceFileId:z.string().uuid().nullish(),lotIds:z.array(z.string().uuid()).min(1).max(500)})
]);
export async function POST(request:NextRequest){try{const context=await authenticateRequest(request);const input=schema.parse(await request.json());if(input.action==="acceptance_certificate")return NextResponse.json({data:await service.createAcceptanceCertificate(context,{organizationId:context.organizationId,...input})},{status:201});if(input.action==="equipment_use")return NextResponse.json({data:await service.recordEquipmentUse(context,{organizationId:context.organizationId,...input})},{status:201});return NextResponse.json({data:await service.createRecall(context,{organizationId:context.organizationId,...input})},{status:201});}catch(error){if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});if(error instanceof z.ZodError)return NextResponse.json({error:"Invalid inventory traceability request"},{status:422});if(error instanceof InventoryValidationError)return NextResponse.json({error:error.message},{status:409});return NextResponse.json({error:"Inventory traceability operation failed"},{status:500});}}
