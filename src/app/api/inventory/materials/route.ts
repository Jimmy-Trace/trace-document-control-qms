import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest,AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { InventoryService,InventoryValidationError } from "@/lib/inventory/inventory";
import { PrismaInventoryStore } from "@/lib/inventory/inventory-store";
const service=new InventoryService(new PrismaInventoryStore());
const schema=z.object({materialNumber:z.string().max(80),name:z.string().max(240),manufacturer:z.string().max(240).nullish(),catalogNumber:z.string().max(240).nullish(),description:z.string().max(5000).nullish()});
export async function GET(request:NextRequest){try{const context=await authenticateRequest(request);return NextResponse.json({data:await service.listMaterials(context,context.organizationId)});}catch(error){return respond(error);}}
export async function POST(request:NextRequest){try{const context=await authenticateRequest(request);const input=schema.parse(await request.json());return NextResponse.json({data:await service.createMaterial(context,{organizationId:context.organizationId,...input})},{status:201});}catch(error){return respond(error);}}
function respond(error:unknown){if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});if(error instanceof z.ZodError)return NextResponse.json({error:"Invalid material request"},{status:422});if(error instanceof InventoryValidationError)return NextResponse.json({error:error.message},{status:409});return NextResponse.json({error:"Material operation failed"},{status:500});}