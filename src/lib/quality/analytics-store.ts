import { Prisma } from "@prisma/client";
import { db } from "../db";
import type { QualityEventAnalytics, QualityEventAnalyticsStore } from "./analytics";

type CountRow = { key: string; count: number };
type SummaryRow = { total: number; open: number; overdue: number; closed: number };

export class PrismaQualityEventAnalyticsStore implements QualityEventAnalyticsStore {
  async report(organizationId: string, months: number, now: Date): Promise<QualityEventAnalytics> {
    const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
    const [summary] = await db.$queryRaw<SummaryRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "total",
             COUNT(*) FILTER (WHERE "status" <> 'CLOSED')::int AS "open",
             COUNT(*) FILTER (WHERE "status" <> 'CLOSED' AND "dueAt" IS NOT NULL AND "dueAt" < ${now}::date)::int AS "overdue",
             COUNT(*) FILTER (WHERE "status" = 'CLOSED')::int AS "closed"
      FROM "QualityEvent"
      WHERE "organizationId"=${organizationId}::uuid AND "createdAt" >= ${windowStart}
    `);
    const byStatusRows = await db.$queryRaw<CountRow[]>(Prisma.sql`SELECT "status"::text AS "key",COUNT(*)::int AS "count" FROM "QualityEvent" WHERE "organizationId"=${organizationId}::uuid AND "createdAt">=${windowStart} GROUP BY "status" ORDER BY "status"`);
    const byTypeRows = await db.$queryRaw<CountRow[]>(Prisma.sql`SELECT "type"::text AS "key",COUNT(*)::int AS "count" FROM "QualityEvent" WHERE "organizationId"=${organizationId}::uuid AND "createdAt">=${windowStart} GROUP BY "type" ORDER BY "count" DESC,"type"`);
    const bySeverityRows = await db.$queryRaw<CountRow[]>(Prisma.sql`SELECT "severity"::text AS "key",COUNT(*)::int AS "count" FROM "QualityEvent" WHERE "organizationId"=${organizationId}::uuid AND "createdAt">=${windowStart} GROUP BY "severity" ORDER BY "severity"`);
    const bySourceRows = await db.$queryRaw<CountRow[]>(Prisma.sql`SELECT "source"::text AS "key",COUNT(*)::int AS "count" FROM "QualityEvent" WHERE "organizationId"=${organizationId}::uuid AND "createdAt">=${windowStart} GROUP BY "source" ORDER BY "source"`);
    const monthlyRows = await db.$queryRaw<Array<{ month: string; count: number }>>(Prisma.sql`SELECT to_char(date_trunc('month',"createdAt"),'YYYY-MM') AS "month",COUNT(*)::int AS "count" FROM "QualityEvent" WHERE "organizationId"=${organizationId}::uuid AND "createdAt">=${windowStart} GROUP BY 1 ORDER BY 1`);
    return {
      generatedAt: now,
      windowStart,
      total: summary?.total ?? 0,
      open: summary?.open ?? 0,
      overdue: summary?.overdue ?? 0,
      closed: summary?.closed ?? 0,
      byStatus: byStatusRows.map(row=>({status:row.key,count:row.count})),
      byType: byTypeRows.map(row=>({type:row.key,count:row.count})),
      bySeverity: bySeverityRows.map(row=>({severity:row.key,count:row.count})),
      bySource: bySourceRows.map(row=>({source:row.key,count:row.count})),
      monthly: monthlyRows,
    };
  }
}
