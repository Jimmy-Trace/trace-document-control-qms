import { Prisma } from "@prisma/client";
import { db } from "../db";
import { requireAuthorization, type AuthorizationContext } from "../security/authorization";

export class NotificationPolicyError extends Error {}
type Criticality="MANDATORY"|"OPTIONAL";
type Channel="IN_APP"|"EMAIL";

export class NotificationPolicyService {
  async createTopic(context:AuthorizationContext,input:{organizationId:string;topicKey:string;name:string;description:string;criticality:Criticality;defaultInApp:boolean;defaultEmail:boolean}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"notification.policy.manage"});
    const topicKey=input.topicKey.trim(),name=input.name.trim(),description=input.description.trim();
    if(!topicKey||!name||!description)throw new NotificationPolicyError("Topic key, name, and description are required");
    if(!input.defaultInApp&&!input.defaultEmail)throw new NotificationPolicyError("At least one default notification channel is required");
    const row=(await db.$queryRaw<Array<{id:string}>>(Prisma.sql`INSERT INTO "NotificationTopicPolicy" ("organizationId","topicKey",name,description,criticality,"defaultInApp","defaultEmail","createdByUserId") VALUES (${input.organizationId}::uuid,${topicKey},${name},${description},${input.criticality}::"NotificationPolicyCriticality",${input.defaultInApp},${input.defaultEmail},${context.userId}::uuid) RETURNING id`))[0];
    if(!row)throw new NotificationPolicyError("Notification topic could not be created");
    await db.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"NOTIFICATION_TOPIC_CREATED",entityType:"NotificationTopicPolicy",entityId:row.id,metadata:{topicKey,criticality:input.criticality,defaultInApp:input.defaultInApp,defaultEmail:input.defaultEmail}}});
    return row;
  }

  async setPreference(context:AuthorizationContext,input:{organizationId:string;notificationTopicPolicyId:string;inAppEnabled:boolean;emailEnabled:boolean}){
    if(context.userState!=="ACTIVE"||context.organizationId!==input.organizationId)throw new NotificationPolicyError("Access denied");
    return db.$transaction(async tx=>{
      const policy=(await tx.$queryRaw<Array<{criticality:Criticality;defaultInApp:boolean;defaultEmail:boolean}>>(Prisma.sql`SELECT criticality,"defaultInApp","defaultEmail" FROM "NotificationTopicPolicy" WHERE "organizationId"=${input.organizationId}::uuid AND id=${input.notificationTopicPolicyId}::uuid`))[0];
      if(!policy)throw new NotificationPolicyError("Notification topic policy not found");
      if(policy.criticality==="MANDATORY"&&((policy.defaultInApp&&!input.inAppEnabled)||(policy.defaultEmail&&!input.emailEnabled)))throw new NotificationPolicyError("Mandatory notification channels cannot be disabled");
      const previous=(await tx.$queryRaw<Array<{inAppEnabled:boolean;emailEnabled:boolean}>>(Prisma.sql`SELECT "inAppEnabled","emailEnabled" FROM "NotificationPreference" WHERE "organizationId"=${input.organizationId}::uuid AND "userId"=${context.userId}::uuid AND "notificationTopicPolicyId"=${input.notificationTopicPolicyId}::uuid FOR UPDATE`))[0];
      await tx.$executeRaw(Prisma.sql`INSERT INTO "NotificationPreference" ("organizationId","userId","notificationTopicPolicyId","inAppEnabled","emailEnabled","updatedByUserId") VALUES (${input.organizationId}::uuid,${context.userId}::uuid,${input.notificationTopicPolicyId}::uuid,${input.inAppEnabled},${input.emailEnabled},${context.userId}::uuid) ON CONFLICT ("organizationId","userId","notificationTopicPolicyId") DO UPDATE SET "inAppEnabled"=EXCLUDED."inAppEnabled","emailEnabled"=EXCLUDED."emailEnabled","updatedByUserId"=EXCLUDED."updatedByUserId","updatedAt"=CURRENT_TIMESTAMP`);
      await tx.$executeRaw(Prisma.sql`INSERT INTO "NotificationPreferenceChange" ("organizationId","userId","notificationTopicPolicyId","fromInAppEnabled","toInAppEnabled","fromEmailEnabled","toEmailEnabled","actorUserId") VALUES (${input.organizationId}::uuid,${context.userId}::uuid,${input.notificationTopicPolicyId}::uuid,${previous?.inAppEnabled??null},${input.inAppEnabled},${previous?.emailEnabled??null},${input.emailEnabled},${context.userId}::uuid)`);
      await tx.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"NOTIFICATION_PREFERENCE_CHANGED",entityType:"NotificationPreference",entityId:input.notificationTopicPolicyId,metadata:{inAppEnabled:input.inAppEnabled,emailEnabled:input.emailEnabled}}});
      return{inAppEnabled:input.inAppEnabled,emailEnabled:input.emailEnabled};
    });
  }

  async resolveChannels(input:{organizationId:string;userId:string;topicKey:string}):Promise<Channel[]>{
    const rows=await db.$queryRaw<Array<{criticality:Criticality;defaultInApp:boolean;defaultEmail:boolean;inAppEnabled:boolean|null;emailEnabled:boolean|null}>>(Prisma.sql`
      SELECT p.criticality,p."defaultInApp",p."defaultEmail",pref."inAppEnabled",pref."emailEnabled"
      FROM "NotificationTopicPolicy" p
      LEFT JOIN "NotificationPreference" pref ON pref."organizationId"=p."organizationId" AND pref."notificationTopicPolicyId"=p.id AND pref."userId"=${input.userId}::uuid
      WHERE p."organizationId"=${input.organizationId}::uuid AND p."topicKey"=${input.topicKey}`);
    const row=rows[0]; if(!row)throw new NotificationPolicyError("Notification topic policy not found");
    const inApp=row.criticality==="MANDATORY"?(row.defaultInApp||row.inAppEnabled===true):(row.inAppEnabled??row.defaultInApp);
    const email=row.criticality==="MANDATORY"?(row.defaultEmail||row.emailEnabled===true):(row.emailEnabled??row.defaultEmail);
    const channels:Channel[]=[]; if(inApp)channels.push("IN_APP"); if(email)channels.push("EMAIL"); return channels;
  }

  async listMyPreferences(context:AuthorizationContext,organizationId:string){
    if(context.userState!=="ACTIVE"||context.organizationId!==organizationId)throw new NotificationPolicyError("Access denied");
    return db.$queryRaw(Prisma.sql`SELECT p.id,p."topicKey",p.name,p.description,p.criticality,p."defaultInApp",p."defaultEmail",pref."inAppEnabled",pref."emailEnabled" FROM "NotificationTopicPolicy" p LEFT JOIN "NotificationPreference" pref ON pref."organizationId"=p."organizationId" AND pref."notificationTopicPolicyId"=p.id AND pref."userId"=${context.userId}::uuid WHERE p."organizationId"=${organizationId}::uuid ORDER BY p."topicKey"`);
  }
}
