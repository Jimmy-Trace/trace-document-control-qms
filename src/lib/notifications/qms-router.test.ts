import type { Prisma } from "@prisma/client";
import { describe,expect,it,vi } from "vitest";
import { QmsNotificationRouter } from "./qms-router";

function transactionClient(queryResults:unknown[][],executeResult=1){
  const queryRaw=vi.fn();
  for(const result of queryResults)queryRaw.mockResolvedValueOnce(result);
  const executeRaw=vi.fn().mockResolvedValue(executeResult);
  return {client:{$queryRaw:queryRaw,$executeRaw:executeRaw} as unknown as Prisma.TransactionClient,queryRaw,executeRaw};
}

describe("configured QMS notification publishing",()=>{
  it("does not block a producer when no routing rule is configured",async()=>{
    const {client,executeRaw}=transactionClient([[]]);
    const result=await new QmsNotificationRouter().publishConfigured(client,{organizationId:"00000000-0000-0000-0000-000000000001",topicKey:"audit.created",eventKey:"audit:a1:created",payload:{auditId:"a1"}});
    expect(result).toEqual({configured:false,recipients:0,queued:0});
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it("queues mandatory governed channels for active resolved recipients",async()=>{
    const rule={topicPolicyId:"00000000-0000-0000-0000-000000000010",criticality:"MANDATORY",defaultInApp:true,defaultEmail:false,recipientPermissionKey:"audit.manage",templateKey:"audit-event"};
    const recipient={userId:"00000000-0000-0000-0000-000000000020",inAppEnabled:false,emailEnabled:false};
    const {client,executeRaw}=transactionClient([[rule],[recipient]]);
    const result=await new QmsNotificationRouter().publishConfigured(client,{organizationId:"00000000-0000-0000-0000-000000000001",topicKey:"audit.lifecycle",eventKey:"audit:a1:status:COMPLETED",payload:{auditId:"a1",toStatus:"COMPLETED"}});
    expect(result).toEqual({configured:true,recipients:1,queued:1});
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });
});
