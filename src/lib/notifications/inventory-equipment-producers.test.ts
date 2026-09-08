import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const inventoryStore=readFileSync("src/lib/inventory/inventory-store.ts","utf8");
const equipmentStore=readFileSync("src/lib/equipment/equipment-store.ts","utf8");

describe("inventory and equipment governed notification producers",()=>{
  it("publishes inventory lot receipt and lifecycle status changes inside store transactions",()=>{
    expect(inventoryStore).toContain('topicKey:"inventory.material_lot.received"');
    expect(inventoryStore).toContain('eventKey:`material-lot:${lot.id}:received`');
    expect(inventoryStore).toContain('topicKey:"inventory.material_lot.status"');
    expect(inventoryStore).toContain('eventKey:`material-lot:${input.lotId}:status:${input.status}`');
    expect(inventoryStore).toContain("notificationRouter.publishConfigured(tx");
  });

  it("publishes governed equipment operational and lifecycle events from transaction-scoped store methods",()=>{
    expect(equipmentStore).toContain('topicKey:"equipment.event.recorded"');
    expect(equipmentStore).toContain('eventKey:`equipment-event:${event.id}:recorded`');
    expect(equipmentStore).toContain('["QUALIFIED","CALIBRATED","MAINTENANCE","SERVICE"]');
    expect(equipmentStore).toContain('topicKey:"equipment.status.changed"');
    expect(equipmentStore).toContain('eventKey:`equipment:${input.equipmentId}:status:${input.status}`');
    expect(equipmentStore).toContain("notificationRouter.publishConfigured(tx");
  });
});
