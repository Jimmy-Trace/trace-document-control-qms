import { createHash } from "node:crypto";
import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { PrismaEquipmentSystemRecallStore } from "@/lib/equipment/system-recall-store";
import { EquipmentRecallValidationError } from "@/lib/equipment/recall";
const store=new PrismaEquipmentSystemRecallStore();
const schema=z.object({organizationId:z.string().uuid(),equipmentId:z.string().uuid(),sourceSystem:z.string().trim().min(1).max(120),sourceKey:z.string().trim().min(1).max(240),reason:z.string().trim().min(1).max(2000),scopeSummary:z.string().trim().min(1).max(5000)});
export async function POST(request:NextRequest){if(!isAuthorizedCronRequest(request.headers.get("authorization")))return NextResponse.json({error:"Not found"},{status:404});try{const raw=await request.json();const input=schema.parse(raw);const payloadHash=createHash("sha256").update(JSON.stringify(raw)).digest("hex");const result=await store.ingest({...input,payloadHash});return NextResponse.json({data:result},{status:result.created?201:200});}catch(error){if(error instanceof z.ZodError)return NextResponse.json({error:"Invalid system equipment recall request"},{status:422});if(error instanceof EquipmentRecallValidationError)return NextResponse.json({error:error.message},{status:409});return NextResponse.json({error:"Unable to ingest system equipment recall"},{status:500});}}
