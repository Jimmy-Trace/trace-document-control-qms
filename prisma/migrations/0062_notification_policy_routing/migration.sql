CREATE TYPE "NotificationPolicyCriticality" AS ENUM ('MANDATORY','OPTIONAL');

CREATE TABLE "NotificationTopicPolicy" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "topicKey" text NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "criticality" "NotificationPolicyCriticality" NOT NULL DEFAULT 'OPTIONAL',
  "defaultInApp" boolean NOT NULL DEFAULT true,
  "defaultEmail" boolean NOT NULL DEFAULT false,
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationTopicPolicy_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "NotificationTopicPolicy_actor_fkey" FOREIGN KEY ("organizationId","createdByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "NotificationTopicPolicy_org_id_key" UNIQUE ("organizationId","id"),
  CONSTRAINT "NotificationTopicPolicy_org_topic_key" UNIQUE ("organizationId","topicKey"),
  CONSTRAINT "NotificationTopicPolicy_topic_check" CHECK (length(btrim("topicKey"))>0),
  CONSTRAINT "NotificationTopicPolicy_name_check" CHECK (length(btrim("name"))>0),
  CONSTRAINT "NotificationTopicPolicy_description_check" CHECK (length(btrim("description"))>0),
  CONSTRAINT "NotificationTopicPolicy_channel_check" CHECK ("defaultInApp" OR "defaultEmail")
);

CREATE TABLE "NotificationPreference" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "userId" uuid NOT NULL,
  "notificationTopicPolicyId" uuid NOT NULL,
  "inAppEnabled" boolean NOT NULL,
  "emailEnabled" boolean NOT NULL,
  "updatedByUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationPreference_policy_fkey" FOREIGN KEY ("organizationId","notificationTopicPolicyId") REFERENCES "NotificationTopicPolicy"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "NotificationPreference_user_fkey" FOREIGN KEY ("organizationId","userId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "NotificationPreference_actor_fkey" FOREIGN KEY ("organizationId","updatedByUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "NotificationPreference_org_user_topic_key" UNIQUE ("organizationId","userId","notificationTopicPolicyId")
);

CREATE TABLE "NotificationPreferenceChange" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "userId" uuid NOT NULL,
  "notificationTopicPolicyId" uuid NOT NULL,
  "fromInAppEnabled" boolean,
  "toInAppEnabled" boolean NOT NULL,
  "fromEmailEnabled" boolean,
  "toEmailEnabled" boolean NOT NULL,
  "actorUserId" uuid NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationPreferenceChange_policy_fkey" FOREIGN KEY ("organizationId","notificationTopicPolicyId") REFERENCES "NotificationTopicPolicy"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "NotificationPreferenceChange_user_fkey" FOREIGN KEY ("organizationId","userId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT,
  CONSTRAINT "NotificationPreferenceChange_actor_fkey" FOREIGN KEY ("organizationId","actorUserId") REFERENCES "User"("organizationId","id") ON DELETE RESTRICT
);

ALTER TABLE "NotificationOutbox" ADD COLUMN "topicKey" text;
CREATE INDEX "NotificationOutbox_org_topic_idx" ON "NotificationOutbox"("organizationId","topicKey","createdAt" DESC);
CREATE INDEX "NotificationPreference_org_user_idx" ON "NotificationPreference"("organizationId","userId");

CREATE OR REPLACE FUNCTION reject_notification_preference_change_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Notification preference history is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "NotificationPreferenceChange_append_only" BEFORE UPDATE OR DELETE ON "NotificationPreferenceChange" FOR EACH ROW EXECUTE FUNCTION reject_notification_preference_change_mutation();

CREATE OR REPLACE FUNCTION guard_notification_preference() RETURNS trigger AS $$
DECLARE policy_criticality "NotificationPolicyCriticality"; required_in_app boolean; required_email boolean;
BEGIN
  SELECT criticality,"defaultInApp","defaultEmail" INTO policy_criticality,required_in_app,required_email FROM "NotificationTopicPolicy"
  WHERE "organizationId"=NEW."organizationId" AND id=NEW."notificationTopicPolicyId";
  IF policy_criticality IS NULL THEN RAISE EXCEPTION 'Notification topic policy not found'; END IF;
  IF policy_criticality='MANDATORY' AND ((required_in_app AND NOT NEW."inAppEnabled") OR (required_email AND NOT NEW."emailEnabled")) THEN
    RAISE EXCEPTION 'Governed mandatory notification channels cannot be disabled by user preference';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "NotificationPreference_guard" BEFORE INSERT OR UPDATE ON "NotificationPreference" FOR EACH ROW EXECUTE FUNCTION guard_notification_preference();

CREATE OR REPLACE FUNCTION guard_mandatory_notification_policy_update() RETURNS trigger AS $$
DECLARE conflicts integer;
BEGIN
  IF NEW.criticality='MANDATORY' THEN
    SELECT count(*) INTO conflicts FROM "NotificationPreference"
    WHERE "organizationId"=NEW."organizationId" AND "notificationTopicPolicyId"=NEW.id
      AND ((NEW."defaultInApp" AND NOT "inAppEnabled") OR (NEW."defaultEmail" AND NOT "emailEnabled"));
    IF conflicts>0 THEN RAISE EXCEPTION 'Mandatory notification policy conflicts with existing user preferences'; END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "NotificationTopicPolicy_mandatory_guard" BEFORE UPDATE OF criticality,"defaultInApp","defaultEmail" ON "NotificationTopicPolicy" FOR EACH ROW EXECUTE FUNCTION guard_mandatory_notification_policy_update();

INSERT INTO "Permission" ("id","key","description") VALUES
  (gen_random_uuid(),'notification.policy.read','View notification topics, delivery policy, and personal preferences'),
  (gen_random_uuid(),'notification.policy.manage','Create and manage governed notification delivery policy')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r."id",p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."systemRole"=true AND r."name"='System Administrator' AND p."key" IN ('notification.policy.read','notification.policy.manage')
ON CONFLICT ("roleId","permissionId") DO NOTHING;
