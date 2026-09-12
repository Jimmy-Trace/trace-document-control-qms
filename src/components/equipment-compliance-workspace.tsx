"use client";
import { useEffect,useState } from "react";
import { EquipmentCompliancePanel } from "./equipment-compliance-panel";

type Item={id:string;equipmentNumber:string;name:string};

export function EquipmentComplianceWorkspace({canManage}:{canManage:boolean}){
 const [equipment,setEquipment]=useState<Item[]>([]),[selected,setSelected]=useState(""),[error,setError]=useState("");
 async function refresh(){const r=await fetch("/api/equipment/operations",{cache:"no-store"});const j=await r.json().catch(()=>null);if(!r.ok){setError("Unable to load equipment compliance workspace");return;}const items:Item[]=j?.data?.equipment??[];setError("");setEquipment(items);setSelected(current=>current&&items.some(item=>item.id===current)?current:items[0]?.id??"");}
 useEffect(()=>{let cancelled=false;async function initialLoad(){const r=await fetch("/api/equipment/operations",{cache:"no-store"});const j=await r.json().catch(()=>null);if(cancelled)return;if(!r.ok){setError("Unable to load equipment compliance workspace");return;}const items:Item[]=j?.data?.equipment??[];setEquipment(items);setSelected(items[0]?.id??"");}void initialLoad();return()=>{cancelled=true;};},[]);
 return <section className="card form-stack equipment-register-style"><h3>Equipment compliance controls</h3><p>Review system-created overdue compliance holds, record retrospective impact assessment, and clear holds only after current calibration or maintenance evidence supports release.</p>{error&&<p className="status-error">{error}</p>}<div className="admin-form equipment-admin-form"><label>Equipment<select value={selected} onChange={e=>setSelected(e.target.value)} disabled={!equipment.length}>{equipment.length?equipment.map(item=><option key={item.id} value={item.id}>{item.equipmentNumber} — {item.name}</option>):<option value="">No equipment registered</option>}</select></label><div className="equipment-form-span">{selected&&<EquipmentCompliancePanel key={selected} equipmentId={selected} canManage={canManage} onChanged={refresh}/>}</div></div></section>;
}
