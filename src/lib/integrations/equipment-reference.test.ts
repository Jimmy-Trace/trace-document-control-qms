import { describe, expect, it } from "vitest";
import { deriveEquipmentOperationalUsable } from "./qms-reference";

describe("external equipment reference availability", () => {
  it("reports active equipment with no uncleared compliance holds as operationally usable", () => {
    expect(deriveEquipmentOperationalUsable("ACTIVE", 0)).toBe(true);
  });

  it("does not report held or non-active equipment as operationally usable", () => {
    expect(deriveEquipmentOperationalUsable("ACTIVE", 1)).toBe(false);
    expect(deriveEquipmentOperationalUsable("PLANNED", 0)).toBe(false);
    expect(deriveEquipmentOperationalUsable("OUT_OF_SERVICE", 0)).toBe(false);
    expect(deriveEquipmentOperationalUsable("RETIRED", 0)).toBe(false);
  });
});
