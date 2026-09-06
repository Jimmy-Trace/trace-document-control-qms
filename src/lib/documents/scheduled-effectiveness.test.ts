import { describe, expect, it } from "vitest";
import {
  addMonthsUtc,
  validateScheduledEffectiveAt,
} from "./scheduled-effectiveness";

describe("scheduled document effectiveness", () => {
  it("requires the scheduled effective date to be in the future", () => {
    const now = new Date("2026-09-06T04:00:00.000Z");
    expect(() =>
      validateScheduledEffectiveAt(
        new Date("2026-09-06T04:00:01.000Z"),
        now,
      ),
    ).not.toThrow();
    expect(() => validateScheduledEffectiveAt(now, now)).toThrow(
      "must be in the future",
    );
    expect(() =>
      validateScheduledEffectiveAt(
        new Date("2026-09-06T03:59:59.000Z"),
        now,
      ),
    ).toThrow("must be in the future");
  });

  it("calculates review dates from the scheduled effective date", () => {
    expect(addMonthsUtc(new Date("2026-01-31T12:00:00.000Z"), 1).toISOString()).toBe(
      "2026-02-28T12:00:00.000Z",
    );
    expect(addMonthsUtc(new Date("2026-09-06T04:00:00.000Z"), 12).toISOString()).toBe(
      "2027-09-06T04:00:00.000Z",
    );
  });
});
