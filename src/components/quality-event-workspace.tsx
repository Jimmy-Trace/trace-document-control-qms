"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { QualityEventGovernedActions } from "./quality-event-governed-actions";

type Status="OPEN"|"INVESTIGATING"|"ACTION_REQUIRED"|"VERIFICATION"|"CLOSED";
type EventRecord={id:string;eventNumber:string;type:string;severity:string;status:Status;summary:string;ownerUserId:string|null;dueAt:string|null;createdAt:string};
type OwnerOption={id:string;email:string;firstName:string;lastName:string};
type Analytics={total:number;open:number;overdue:number;closed:number;byType:Array<{type:string;count:number}>;monthly:Array<{month:string;count:number}>};
type Section="register"|"create"|"lifecycle"|"governed";

const nextStatus:Partial<Record<Status,Status>>={OPEN:"INVESTIGATING",INVESTIGATING:"ACTION_REQUIRED",ACTION_REQUIRED:"VERIFICATION"};
const eventTypes=["NONCONFORMANCE","PATIENT_COMPLAINT","PHYSICIAN_COMPLAINT","SPECIMEN_PROBLEM","TESTING_ERROR","QC_FAILURE","PT_FAILURE","EQUIPMENT_FAILURE","REPORTING_ERROR","BILLING_ADMINISTRATIVE","SAFETY_EVENT","PERSONNEL_EVENT","DEVIATION","OTHER"];
const severities=["LOW","MEDIUM","HIGH","CRITICAL"];

