"use client";

import { FormEvent, useEffect, useState } from "react";

type Status="OPEN"|"INVESTIGATING"|"ACTION_REQUIRED"|"VERIFICATION"|"CLOSED";
type EventRef={id:string;eventNumber:string;status:Status};
type Investigation={id:string;rootCauseMethod:string;rootCause:string;riskLikelihood:number;riskImpact:number;riskScore:number;createdAt:string};
type Capa={id:string;actionType:"CORRECTIVE"|"PREVENTIVE";description:string;ownerUserId:string;dueAt:string;status:"OPEN"|"COMPLETED";completionEvidence:string|null;completedAt:string|null};
type Section="investigation"|"capa"|"closure";

async function json(response:Response){return response.json().catch(()=>null);}

export function QualityEventGovernedActions({event,canManage,onChanged}:{event:EventRef;canManage:boolean;onChanged:()=>Promise<void>}){
  const [investigations,setInvestigations]=useState<Investigation[]>([]);
  const [capas,setCapas]=useState<Capa[]>([]);
  const [section,setSection]=useState<Section>("investigation");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [findings,setFindings]=useState("");
  const [affectedScope,setAffectedScope]=useState("");
  const [evidenceSummary,setEvidenceSummary]=useState("");
  const [rootCauseMethod,setRootCauseMethod]=useState("FIVE_WHYS");
  const [rootCause,setRootCause]=useState("");
  const [riskLikelihood,setRiskLikelihood]=useState(1);
  const [riskImpact,setRiskImpact]=useState(1);
  const [actionType,setActionType]=useState<"CORRECTIVE"|"PREVENTIVE">("CORRECTIVE");
  const [description,setDescription]=useState("");
  const [ownerUserId,setOwnerUserId]=useState("");
  const [dueAt,setDueAt]=useState("");
  const [completionEvidence,setCompletionEvidence]=useState<Record<string,string>>({});
  const [verificationEvidence,setVerificationEvidence]=useState<Record<string,string>>({});
  const [verificationResult,setVerificationResult]=useState<Record<string,"PASS"|"FAIL">>({});
  const [closureReason,setClosureReason]=useState("");
  const [password,setPassword]=useState("");
  const [confirmed,setConfirmed]=useState(false);

  async function load(){const [i,c]=await Promise.all([fetch(`/api/quality/events/${event.id}/investigations`,{credentials:"same-origin"}),fetch(`/api/quality/events/${event.id}/capa`,{credentials:"same-origin"})]);const ib=await json(i);const cb=await json(c);if(i.ok)setInvestigations(ib?.data??[]);else setError(ib?.error??"Unable to load investigations");if(c.ok)setCapas(cb?.data??[]);else setError(cb?.error??"Unable to load CAPA actions");}
  useEffect(()=>{
    let active=true;
    Promise.all([
      fetch(`/api/quality/events/${event.id}/investigations`,{credentials:"same-origin"}),
      fetch(`/api/quality/events/${event.id}/capa`,{credentials:"same-origin"}),
    ]).then(async([i,c])=>({i,c,ib:await json(i),cb:await json(c)})).then(({i,c,ib,cb})=>{
      if(!active)return;
      if(i.ok)setInvestigations(ib?.data??[]);else setError(ib?.error??"Unable to load investigations");
      if(c.ok)setCapas(cb?.data??[]);else setError(cb?.error??"Unable to load CAPA actions");
    });
    return()=>{active=false;};
  },[event.id]);
  async function submit(url:string,body:unknown,success:string){setBusy(true);setError("");setNotice("");const response=await fetch(url,{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const result=await json(response);setBusy(false);if(!response.ok){setError(result?.error??"Quality event action failed");return false;}setNotice(success);await load();await onChanged();return true;}
  async function addInvestigation(e:FormEvent){e.preventDefault();if(await submit(`/api/quality/events/${event.id}/investigations`,{findings,affectedScope,evidenceSummary:evidenceSummary||null,rootCauseMethod,rootCause,riskLikelihood,riskImpact},"Investigation evidence recorded.")){setFindings("");setAffectedScope("");setEvidenceSummary("");setRootCause("");}}
  async function addCapa(e:FormEvent){e.preventDefault();if(await submit(`/api/quality/events/${event.id}/capa`,{actionType,description,ownerUserId,dueAt},"CAPA action created.")){setDescription("");setOwnerUserId("");setDueAt("");}}
  async function complete(capa:Capa){if(await submit(`/api/quality/events/${event.id}/capa/${capa.id}`,{operation:"COMPLETE",completionEvidence:completionEvidence[capa.id]??""},"CAPA action completed."))setCompletionEvidence(v=>({...v,[capa.id]:""}));}
  async function verify(capa:Capa){if(await submit(`/api/quality/events/${event.id}/capa/${capa.id}`,{operation:"VERIFY",result:verificationResult[capa.id]??"PASS",evidence:verificationEvidence[capa.id]??""},"Effectiveness check recorded."))setVerificationEvidence(v=>({...v,[capa.id]:""}));}
  async function close(e:FormEvent){e.preventDefault();if(await submit(`/api/quality/events/${event.id}/closure`,{closureReason,password,confirmed},"Quality event closed with electronic signature.")){setClosureReason("");setPassword("");setConfirmed(false);}}

  const sections=[
    {id:"investigation" as const,label:"Investigation & root cause",description:"Findings, affected scope, root-cause method, and risk assessment."},
    {id:"capa" as const,label:"CAPA & effectiveness",description:"Corrective/preventive actions, completion evidence, and effectiveness checks."},
    {id:"closure" as const,label:"Controlled closure",description:"Final closure prerequisites and electronic signature."},
  ];

  return <div className="module-section-stack">
    <div className="section-heading"><div><h3>Investigation, CAPA, and closure — {event.eventNumber}</h3><p>Open one governed quality action at a time.</p></div></div>
    <nav className="module-subnav" aria-label={`Governed actions for ${event.eventNumber}`}>{sections.map(item=><button key={item.id} type="button" className={section===item.id?"active":""} onClick={()=>setSection(item.id)}><strong>{item.label}</strong><span>{item.description}</span></button>)}</nav>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}

    {section==="investigation"&&<div className="module-section-stack"><h4>Investigation evidence</h4>{investigations.length?<ul>{investigations.map(i=><li key={i.id}>{i.rootCauseMethod}: {i.rootCause} · risk {i.riskScore} ({i.riskLikelihood}×{i.riskImpact})</li>)}</ul>:<p>No investigation evidence recorded.</p>}{canManage&&event.status!=="OPEN"&&event.status!=="CLOSED"&&<form onSubmit={addInvestigation} className="admin-form"><label>Findings<textarea required value={findings} onChange={e=>setFindings(e.target.value)} maxLength={10000}/></label><label>Affected scope<textarea required value={affectedScope} onChange={e=>setAffectedScope(e.target.value)} maxLength={5000}/></label><label>Evidence summary<textarea value={evidenceSummary} onChange={e=>setEvidenceSummary(e.target.value)} maxLength={5000}/></label><label>Root-cause method<select value={rootCauseMethod} onChange={e=>setRootCauseMethod(e.target.value)}><option value="FIVE_WHYS">Five Whys</option><option value="FISHBONE">Fishbone</option><option value="FAULT_TREE">Fault tree</option><option value="OTHER">Other</option></select></label><label>Root cause<textarea required value={rootCause} onChange={e=>setRootCause(e.target.value)} maxLength={5000}/></label><label>Likelihood (1–5)<input type="number" min={1} max={5} value={riskLikelihood} onChange={e=>setRiskLikelihood(Number(e.target.value))}/></label><label>Impact (1–5)<input type="number" min={1} max={5} value={riskImpact} onChange={e=>setRiskImpact(Number(e.target.value))}/></label><button disabled={busy}>Record investigation</button></form>}</div>}

    {section==="capa"&&<div className="module-section-stack"><h4>CAPA actions</h4>{capas.length?<ul>{capas.map(c=><li key={c.id}><strong>{c.actionType}</strong> — {c.description} · {c.status} · due {c.dueAt.slice(0,10)}{canManage&&c.status==="OPEN"&&<div><label>Completion evidence<textarea value={completionEvidence[c.id]??""} onChange={e=>setCompletionEvidence(v=>({...v,[c.id]:e.target.value}))}/></label><button type="button" disabled={busy||!(completionEvidence[c.id]??"").trim()} onClick={()=>void complete(c)}>Complete CAPA</button></div>}{canManage&&c.status==="COMPLETED"&&<div><label>Effectiveness result<select value={verificationResult[c.id]??"PASS"} onChange={e=>setVerificationResult(v=>({...v,[c.id]:e.target.value as "PASS"|"FAIL"}))}><option value="PASS">Pass</option><option value="FAIL">Fail</option></select></label><label>Effectiveness evidence<textarea value={verificationEvidence[c.id]??""} onChange={e=>setVerificationEvidence(v=>({...v,[c.id]:e.target.value}))}/></label><button type="button" disabled={busy||!(verificationEvidence[c.id]??"").trim()} onClick={()=>void verify(c)}>Record effectiveness</button></div>}</li>)}</ul>:<p>No CAPA actions recorded.</p>}{canManage&&event.status!=="OPEN"&&event.status!=="CLOSED"&&<form onSubmit={addCapa} className="admin-form"><label>Action type<select value={actionType} onChange={e=>setActionType(e.target.value as "CORRECTIVE"|"PREVENTIVE")}><option value="CORRECTIVE">Corrective</option><option value="PREVENTIVE">Preventive</option></select></label><label>Description<textarea required value={description} onChange={e=>setDescription(e.target.value)} maxLength={5000}/></label><label>Owner user ID<input required value={ownerUserId} onChange={e=>setOwnerUserId(e.target.value)}/></label><label>Due date<input required type="date" value={dueAt} onChange={e=>setDueAt(e.target.value)}/></label><button disabled={busy}>Create CAPA</button></form>}</div>}

    {section==="closure"&&<div className="module-section-stack"><h4>Controlled final closure</h4><p>Closure is accepted only when investigation exists, all CAPAs are complete, and each CAPA has a passing effectiveness check. Password reauthentication and electronic-signature evidence are required.</p>{canManage&&event.status==="VERIFICATION"?<form onSubmit={close} className="admin-form"><label>Closure reason<textarea required value={closureReason} onChange={e=>setClosureReason(e.target.value)} maxLength={5000}/></label><label>Password<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I confirm this quality event is complete, required CAPA actions have been implemented and verified effective, and the event may be closed.</label><button disabled={busy||!confirmed||!closureReason.trim()||!password}>Close with electronic signature</button></form>:<p>{event.status==="CLOSED"?"This quality event is closed.":"Controlled closure becomes available after the event reaches verification and all prerequisites are satisfied."}</p>}</div>}
  </div>;
}
