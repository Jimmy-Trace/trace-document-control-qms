import { describe, expect, it } from "vitest";
import { approvedWebhookEvents, validateWebhookEndpoint, validateWebhookEvents } from "./webhook-subscriptions";

describe("webhook subscription boundary",()=>{
  it("keeps the server-owned event allow-list narrow",()=>{
    expect(approvedWebhookEvents).toEqual([
      "document.effective",
      "equipment.status",
      "inventory.lot.status",
      "quality_event.status",
      "validation_project.status",
    ]);
  });

  it("requires one or more approved events",()=>{
    expect(()=>validateWebhookEvents([])).toThrow("At least one webhook event is required");
    expect(()=>validateWebhookEvents(["document.effective","unknown.event"])).toThrow("Unsupported webhook event");
    expect(validateWebhookEvents(["document.effective","document.effective"])).toEqual(["document.effective"]);
  });

  it("requires HTTPS and rejects local/private literal destinations",()=>{
    expect(()=>validateWebhookEndpoint("http://example.com/hook")).toThrow("Webhook endpoint must use HTTPS");
    expect(()=>validateWebhookEndpoint("https://localhost/hook")).toThrow("Webhook endpoint host is not allowed");
    expect(()=>validateWebhookEndpoint("https://127.0.0.1/hook")).toThrow("Webhook endpoint host is not allowed");
    expect(()=>validateWebhookEndpoint("https://10.1.2.3/hook")).toThrow("Webhook endpoint host is not allowed");
    expect(()=>validateWebhookEndpoint("https://192.168.1.10/hook")).toThrow("Webhook endpoint host is not allowed");
    expect(validateWebhookEndpoint("https://hooks.example.com/qms#fragment")).toBe("https://hooks.example.com/qms");
  });

  it("rejects embedded endpoint credentials",()=>{
    expect(()=>validateWebhookEndpoint("https://user:pass@example.com/hook")).toThrow("Webhook endpoint must not contain embedded credentials");
  });
});
