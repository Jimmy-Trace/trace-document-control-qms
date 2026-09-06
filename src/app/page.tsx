import { DocumentControlDashboard } from "@/components/document-control-dashboard";
import { LifecycleOperations } from "@/components/lifecycle-operations";
import { ApprovalOperations } from "@/components/approval-operations";
import { ControlledSubmission } from "@/components/controlled-submission";
import { MyAcknowledgments } from "@/components/my-acknowledgments";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashOpaqueToken } from "@/lib/security/crypto";
import { validateSession } from "@/lib/security/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const token = (await cookies()).get("qms_session")?.value;
  if (!token) redirect("/login");
  const session = await db.session.findUnique({
    where: { tokenHash: hashOpaqueToken(token) },
    include: { user: true },
  });
  if (!session || !validateSession(token, session).valid || session.user.status !== "ACTIVE") redirect("/login");
  return (
    <>
      <DocumentControlDashboard
        developmentPreview={process.env.DEPLOYMENT_TIER === "development-preview"}
      />
      <ControlledSubmission />
      <ApprovalOperations />
      <LifecycleOperations />
      <MyAcknowledgments />
    </>
  );
}
