import { Prisma } from "@prisma/client";
import { db } from "../db";
import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";

export class QmsNotificationRoutingError extends Error {}
type Criticality="MANDATORY"|"OPTIONAL";
type Channel="IN_APP"|"EMAIL";
type RoutingClient=Pick<Prisma.TransactionClient,"$queryRaw"|"$executeRaw">;
type PublishInput={organizationId:string;topicKey:string;eventKey:string;payload:unknown};

export class QmsNotificationRouter {
  async createRule(context:AuthorizationContext,input:{organizationId:string;notificationTopicPolicyId:string;recipientPermissionKey:string;templateKey:string}){
    requireAuthorization(context,{organizationId:input.organizationId,permission:"notification.policy.manage"});
    const permission=input.recipientPermissionKey.trim(),template=input.templateKey.trim();
    if(!permission||!template)throw new QmsNotificationRoutingError("Recipient permission and template key are required");
    const row=(await db.$queryRaw<Array<{id:string}>>(Prisma.sql`
      INSERT INTO "NotificationRoutingRule" ("organizationId","notificationTopicPolicyId","recipientPermissionKey","templateKey","createdByUserId")
      VALUES (${input.organizationId}::uuid,${input.notificationTopicPolicyId}::uuid,${permission},${template},${context.userId}::uuid)
      RETURNING id`))[0];
    if(!row)throw new QmsNotificationRoutingError("Notification routing rule could not be created");
    await db.auditEvent.create({data:{organizationId:input.organizationId,actorUserId:context.userId,action:"NOTIFICATION_ROUTING_RULE_CREATED",entityType:"NotificationRoutingRule",entityId:row.id,metadata:{notificationTopicPolicyId:input.notificationTopicPolicyId,recipientPermissionKey:permission,templateKey:template}}});
    return row;
  }

  async listRules(context:AuthorizationContext,organizationId:string){
    requireAuthorization(context,{organizationId,permission:"notification.policy.read"});
    return db.$queryRaw(Prisma.sql`
      SELECT r.id,p."topicKey",p.name,p.criticality,r."recipientPermissionKey",r."templateKey",r.active
      FROM "NotificationRoutingRule" r
      JOIN "NotificationTopicPolicy" p ON p."organizationId"=r."organizationId" AND p.id=r."notificationTopicPolicyId"
      WHERE r."organizationId"=${organizationId}::uuid ORDER BY p."topicKey"`);
  }

  private async publishWithClient(client:RoutingClient,input:PublishInput,requireConfigured:boolean){
    const eventKey=input.eventKey.trim(),topicKey=input.topicKey.trim();
    if(!input.organizationId||!topicKey||!eventKey)throw new QmsNotificationRoutingError("Organization, topic, and event key are required");
    const rule=(await client.$queryRaw<Array<{topicPolicyId:string;criticality:Criticality;defaultInApp:boolean;defaultEmail:boolean;recipientPermissionKey:string;templateKey:string}>>(Prisma.sql`
      SELECT p.id AS "topicPolicyId",p.criticality,p."defaultInApp",p."defaultEmail",r."recipientPermissionKey",r."templateKey"
      FROM "NotificationTopicPolicy" p
      JOIN "NotificationRoutingRule" r ON r."organizationId"=p."organizationId" AND r."notificationTopicPolicyId"=p.id AND r.active=true
      WHERE p."organizationId"=${input.organizationId}::uuid AND p."topicKey"=${topicKey}`))[0];
    if(!rule){
      if(requireConfigured)throw new QmsNotificationRoutingError("Active notification routing rule not found");
      return{configured:false,recipients:0,queued:0};
    }
    const recipients=await client.$queryRaw<Array<{userId:string;inAppEnabled:boolean|null;emailEnabled:boolean|null}>>(Prisma.sql`
      SELECT DISTINCT u.id AS "userId",pref."inAppEnabled",pref."emailEnabled"
      FROM "UserRole" ur
      JOIN "User" u ON u."organizationId"=ur."organizationId" AND u.id=ur."userId" AND u.status='ACTIVE'
      JOIN "RolePermission" rp ON rp."roleId"=ur."roleId"
      JOIN "Permission" perm ON perm.id=rp."permissionId" AND perm.key=${rule.recipientPermissionKey}
      LEFT JOIN "NotificationPreference" pref ON pref."organizationId"=u."organizationId" AND pref."userId"=u.id AND pref."notificationTopicPolicyId"=${rule.topicPolicyId}::uuid
      WHERE ur."organizationId"=${input.organizationId}::uuid`);
    let queued=0;
    for(const recipient of recipients){
      const inApp=rule.criticality==="MANDATORY"?(rule.defaultInApp||recipient.inAppEnabled===true):(recipient.inAppEnabled??rule.defaultInApp);
      const email=rule.criticality==="MANDATORY"?(rule.defaultEmail||recipient.emailEnabled===true):(recipient.emailEnabled??rule.defaultEmail);
      const channels:Channel[]=[]; if(inApp)channels.push("IN_APP"); if(email)channels.push("EMAIL");
      for(const channel of channels){
        const inserted=await client.$executeRaw(Prisma.sql`
          INSERT INTO "NotificationOutbox" ("organizationId","eventKey","recipientUserId",channel,"templateKey",payload,"topicKey")
          VALUES (${input.organizationId}::uuid,${eventKey},${recipient.userId}::uuid,${channel}::"NotificationChannel",${rule.templateKey},${JSON.stringify(input.payload)}::jsonb,${topicKey})
          ON CONFLICT ("organizationId","eventKey","recipientUserId",channel) DO NOTHING`);
        queued+=inserted;
      }
    }
    return{configured:true,recipients:recipients.length,queued};
  }

  async publish(input:PublishInput){return db.$transaction(tx=>this.publishWithClient(tx,input,true));}

  async publishConfigured(tx:Prisma.TransactionClient,input:PublishInput){return this.publishWithClient(tx,input,false);}
}
