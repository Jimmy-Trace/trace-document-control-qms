import { DocumentControlDashboard } from "@/components/document-control-dashboard";
import { DashboardVisibilityGate } from "@/components/dashboard-visibility-gate";
import { LifecycleOperations } from "@/components/lifecycle-operations";
import { ApprovalOperations } from "@/components/approval-operations";
import { ControlledSubmission } from "@/components/controlled-submission";
import { MyAcknowledgments } from "@/components/my-acknowledgments";
import { AcknowledgmentDistribution } from "@/components/acknowledgment-distribution";
import { OrganizationalAcknowledgmentDistribution } from "@/components/organizational-acknowledgment-distribution";
import { ControlledCopyAdministration } from "@/components/controlled-copy-administration";
import { MembershipAdministration } from "@/components/membership-administration";
import { DocumentFolderManager } from "@/components/document-folder-manager";
import { RetentionAdministration } from "@/components/retention-administration";
import { RecordManagementWorkspace } from "@/components/record-management-workspace";
import { PersonnelManagementWorkspace } from "@/components/personnel-management-workspace";
import { PersonnelCredentialWorkspace } from "@/components/personnel-credential-workspace";
import { PersonnelQualificationWorkspace } from "@/components/personnel-qualification-workspace";
import { TrainingManagementWorkspace } from "@/components/training-management-workspace";
import { CompetencyManagementWorkspace } from "@/components/competency-management-workspace";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashOpaqueToken } from "@/lib/security/crypto";
import { validateSession } from "@/lib/security/session";
import { workspaceVisibility } from "@/lib/security/workspace-visibility";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const token = (await cookies()).get("qms_session")?.value;
  if (!token) redirect("/login");
  const session = await db.session.findUnique({
    where: { tokenHash: hashOpaqueToken(token) },
    include: {
      user: {
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: { include: { permission: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!session || !validateSession(token, session).valid || session.user.status !== "ACTIVE") redirect("/login");

  const visibility = workspaceVisibility(
    session.user.roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.key)),
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <DashboardVisibilityGate />
      <DocumentControlDashboard
        developmentPreview={process.env.DEPLOYMENT_TIER === "development-preview"}
      />
      {visibility.controlledSubmission && <ControlledSubmission />}
      {visibility.approvalOperations && <ApprovalOperations />}
      {visibility.lifecycleOperations && <LifecycleOperations />}
      {visibility.acknowledgments && <MyAcknowledgments />}
      {visibility.acknowledgmentDistribution && <AcknowledgmentDistribution />}
      {visibility.acknowledgmentDistribution && <OrganizationalAcknowledgmentDistribution />}
      {visibility.controlledCopies && <ControlledCopyAdministration />}
      {visibility.membershipAdministration && <MembershipAdministration />}
      {visibility.folderManager && <DocumentFolderManager />}
      {visibility.retentionAdministration && <RetentionAdministration />}
      {visibility.recordManagement && (
        <RecordManagementWorkspace
          canCreate={visibility.recordCreate}
          canArchive={visibility.recordArchive}
          canExport={visibility.recordExport}
          canConfigureTypes={visibility.recordTypeAdministration}
        />
      )}
      {visibility.personnelManagement && <PersonnelManagementWorkspace canManage={visibility.personnelManage} />}
      {visibility.personnelManagement && <PersonnelCredentialWorkspace canManage={visibility.personnelManage} today={today} />}
      {visibility.personnelManagement && <PersonnelQualificationWorkspace canManage={visibility.personnelManage} today={today} />}
      {visibility.trainingManagement && <TrainingManagementWorkspace canManage={visibility.trainingManage} today={today} />}
      {visibility.trainingManagement && <CompetencyManagementWorkspace canManage={visibility.trainingManage} today={today} />}
    </>
  );
}
