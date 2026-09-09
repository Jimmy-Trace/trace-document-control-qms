"use client";
import { useEffect,useState } from "react";

type Definition={id:string;code:string;name:string;sourceKey:string};
type Execution={id:string;reportCode:string;reportName:string;rowCount:number;executedAt:string};
type Finalized={id:string;reportExecutionId:string;reportCode:string;reportName:string;rowCount:number;finalizedAt:string};

export function ReportingWorkspace({canManage,canExport}:{canManage:boolean;canExport:boolean}){
  const [definitions,setDefinitions]=useState<Definition[]>([]),[selected,setSelected]=useState<string>(""),[executions,setExecutions]=useState<Execution[]>([]),[finalized,setFinalized]=useState<Finalized[]>([]),[message,setMessage]=useState("");
  const loadDefinitions=async()=>{const r=await fetch("/api/reporting");if(r.ok){const j=await r.json();setDefinitions(j.data??[]);if(!selected&&j.data?.[0])setSelected(j.data[0].id);}};
  const loadExecutions=async(id:string)=>{if(!id)return setExecutions([]);const r=await fetch(`/api/reporting?reportDefinitionId=${encodeURIComponent(id)}`);if(r.ok)setExecutions((await r.json()).data??[]);};
  const loadFinalized=async()=>{const r=await fetch("/api/reporting/finalized");if(r.ok)setFinalized((await r.json()).data??[]);};
  useEffect(()=>{void loadDefinitions();void loadFinalized();},[]);
  useEffect(()=>{void loadExecutions(selected);},[selected]);
  const execute=async()=>{if(!selected)return;setMessage("");const r=await fetch("/api/reporting",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({operation:"execute",reportDefinitionId:selected,parameters:{}})});setMessage(r.ok?"Report executed.":((await r.json()).error??"Execution failed"));if(r.ok)void loadExecutions(selected);};
  const finalize=async(reportExecutionId:string)=>{const r=await fetch("/api/reporting/finalized",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({operation:"finalize-execution",reportExecutionId})});setMessage(r.ok?"Report finalized.":((await r.json()).error??"Finalization failed"));if(r.ok)void loadFinalized();};
  return <section aria-labelledby="reporting-workspace-title"><h2 id="reporting-workspace-title">Reporting & Analytics</h2><p>Run governed reports, review execution history, and access finalized report exports.</p><label>Report <select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Select report</option>{definitions.map(d=><option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}</select></label><button type="button" onClick={execute} disabled={!selected}>Run report</button>{message&&<p role="status">{message}</p>}<h3>Execution history</h3>{executions.length===0?<p>No executions.</p>:<ul>{executions.map(e=><li key={e.id}>{e.reportCode} — {e.rowCount} rows — {new Date(e.executedAt).toLocaleString()} {canManage&&<button type="button" onClick={()=>finalize(e.id)}>Finalize</button>}</li>)}</ul>}<h3>Finalized reports</h3>{finalized.length===0?<p>No finalized reports.</p>:<ul>{finalized.map(f=><li key={f.id}>{f.reportCode} — {f.rowCount} rows — {new Date(f.finalizedAt).toLocaleString()} {canExport&&<a href={`/api/reporting/finalized?finalizedReportId=${encodeURIComponent(f.id)}`}>Export CSV</a>}</li>)}</ul>}</section>;
}
