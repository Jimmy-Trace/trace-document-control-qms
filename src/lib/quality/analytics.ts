import type { AuthorizationContext } from "../security/authorization";
import { requireAuthorization } from "../security/authorization";

export type QualityEventAnalytics = {
  generatedAt: Date;
  windowStart: Date;
  total: number;
  open: number;
  overdue: number;
  closed: number;
  byStatus: Array<{ status: string; count: number }>;
  byType: Array<{ type: string; count: number }>;
  bySeverity: Array<{ severity: string; count: number }>;
  bySource: Array<{ source: string; count: number }>;
  monthly: Array<{ month: string; count: number }>;
};

export interface QualityEventAnalyticsStore {
  report(organizationId: string, months: number, now: Date): Promise<QualityEventAnalytics>;
}

export class QualityEventAnalyticsService {
  constructor(private readonly store: QualityEventAnalyticsStore) {}

  report(context: AuthorizationContext, organizationId: string, months: number, now = new Date()) {
    requireAuthorization(context, { organizationId, permission: "quality_event.read" });
    if (!Number.isInteger(months) || months < 1 || months > 24) throw new Error("Invalid analytics window");
    return this.store.report(organizationId, months, now);
  }
}