export function QualityEventWorkspace({canManage,today}:{canManage:boolean;today:string}){
  const [events,setEvents]=useState<EventRecord[]>([]);
  const [owners,setOwners]=useState<OwnerOption[]>([]);
  const [analytics,setAnalytics]=useState<Analytics|null>(null);
  const [selectedId,setSelectedId]=useState("");
  const [section,setSection]=useState<Section>("register");
  const [reason,setReason]=useState("");
  const [ownerUserId,setOwnerUserId]=useState("");
  const [dueAt,setDueAt]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);

  async function load(){
    const requests=[
      fetch("/api/quality/events",{credentials:"same-origin"}),
      fetch("/api/quality/events/analytics?months=12",{credentials:"same-origin"}),
    ];
    if(canManage)requests.push(fetch("/api/quality/events/owners",{credentials:"same-origin"}));
    const [eventsResponse,analyticsResponse,ownersResponse]=await Promise.all(requests);
    const eventsBody=await eventsResponse.json().catch(()=>null);
    const analyticsBody=await analyticsResponse.json().catch(()=>null);
    if(eventsResponse.ok)setEvents(eventsBody?.data??[]);else setError(eventsBody?.error??"Unable to load quality events");
    if(analyticsResponse.ok)setAnalytics(analyticsBody?.data??null);
    if(ownersResponse){const ownersBody=await ownersResponse.json().catch(()=>null);if(ownersResponse.ok)setOwners(ownersBody?.data??[]);}
  }

  useEffect(()=>{
    let active=true;
    const requests=[
      fetch("/api/quality/events",{credentials:"same-origin"}),
      fetch("/api/quality/events/analytics?months=12",{credentials:"same-origin"}),
    ];
    if(canManage)requests.push(fetch("/api/quality/events/owners",{credentials:"same-origin"}));
    Promise.all(requests).then(async responses=>({
      eventsResponse:responses[0],
      analyticsResponse:responses[1],
      ownersResponse:responses[2],
      eventsBody:await responses[0]!.json().catch(()=>null),
      analyticsBody:await responses[1]!.json().catch(()=>null),
      ownersBody:responses[2]?await responses[2].json().catch(()=>null):null,
    })).then(({eventsResponse,analyticsResponse,ownersResponse,eventsBody,analyticsBody,ownersBody})=>{
      if(!active)return;
      if(eventsResponse.ok)setEvents(eventsBody?.data??[]);else setError(eventsBody?.error??"Unable to load quality events");
      if(analyticsResponse.ok)setAnalytics(analyticsBody?.data??null);
      if(ownersResponse?.ok)setOwners(ownersBody?.data??[]);
    });
    return()=>{active=false;};
  },[canManage]);
  const selected=useMemo(()=>events.find(event=>event.id===selectedId)??null,[events,selectedId]);
  const ownerById=useMemo(()=>new Map(owners.map(owner=>[owner.id,owner])),[owners]);
  const overdue=(event:EventRecord)=>event.status!=="CLOSED"&&!!event.dueAt&&event.dueAt.slice(0,10)<today;
  const ownerLabel=(id:string|null)=>{if(!id)return "Unassigned";const owner=ownerById.get(id);return owner?`${owner.firstName} ${owner.lastName} · ${owner.email}`:"Assigned user";};

  async function createEvent(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=new FormData(event.currentTarget);setBusy(true);setError("");setNotice("");
    const response=await fetch("/api/quality/events",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({
      type:String(form.get("type")),severity:String(form.get("severity")),summary:String(form.get("summary")),description:String(form.get("description"))||null,discoveredAt:new Date(String(form.get("discoveredAt"))).toISOString(),dueAt:String(form.get("dueAt"))||null,ownerUserId:null,
    })});
    const body=await response.json().catch(()=>null);setBusy(false);
    if(!response.ok){setError(body?.error??"Quality event could not be created");return;}
    event.currentTarget.reset();setNotice(`Quality event ${body.data.eventNumber} created with audit evidence.`);setSelectedId(body.data.id);setSection("lifecycle");await load();
  }

  async function update(payload:Record<string,unknown>){if(!selected)return;setBusy(true);setError("");setNotice("");const response=await fetch(`/api/quality/events/${selected.id}`,{method:"PATCH",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({reason,...payload})});const body=await response.json().catch(()=>null);setBusy(false);if(!response.ok){setError(body?.error??"Quality event update failed");return;}setReason("");setOwnerUserId("");setDueAt("");setNotice("Quality event lifecycle update recorded with audit evidence.");await load();}
  async function saveMetadata(event:FormEvent){event.preventDefault();const payload:Record<string,unknown>={};if(ownerUserId)payload.ownerUserId=ownerUserId;if(dueAt)payload.dueAt=dueAt;await update(payload);}

  const sections=[
    {id:"register" as const,label:"Quality events",description:"Review the event register, status, severity, ownership, and due dates.",visible:true},
    {id:"create" as const,label:"Create event",description:"Open a new manually reported quality event.",visible:canManage},
    {id:"lifecycle" as const,label:"Lifecycle",description:"Advance status and manage event ownership or due dates.",visible:!!selected},
    {id:"governed" as const,label:"Investigation & CAPA",description:"Investigation, root cause, CAPA, effectiveness, and controlled closure.",visible:!!selected},
  ].filter(item=>item.visible);

  return <section className="panel" aria-labelledby="quality-event-workspace-heading">
    <div className="section-heading"><div><p className="eyebrow">Quality</p><h2 id="quality-event-workspace-heading">Quality event management</h2><p>Open one governed quality function at a time while preserving event lifecycle, investigation, CAPA, effectiveness, and closure history.</p></div></div>
    <nav className="module-subnav" aria-label="Quality event sections">{sections.map(item=><button key={item.id} type="button" className={section===item.id?"active":""} onClick={()=>setSection(item.id)}><strong>{item.label}</strong><span>{item.description}</span></button>)}</nav>
    {selected&&<p><strong>Selected event:</strong> {selected.eventNumber} · {selected.summary} · {selected.status}</p>}
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}

    {section==="register"&&<div className="module-section-stack">
      {analytics&&<div><h3>12-month quality event rollup</h3><p>Total: <strong>{analytics.total}</strong> · Open: <strong>{analytics.open}</strong> · Overdue: <strong>{analytics.overdue}</strong> · Closed: <strong>{analytics.closed}</strong></p>{analytics.byType.length>0&&<p>Leading event types: {analytics.byType.slice(0,5).map(item=>`${item.type} (${item.count})`).join(" · ")}</p>}{analytics.monthly.length>0&&<p>Monthly trend: {analytics.monthly.map(item=>`${item.month}: ${item.count}`).join(" · ")}</p>}</div>}
      <div className="table-wrap"><table><thead><tr><th>Event</th><th>Type</th><th>Severity</th><th>Status</th><th>Owner</th><th>Due</th></tr></thead><tbody>{events.map(event=><tr key={event.id}><td><button type="button" onClick={()=>{setSelectedId(event.id);setSection("lifecycle");}}>{event.eventNumber}</button><br/>{event.summary}</td><td>{event.type}</td><td>{event.severity}</td><td>{event.status}{overdue(event)?" · OVERDUE":""}</td><td>{ownerLabel(event.ownerUserId)}</td><td>{event.dueAt?.slice(0,10)??"—"}</td></tr>)}{!events.length&&<tr><td colSpan={6}>No quality events have been recorded.</td></tr>}</tbody></table></div>
    </div>}

    {section==="create"&&canManage&&<div className="module-section-stack"><div className="section-heading"><div><h3>Create quality event</h3><p>Record a manually discovered quality event. Ownership may be assigned after creation.</p></div></div><form onSubmit={createEvent} className="admin-form">
      <label>Event type<select name="type" defaultValue="NONCONFORMANCE" required>{eventTypes.map(type=><option key={type} value={type}>{type.replaceAll("_"," ")}</option>)}</select></label>
      <label>Severity<select name="severity" defaultValue="MEDIUM" required>{severities.map(severity=><option key={severity} value={severity}>{severity}</option>)}</select></label>
      <label>Summary<input name="summary" maxLength={240} required /></label><label>Description<textarea name="description" maxLength={5000}/></label><label>Discovered at<input name="discoveredAt" type="datetime-local" required/></label><label>Due date<input name="dueAt" type="date"/></label><button type="submit" disabled={busy}>Create quality event</button>
    </form></div>}

    {section==="lifecycle"&&selected&&<div className="module-section-stack"><div className="section-heading"><div><h3>Governed lifecycle — {selected.eventNumber}</h3><p>Advance the regulated event status or update assignment and due date with a required reason.</p></div></div>{canManage&&selected.status!=="CLOSED"?<><label>Required reason<textarea value={reason} onChange={event=>setReason(event.target.value)} maxLength={1000}/></label>{nextStatus[selected.status]&&<button type="button" disabled={busy||!reason.trim()} onClick={()=>void update({status:nextStatus[selected.status]})}>Advance to {nextStatus[selected.status]}</button>}<form onSubmit={saveMetadata} className="admin-form"><label>Owner<select value={ownerUserId} onChange={event=>setOwnerUserId(event.target.value)}><option value="">Select an active user</option>{owners.map(owner=><option key={owner.id} value={owner.id}>{owner.firstName} {owner.lastName} · {owner.email}</option>)}</select></label><label>Due date<input type="date" value={dueAt} onChange={event=>setDueAt(event.target.value)}/></label><button type="submit" disabled={busy||!reason.trim()||(!ownerUserId&&!dueAt)}>Update assignment / due date</button></form></>:<p>{selected.status==="CLOSED"?"This quality event is closed.":"You have read-only access to this event lifecycle."}</p>}</div>}

    {section==="governed"&&selected&&<QualityEventGovernedActions event={{id:selected.id,eventNumber:selected.eventNumber,status:selected.status}} canManage={canManage} onChanged={load}/>} 
  </section>;
}
