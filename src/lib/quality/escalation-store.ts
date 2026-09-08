import { Prisma } from "@prisma/client";
import { db } from "../db";
import { escalationLevels } from "./escalation";

type OverdueEvent = {
  id: string;
  organizationId: string;
  eventNumber: string;
  ownerUserId: string | null;
  dueAt: Date;
  overdueDays: number;
};

export class PrismaQualityEventEscalationStore {
  async notifyAllOverdue(now: Date) {
    const rows = await db.$queryRaw<OverdueEvent[]>(Prisma.sql`
      SELECT "id", "organizationId", "eventNumber", "ownerUserId", "dueAt",
             GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (${now}::timestamptz - "dueAt"::timestamptz)) / 86400))::int AS "overdueDays"
      FROM "QualityEvent"
      WHERE "status" <> 'CLOSED'
        AND "dueAt" IS NOT NULL
        AND "dueAt" < ${now}::date
      ORDER BY "dueAt" ASC
    `);

    let created = 0;
    for (const event of rows) {
      for (const level of escalationLevels(event.overdueDays)) {
        if (await this.escalate(event, level, now)) created += 1;
      }
    }
    return created;
  }

  private async escalate(event: OverdueEvent, level: 1 | 2 | 3, occurredAt: Date) {
    return db.$transaction(async (tx) => {
      const inserted = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        INSERT INTO "QualityEventEscalation"
          ("organizationId", "eventId", "level", "overdueDays", "escalatedAt")
        VALUES
          (${event.organizationId}::uuid, ${event.id}::uuid, ${level}, ${event.overdueDays}, ${occurredAt})
        ON CONFLICT ("organizationId", "eventId", "level") DO NOTHING
        RETURNING "id"
      `);
      if (!inserted[0]) return false;

      const managers = await tx.user.findMany({
        where: {
          organizationId: event.organizationId,
          status: "ACTIVE",
          roles: {
            some: {
              role: {
                permissions: {
                  some: { permission: { key: "quality_event.manage" } },
                },
              },
            },
          },
        },
        select: { id: true },
      });
      const recipients = [
        ...new Set([
          ...(event.ownerUserId ? [event.ownerUserId] : []),
          ...managers.map((manager) => manager.id),
        ]),
      ];

      if (recipients.length) {
        await tx.notificationOutbox.createMany({
          data: recipients.map((recipientUserId) => ({
            organizationId: event.organizationId,
            recipientUserId,
            eventKey: `quality-event-overdue:${event.id}:level:${level}`,
            templateKey: "QUALITY_EVENT_OVERDUE",
            payload: {
              eventId: event.id,
              eventNumber: event.eventNumber,
              dueAt: event.dueAt.toISOString(),
              overdueDays: event.overdueDays,
              level,
            },
            availableAt: occurredAt,
          })),
          skipDuplicates: true,
        });
      }

      await tx.auditEvent.create({
        data: {
          organizationId: event.organizationId,
          action: "QUALITY_EVENT_ESCALATED",
          entityType: "QualityEvent",
          entityId: event.id,
          occurredAt,
          metadata: {
            eventNumber: event.eventNumber,
            level,
            overdueDays: event.overdueDays,
            recipientCount: recipients.length,
          },
        },
      });
      return true;
    });
  }
}
