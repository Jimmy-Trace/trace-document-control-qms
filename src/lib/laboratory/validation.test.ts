import { describe,expect,it,vi,beforeEach } from "vitest";
import type { AuthorizationContext } from "../security/authorization";
import { LaboratoryValidationError,LaboratoryValidationService } from "./validation";

vi.mock("../security/authorization",()=>({requireAuthorization:vi.fn()}));
vi.mock("../db",()=>({db:{$transaction:vi.fn()}}));

import { db } from "../db";

const context:AuthorizationContext={organizationId:"11111111-1111-1111-1111-111111111111",userId:"22222222-2222-2222-2222-222222222222",permissions:new Set(["lab_test.manage"]),siteIds:new Set<string>(),departmentIds:new Set<string>()};

describe("LaboratoryValidationService",()=>{
  beforeEach(()=>vi.clearAllMocks());

  it("rejects result recording when project is not in progress",async()=>{
    const tx={$queryRaw:vi.fn().mockResolvedValue([{status:"DRAFT"}])};
    vi.mocked(db.$transaction).mockImplementation(async cb=>cb(tx as never));
    const service=new LaboratoryValidationService();
    await expect(service.recordResult(context,{organizationId:context.organizationId,validationProjectId:"33333333-3333-3333-3333-333333333333",validationCriterionId:"44444444-4444-4444-4444-444444444444",outcome:"PASS",observedResult:"Within acceptance range"})).rejects.toThrow(LaboratoryValidationError);
  });

  it("rejects activation unless method is draft",async()=>{
    const tx={$queryRaw:vi.fn().mockResolvedValue([{status:"ACTIVE",laboratoryTestId:"55555555-5555-5555-5555-555555555555"}])};
    vi.mocked(db.$transaction).mockImplementation(async cb=>cb(tx as never));
    const service=new LaboratoryValidationService();
    await expect(service.activateValidatedMethod(context,{organizationId:context.organizationId,laboratoryMethodId:"66666666-6666-6666-6666-666666666666",reason:"Release after validation"})).rejects.toThrow("Only DRAFT methods may be activated");
  });
});
