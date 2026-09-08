import { describe,expect,it } from "vitest";
import { equipmentEscalationLevels } from "./escalation";
describe("equipmentEscalationLevels",()=>{
 it("creates level 1 after one day",()=>expect(equipmentEscalationLevels(1)).toEqual([1]));
 it("creates every crossed level at seven days",()=>expect(equipmentEscalationLevels(7)).toEqual([1,2]));
 it("creates every crossed level at thirty days",()=>expect(equipmentEscalationLevels(30)).toEqual([1,2,3]));
});
