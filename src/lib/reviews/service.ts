import {
  requireAuthorization,
  type AuthorizationContext,
} from "../security/authorization";

export type ReviewOutcome =
  | "NO_CHANGE"
  | "REVISION_REQUIRED"
  | "RETIREMENT_REQUIRED";
export type PeriodicReviewState = "UPCOMING" | "DUE" | "OVERDUE";

export interface DueReview {
  id: string;
  documentId: string;
  documentVersionId: string;
  documentNumber?: string;
  title?: string;
  revisionLabel?: string;
  dueAt: Date;
  assignedToUserId?: string | null;
  cycleNumber?: number;
}

export interface OutstandingReview extends DueReview {
  overdue: boolean;
}

export interface ReviewStore {
  listDue(organizationId: string, through: Date): Promise<DueReview[]>;
  escalate(input: {
    organizationId: string;
    taskId: string;
    level: number;
    eventKey: string;
    occurredAt: Date;
  }): Promise<boolean>;
  remind(input: {
    organizationId: string;
    taskId: string;
    eventKey: string;
    occurredAt: Date;
  }): Promise<boolean>;
  assign(input: {
    organizationId: string;
    taskId: string;
    assignedToUserId: string;
    actorUserId: string;
    reason: string;
    occurredAt: Date;
  }): Promise<boolean>;
  complete(input: {
    organizationId: string;
    taskId: string;
    actorUserId: string;
    outcome: ReviewOutcome;
    comments: string;
    completedAt: Date;
  }): Promise<boolean>;
  listOutstanding(
    organizationId: string,
    now: Date,
  ): Promise<OutstandingReview[]>;
}

const DAY_MS = 86_400_000;
const UPCOMING_REMINDER_DAYS = 30;

function startOfUtcDay(value: Date) {
  return Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  );
}

function daysUntilDue(now: Date, dueAt: Date) {
  return Math.round((startOfUtcDay(dueAt) - startOfUtcDay(now)) / DAY_MS);
}

function reviewState(now: Date, dueAt: Date): PeriodicReviewState {
  const days = daysUntilDue(now, dueAt);
  if (days < 0) return "OVERDUE";
  if (days === 0) return "DUE";
  return "UPCOMING";
}

export class DocumentReviewService {
  constructor(
    private readonly store: ReviewStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async monitor(context: AuthorizationContext, organizationId: string) {
    requireAuthorization(context, {
      organizationId,
      permission: "document.review.manage",
    });
    const now = this.clock();
    const [dueTasks, outstanding] = await Promise.all([
      this.store.listDue(organizationId, now),
      this.store.listOutstanding(organizationId, now),
    ]);
    let escalated = 0;
    let reminded = 0;

    for (const task of dueTasks) {
      const daysOverdue = Math.max(
        0,
        Math.floor((now.getTime() - task.dueAt.getTime()) / DAY_MS),
      );
      const level = daysOverdue >= 30 ? 3 : daysOverdue >= 7 ? 2 : 1;
      if (
        await this.store.escalate({
          organizationId,
          taskId: task.id,
          level,
          eventKey: `document-review:${task.id}:level:${level}`,
          occurredAt: now,
        })
      )
        escalated++;
    }

    for (const task of outstanding) {
      const days = daysUntilDue(now, task.dueAt);
      if (days <= 0 || days > UPCOMING_REMINDER_DAYS) continue;
      if (
        await this.store.remind({
          organizationId,
          taskId: task.id,
          eventKey: `document-review:${task.id}:due-soon:${UPCOMING_REMINDER_DAYS}`,
          occurredAt: now,
        })
      )
        reminded++;
    }

    return { evaluated: dueTasks.length, escalated, reminded };
  }

  async assign(
    context: AuthorizationContext,
    input: {
      organizationId: string;
      taskId: string;
      assignedToUserId: string;
      reason: string;
    },
  ) {
    requireAuthorization(context, {
      organizationId: input.organizationId,
      permission: "document.review.manage",
    });
    if (input.reason.trim().length < 3)
      throw new ReviewValidationError("An assignment reason is required");
    const assigned = await this.store.assign({
      ...input,
      reason: input.reason.trim(),
      actorUserId: context.userId,
      occurredAt: this.clock(),
    });
    if (!assigned) throw new ReviewConflictError();
    return { assigned: true };
  }

  async complete(
    context: AuthorizationContext,
    input: {
      organizationId: string;
      taskId: string;
      outcome: ReviewOutcome;
      comments: string;
    },
  ) {
    requireAuthorization(context, {
      organizationId: input.organizationId,
      permission: "document.review.complete",
    });
    if (input.comments.trim().length < 3)
      throw new ReviewValidationError("Review comments are required");
    const completed = await this.store.complete({
      ...input,
      comments: input.comments.trim(),
      actorUserId: context.userId,
      completedAt: this.clock(),
    });
    if (!completed) throw new ReviewConflictError();
    return { completed: true };
  }

  async listOutstanding(
    context: AuthorizationContext,
    organizationId: string,
  ) {
    requireAuthorization(context, {
      organizationId,
      permission: "document.review.manage",
    });
    const now = this.clock();
    const rows = await this.store.listOutstanding(organizationId, now);
    return rows.map((row) => ({
      ...row,
      overdue: reviewState(now, row.dueAt) === "OVERDUE",
      reviewState: reviewState(now, row.dueAt),
      daysUntilDue: daysUntilDue(now, row.dueAt),
    }));
  }
}

export class ReviewValidationError extends Error {}
export class ReviewConflictError extends Error {
  constructor() {
    super("The review task changed; reload before retrying");
  }
}
