export type CompetencyAssessmentSummary = {
  id: string;
  employeeId: string;
  programId: string;
  assessedAt: string;
  outcome: "QUALIFIED" | "NOT_QUALIFIED" | "CONDITIONAL";
  expiresAt: string | null;
};

export type CompetencyRollupStatus = "CURRENT" | "DUE_SOON" | "EXPIRED" | "NOT_QUALIFIED" | "CONDITIONAL";

export type CompetencyRollup = CompetencyAssessmentSummary & { status: CompetencyRollupStatus };

export function competencyRollups(assessments: CompetencyAssessmentSummary[], today: string, reminderDays = 30): CompetencyRollup[] {
  const latest = new Map<string, CompetencyAssessmentSummary>();
  for (const assessment of assessments) {
    const key = `${assessment.employeeId}:${assessment.programId}`;
    const prior = latest.get(key);
    if (!prior || new Date(assessment.assessedAt).getTime() > new Date(prior.assessedAt).getTime()) latest.set(key, assessment);
  }
  const todayMs = new Date(`${today}T00:00:00.000Z`).getTime();
  const reminderMs = reminderDays * 24 * 60 * 60 * 1000;
  return [...latest.values()].map((assessment) => {
    let status: CompetencyRollupStatus;
    if (assessment.outcome === "NOT_QUALIFIED") status = "NOT_QUALIFIED";
    else if (assessment.outcome === "CONDITIONAL") status = "CONDITIONAL";
    else if (!assessment.expiresAt) status = "CURRENT";
    else {
      const expiryMs = new Date(`${assessment.expiresAt.slice(0, 10)}T00:00:00.000Z`).getTime();
      if (expiryMs < todayMs) status = "EXPIRED";
      else if (expiryMs - todayMs <= reminderMs) status = "DUE_SOON";
      else status = "CURRENT";
    }
    return { ...assessment, status };
  }).sort((a, b) => a.employeeId.localeCompare(b.employeeId) || a.programId.localeCompare(b.programId));
}

export function competencyDashboard(rollups: CompetencyRollup[]) {
  return {
    total: rollups.length,
    current: rollups.filter((item) => item.status === "CURRENT").length,
    dueSoon: rollups.filter((item) => item.status === "DUE_SOON").length,
    expired: rollups.filter((item) => item.status === "EXPIRED").length,
    notQualified: rollups.filter((item) => item.status === "NOT_QUALIFIED").length,
    conditional: rollups.filter((item) => item.status === "CONDITIONAL").length,
  };
}
