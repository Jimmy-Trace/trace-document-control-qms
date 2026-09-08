import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest,AuthenticationRequiredError } from "@/lib/security/authenticated-request";
import { LaboratoryTestMethodService,LaboratoryTestMethodValidationError } from "@/lib/laboratory/test-methods";

const service=new LaboratoryTestMethodService();
const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("create_test"),testCode:z.string().max(120),name:z.string().max(240),discipline:z.string().max(160).nullish(),specimenType:z.string().max(160).nullish()}),
  z.object({action:z.literal("create_method"),laboratoryTestId:z.string().uuid(),methodCode:z.string().max(120),name:z.string().max(240),platform:z.string().max(240).nullish()}),
  z.object({action:z.literal("create_method_version"),laboratoryMethodId:z.string().uuid(),versionLabel:z.string().max(80),changeSummary:z.string().max(5000),procedureFileId:z.string().uuid().nullish()}),
  z.object({action:z.literal("retire"),entityType:z.enum(["test","method"]),entityId:z.string().uuid(),reason:z.string().max(2000)})
]);

export async function GET(request:NextRequest){
  try{const context=await authenticateRequest(request);return NextResponse.json({data:await service.list(context,context.organizationId)});}
  catch(error){if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});return NextResponse.json({error:"Unable to load laboratory tests and methods"},{status:500});}
}

export async function POST(request:NextRequest){
  try{
    const context=await authenticateRequest(request);
    const input=schema.parse(await request.json());
    if(input.action==="create_test")return NextResponse.json({data:await service.createTest(context,{organizationId:context.organizationId,...input})},{status:201});
    if(input.action==="create_method")return NextResponse.json({data:await service.createMethod(context,{organizationId:context.organizationId,...input})},{status:201});
    if(input.action==="create_method_version")return NextResponse.json({data:await service.createMethodVersion(context,{organizationId:context.organizationId,...input})},{status:201});
    return NextResponse.json({data:await service.retire(context,{organizationId:context.organizationId,...input})});
  }catch(error){
    if(error instanceof AuthenticationRequiredError)return NextResponse.json({error:"Authentication required"},{status:401});
    if(error instanceof z.ZodError)return NextResponse.json({error:"Invalid laboratory test/method request"},{status:422});
    if(error instanceof LaboratoryTestMethodValidationError)return NextResponse.json({error:error.message},{status:409});
    return NextResponse.json({error:"Laboratory test/method operation failed"},{status:500});
  }
}
