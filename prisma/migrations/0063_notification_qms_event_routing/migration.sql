CREATE TABLE "NotificationRoutingRule" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "notificationTopicPolicyId" uuid NOT NULL,
  "recipientPermissionKey" text NOT NULL,
  "templateKey" text NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationRoutingRule_policy_fkey" FOREIGN KEY ("organizationId","notificationTopicPolicyId") REFERENCES "NotificationTopicPolicy"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "NotificationRoutingRule_permission_fkey" FOREIGN KEY ("recipientPermissionKey") REFERENCES "Permission"("key") ON DELETE RESTRICT,
  CONSTRAINT "NotificationRoutingRule_actor_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "NotificationRoutingRule_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "NotificationRoutingRule_org_topic_key" UNIQUE ("organizationId","notificationTopicPolicyId"),
  CONSTRAINT "NotificationRoutingRule_permission_check" CHECK (length(btrim("recipientPermissionKey"))>0),
  CONSTRAINT "NotificationRoutingRule_template_check" CHECK (length(btrim("templateKey"))>0)
);

CREATE INDEX "NotificationRoutingRule_org_active_idx" ON "NotificationRoutingRule"("organizationId","active");

CREATE OR REPLACE FUNCTION guard_notification_routing_rule_policy() RETURNS trigger AS $$
DECLARE has_channel boolean;
BEGIN
  SELECT ("defaultInApp" OR "defaultEmail") INTO has_channel FROM "NotificationTopicPolicy"
  WHERE "organizationId"=NEW."organizationId" AND id=NEW."notificationTopicPolicyId";
  IF has_channel IS DISTINCT FROM true THEN RAISE EXCEPTION 'Notification routing rule requires a valid topic policy with a delivery channel'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "NotificationRoutingRule_policy_guard" BEFORE INSERT OR UPDATE ON "NotificationRoutingRule" FOR EACH ROW EXECUTE FUNCTION guard_notification_routing_rule_policy();
