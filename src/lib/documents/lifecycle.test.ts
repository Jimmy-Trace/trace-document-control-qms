import { describe, expect, it } from "vitest";
import { nextDocumentVersionState, validateDraftRevision } from "./lifecycle";

describe("controlled document lifecycle", () => {
  it.each([
    ["DRAFT", "SUBMIT", "IN_REVIEW", undefined],
    ["IN_REVIEW", "APPROVE", "APPROVED", undefined],
    ["IN_REVIEW", "REJECT", "DRAFT", "Revise"],
    ["APPROVED", "MAKE_EFFECTIVE", "EFFECTIVE", undefined],
    ["EFFECTIVE", "RETIRE", "RETIRED", "Controlled retirement"],
  ] as const)(
    "moves %s through %s to %s",
    (current, command, expected, reason) => {
      expect(nextDocumentVersionState(current, command, reason)).toBe(expected);
    },
  );

  it.each([
    ["DRAFT", "APPROVE"],
    ["DRAFT", "MAKE_EFFECTIVE"],
    ["DRAFT", "RETIRE"],
    ["IN_REVIEW", "MAKE_EFFECTIVE"],
    ["APPROVED", "RETIRE"],
    ["EFFECTIVE", "SUBMIT"],
    ["SUPERSEDED", "APPROVE"],
    ["SUPERSEDED", "RETIRE"],
    ["RETIRED", "SUBMIT"],
  ] as const)(
    "rejects the skipped or historical transition %s/%s",
    (current, command) => {
      expect(() => nextDocumentVersionState(current, command)).toThrow(
        "Invalid document transition",
      );
    },
  );

  it("requires a rejection reason", () => {
    expect(() =>
      nextDocumentVersionState("IN_REVIEW", "REJECT", "  "),
    ).toThrow("reason is required");
  });

  it("requires a controlled retirement reason", () => {
    expect(() => nextDocumentVersionState("EFFECTIVE", "RETIRE", "  ")).toThrow(
      "retirement reason is required",
    );
  });

  it("validates revision evidence", () => {
    expect(() =>
      validateDraftRevision({
        versionNumber: 1,
        revisionLabel: "1.0",
        contentHash: "a".repeat(64),
        changeSummary: "Initial controlled version",
      }),
    ).not.toThrow();
    expect(() =>
      validateDraftRevision({
        versionNumber: 0,
        revisionLabel: "",
        contentHash: "raw-content",
        changeSummary: "",
      }),
    ).toThrow();
  });
});
