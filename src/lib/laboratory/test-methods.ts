import { Prisma } from "@prisma/client";
import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";
import { db } from "../db";

export class LaboratoryTestMethodValidationError extends Error {}

export class LaboratoryTestMethodService {
  async list(context:AuthorizationContext,organizationId:string){
    requireAuthorization(context,{organizationId,permission:"lab_test.read"});
    const tests=await db.$queryRaw(Prisma.sql`SELECT id,"testCode",name,discipline,"specimenType",status,"createdAt","updatedAt" FROM "LaboratoryTest" WHERE "organizationId"=${organizationId}::uuid ORDER BY "testCode"`);
    const methods=await db.$queryRaw(Prisma.sql`SELECT id,"laboratoryTestId","methodCode",name,platform,status,"createdAt","updatedAt" FROM "LaboratoryMethod" WHERE "organizationId"=${organizationId}::uuid ORDER BY "methodCode"`);
    return{tests,methods};
  }

  async createTest(context:AuthorizationContext,input:{organizationId:string;testCode:string;name:string;discipline?:string|null;specimenType?:string|null}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"lab_test.manage"});
    const testCode=input.testCode.trim(),name=input.name.trim();
    if(!testCode||!name)throw new LaboratoryTestMethodValidationError("Test code and name are required");
    return db.$transaction(async tx=>{
      const row=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`INSERT INTO "LaboratoryTest" ("organizationId","testCode",name,discipline,"specimenType","createdByUserId") VALUES (${input.organizationId}::uuid,${testCode},${name},${input.discipline?.trim()||null},${input.specimenType?.trim()||null},${context.userId}::uuid) RETURNING id`))[0];
      if(!row)throw new LaboratoryTestMethodValidationError("Laboratory test could not be created");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"LABORATORY_TEST_CREATED",entityType:"LaboratoryTest",entityId:row.id,metadata:{testCode,name,status:"DRAFT"}}});
      return row;
    });
  }

  async createMethod(context:AuthorizationContext,input:{organizationId:string;laboratoryTestId:string;methodCode:string;name:string;platform?:string|null}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"lab_test.manage"});
    const methodCode=input.methodCode.trim(),name=input.name.trim();
    if(!methodCode||!name)throw new LaboratoryTestMethodValidationError("Method code and name are required");
    return db.$transaction(async tx=>{
      const test=(await tx.$queryRaw<Array<{id:string;status:string}>>(Prisma.sql`SELECT id,status FROM "LaboratoryTest" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.laboratoryTestId}::uuid`))[0];
      if(!test||test.status==="RETIRED")throw new LaboratoryTestMethodValidationError("Active draft laboratory test identity not found");
      const row=(await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`INSERT INTO "LaboratoryMethod" ("organizationId","laboratoryTestId","methodCode",name,platform,"createdByUserId") VALUES (${input.organizationId}::uuid,${input.laboratoryTestId}::uuid,${methodCode},${name},${input.platform?.trim()||null},${context.userId}::uuid) RETURNING id`))[0];
      if(!row)throw new LaboratoryTestMethodValidationError("Laboratory method could not be created");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"LABORATORY_METHOD_CREATED",entityType:"LaboratoryMethod",entityId:row.id,metadata:{laboratoryTestId:input.laboratoryTestId,methodCode,name,status:"DRAFT"}}});
      return row;
    });
  }

  async createMethodVersion(context:AuthorizationContext,input:{organizationId:string;laboratoryMethodId:string;versionLabel:string;changeSummary:string;procedureFileId?:string|null}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"lab_test.manage"});
    const versionLabel=input.versionLabel.trim(),changeSummary=input.changeSummary.trim();
    if(!versionLabel||!changeSummary)throw new LaboratoryTestMethodValidationError("Version label and change summary are required");
    return db.$transaction(async tx=>{
      const method=(await tx.$queryRaw<Array<{id:string;status:string}>>(Prisma.sql`SELECT id,status FROM "LaboratoryMethod" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.laboratoryMethodId}::uuid`))[0];
      if(!method||method.status==="RETIRED")throw new LaboratoryTestMethodValidationError("Laboratory method not found or retired");
      if(input.procedureFileId){
        const file=(await tx.$queryRaw<Array<{id:string;status:string}>>(Prisma.sql`SELECT id,status FROM "File" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.procedureFileId}::uuid`))[0];
        if(!file||file.status!=="AVAILABLE")throw new LaboratoryTestMethodValidationError("Method procedure evidence must be an AVAILABLE same-tenant file");
      }
      const row=(await tx.$queryRaw<Array<{id:string;createdAt:Date}>>(Prisma.sql`INSERT INTO "LaboratoryMethodVersion" ("organizationId","laboratoryMethodId","versionLabel","changeSummary","procedureFileId","createdByUserId") VALUES (${input.organizationId}::uuid,${input.laboratoryMethodId}::uuid,${versionLabel},${changeSummary},${input.procedureFileId??null}::uuid,${context.userId}::uuid) RETURNING id,"createdAt"`))[0];
      if(!row)throw new LaboratoryTestMethodValidationError("Laboratory method version could not be created");
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"LABORATORY_METHOD_VERSION_CREATED",entityType:"LaboratoryMethod",entityId:input.laboratoryMethodId,metadata:{methodVersionId:row.id,versionLabel,procedureFileId:input.procedureFileId??null}}});
      return row;
    });
  }

  async retire(context:AuthorizationContext,input:{organizationId:string;entityType:"test"|"method";entityId:string;reason:string}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"lab_test.manage"});
    const reason=input.reason.trim();
    if(!reason)throw new LaboratoryTestMethodValidationError("Retirement reason is required");
    return db.$transaction(async tx=>{
      const current=input.entityType==="test"
        ?(await tx.$queryRaw<Array<{status:"DRAFT"|"ACTIVE"|"RETIRED"}>>(Prisma.sql`SELECT status FROM "LaboratoryTest" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.entityId}::uuid FOR UPDATE`))[0]
        :(await tx.$queryRaw<Array<{status:"DRAFT"|"ACTIVE"|"RETIRED"}>>(Prisma.sql`SELECT status FROM "LaboratoryMethod" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.entityId}::uuid FOR UPDATE`))[0];
      if(!current)throw new LaboratoryTestMethodValidationError("Laboratory entity not found");
      if(current.status==="RETIRED")throw new LaboratoryTestMethodValidationError("Laboratory entity is already retired");
      if(input.entityType==="test"){
        await tx.$executeRaw(Prisma.sql`UPDATE "LaboratoryTest" SET status='RETIRED',"updatedAt"=CURRENT_TIMESTAMP WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.entityId}::uuid`);
        await tx.$executeRaw(Prisma.sql`INSERT INTO "LaboratoryTestStatusChange" ("organizationId","laboratoryTestId","fromStatus","toStatus",reason,"actorUserId") VALUES (${input.organizationId}::uuid,${input.entityId}::uuid,${current.status}::"LaboratoryTestStatus",'RETIRED',${reason},${context.userId}::uuid)`);
      }else{
        await tx.$executeRaw(Prisma.sql`UPDATE "LaboratoryMethod" SET status='RETIRED',"updatedAt"=CURRENT_TIMESTAMP WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.entityId}::uuid`);
        await tx.$executeRaw(Prisma.sql`INSERT INTO "LaboratoryMethodStatusChange" ("organizationId","laboratoryMethodId","fromStatus","toStatus",reason,"actorUserId") VALUES (${input.organizationId}::uuid,${input.entityId}::uuid,${current.status}::"LaboratoryMethodStatus",'RETIRED',${reason},${context.userId}::uuid)`);
      }
      const entityType=input.entityType==="test"?"LaboratoryTest":"LaboratoryMethod";
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:input.entityType==="test"?"LABORATORY_TEST_RETIRED":"LABORATORY_METHOD_RETIRED",entityType,entityId:input.entityId,reason,metadata:{fromStatus:current.status,toStatus:"RETIRED"}}});
      return{status:"RETIRED" as const};
    });
  }
}
