import { describe, expect, it } from "vitest";
import { signWebhookBody, verifyWebhookSignature } from "./webhook-delivery";
import { deriveWebhookSigningSecret } from "./webhook-subscriptions";

describe("webhook delivery boundary",()=>{
  it("derives deterministic per-subscription secrets without persisting plaintext",()=>{
    const source={WEBHOOK_SIGNING_MASTER_SECRET:"0123456789abcdef0123456789abcdef"};
    const first=deriveWebhookSigningSecret("11111111-1111-1111-1111-111111111111",1,source);
    const same=deriveWebhookSigningSecret("11111111-1111-1111-1111-111111111111",1,source);
    const other=deriveWebhookSigningSecret("22222222-2222-2222-2222-222222222222",1,source);
    expect(first).toBe(same);
    expect(first).not.toBe(other);
    expect(first).not.toContain(source.WEBHOOK_SIGNING_MASTER_SECRET);
  });

  it("requires a sufficiently strong webhook signing master secret",()=>{
    expect(()=>deriveWebhookSigningSecret("subscription",1,{WEBHOOK_SIGNING_MASTER_SECRET:"short"})).toThrow("at least 32 characters");
  });

  it("signs the exact delivered body with HMAC-SHA256",()=>{
    const body=JSON.stringify({id:"evt-1",type:"document.effective",data:{documentNumber:"SOP-001"}});
    const secret="receiver-shared-secret";
    const signature=signWebhookBody(body,secret);
    expect(signature).toMatch(/^v1=[0-9a-f]{64}$/);
    expect(verifyWebhookSignature(body,signature,secret)).toBe(true);
    expect(verifyWebhookSignature(`${body} `,signature,secret)).toBe(false);
  });
});
