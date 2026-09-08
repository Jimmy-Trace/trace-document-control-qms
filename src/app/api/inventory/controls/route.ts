import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest,AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { InventoryControlsService } from "@/lib/inventory/inventory-controls";
import { InventoryValidationError } from "@/lib/inventory/inventory";
const service=new InventoryControlsService();
const schema=z.discriminatedUnion("action",[
 z.object({action:z.literal("assign_barcode"),lotId:z.string().uuid(),barcodeValue:z.string().max(240)}),
 z.object({action:z.literal("reserve"),lotId:z.string().uuid(),siteId:z.string().uuid().nullish(),departmentId:z.string().uuid().nullish(),quantity:z.number().positive(),unitOfMeasure:z.string().max(80),referenceKey:z.string().max(240),reason:z.string().max(2000)}),
 z.object({action:z.literal("release_reservation"),reservationId:z.string().uuid(),reason:z.string().max(2000)}),
 z.object({action:z.literal("set_low_stock_threshold"),materialId:z.string().uuid(),siteId:z.string().uuid().nullish(),departmentId:z.string().uuid().nullish(),thresholdQuantity:z.number().nonnegative(),unitOfMeasure:z.string().max(80)}),
 z.object({action:z.literal("evaluate_low_stock")})
]);
export async function GET(request:NextRequest){try{const context=await authenticateRequest(request);const barcode=request.nextUrl.searchParams.get("barcode");if(!barcode)return NextResponse.json({error:"Barcode is required"},{status:422});return NextResponse.json({data:await service.resolveBarcode(context,context.organizationId,barcode)});}catch(error){return respond(error);}}
export async function POST(request:NextRequest){try{const context=await authenticateRequest(request);const input=schema.parse(await request.json());if(input.action==="assign_barcode")return NextResponse.json({data:await service.assignBarcode(context,{organizationId:context.organizationId,...input})});if(input.action==="reserve")return NextResponse.json({data:await service.reserve(context,{organizationId:context.organizationId,...input})},{status:201});if(input.action==="release_reservation")return NextResponse.json({data:await service.releaseReservation(context,{organizationId:context.organizationId,...input})});if(input.action==="set_low_stock_threshold")return NextResponse.json({data:await service.upsertLowStockThreshold(context,{organizationId:context.organizationId,...input})});return NextResponse.json({data:await service.evaluateLowStock(context,context.organizationId)});}catch(error){return respond(error);}}
function respond(error:unknown){if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});if(error instanceof z.ZodError)return NextResponse.json({error:"Invalid inventory control request"},{status:422});if(error instanceof InventoryValidationError)return NextResponse.json({error:error.message},{status:409});return NextResponse.json({error:"Inventory control operation failed"},{status:500});}
