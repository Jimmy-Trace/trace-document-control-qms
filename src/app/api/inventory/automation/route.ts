import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest,AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { InventoryAutomationService } from "@/lib/inventory/inventory-automation";
import { InventoryValidationError } from "@/lib/inventory/inventory";
const service=new InventoryAutomationService();
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("consume_reservation"),reservationId:z.string().uuid(),reason:z.string().max(2000),occurredAt:z.coerce.date()}),
 z.object({action:z.literal("evaluate")})
]);
export async function POST(request:NextRequest){try{const context=await authenticateRequest(request);const input=schema.parse(await request.json());if(input.action==="consume_reservation")return NextResponse.json({data:await service.consumeReservation(context,{organizationId:context.organizationId,reservationId:input.reservationId,reason:input.reason,occurredAt:input.occurredAt})});return NextResponse.json({data:await service.evaluate(context,context.organizationId)});}catch(error){if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});if(error instanceof z.ZodError)return NextResponse.json({error:"Invalid inventory automation request"},{status:422});if(error instanceof InventoryValidationError)return NextResponse.json({error:error.message},{status:409});return NextResponse.json({error:"Inventory automation operation failed"},{status:500});}}