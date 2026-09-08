"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { competencyDashboard, competencyRollups, type CompetencyAssessmentSummary } from "@/lib/training/competency-rollup";

type Employee = { id: string; employeeNumber: string; firstName: string; lastName: string; status: "ACTIVE" | "INACTIVE" | "TERMINATED" };
type Program = { id: string; code: string; title: string; active: boolean; validityDays: number | null };
type Element = { id: string; programId: string; code: string; title: string; required: boolean; sortOrder: number };
type Assessment = CompetencyAssessmentSummary & { fileId: string | null; notes: string | null };

export function CompetencyManagementWorkspace({ canManage, today }: { canManage: boolean; today: string }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [elements, setElements] = useState<Element[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [employeeResponse, programResponse, assessmentResponse] = await Promise.all([
      fetch("/api/personnel", { credentials: "same-origin" }),
      fetch("/api/training/competency/programs", { credentials: "same-origin" }),
      fetch("/api/training/competency/assessments", { credentials: "same-origin" }),
    ]);
    const employeeBody = employeeResponse.ok ? await employeeResponse.json() : null;
    const programBody = programResponse.ok ? await programResponse.json() : null;
    const assessmentBody = assessmentResponse.ok ? await assessmentResponse.json() : null;
    setEmployees(employeeBody?.data ?? []);
    setPrograms(programBody?.data ?? []);
    setAssessments(assessmentBody?.data ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch("/api/personnel", { credentials: "same-origin" }),
      fetch("/api/training/competency/programs", { credentials: "same-origin" }),
      fetch("/api/training/competency/assessments", { credentials: "same-origin" }),
    ]).then(async ([employeeResponse, programResponse, assessmentResponse]) => {
      const [employeeBody, programBody, assessmentBody] = await Promise.all([
        employeeResponse.ok ? employeeResponse.json() : null,
        programResponse.ok ? programResponse.json() : null,
        assessmentResponse.ok ? assessmentResponse.json() : null,
      ]);
      if (!cancelled) {
        setEmployees(employeeBody?.data ?? []);
        setPrograms(programBody?.data ?? []);
        setAssessments(assessmentBody?.data ?? []);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedProgramId) return;
    let cancelled = false;
    void fetch(`/api/training/competency/elements?programId=${encodeURIComponent(selectedProgramId)}`, { credentials: "same-origin" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((body) => { if (!cancelled) setElements(body?.data ?? []); });
    return () => { cancelled = true; };
  }, [selectedProgramId]);

  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const programById = useMemo(() => new Map(programs.map((program) => [program.id, program])), [programs]);
  const rollups = useMemo(() => competencyRollups(assessments, today), [assessments, today]);
  const dashboard = useMemo(() => competencyDashboard(rollups), [rollups]);

  async function submit(path: string, payload: unknown, form: HTMLFormElement) {
    setBusy(true); setNotice("");
    const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) return setNotice(body?.error || "Competency operation failed.");
    form.reset();
    setNotice("Competency operation recorded with audit evidence.");
    await load();
  }

  async function createProgram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await submit("/api/training/competency/programs", {
      code: String(form.get("code")), title: String(form.get("title")), description: String(form.get("description")) || null,
      validityDays: form.get("validityDays") ? Number(form.get("validityDays")) : null,
    }, event.currentTarget);
  }

  async function createElement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await submit("/api/training/competency/elements", {
      programId: String(form.get("programId")), code: String(form.get("code")), title: String(form.get("title")),
      method: String(form.get("method")) || null, required: form.get("required") === "on", sortOrder: Number(form.get("sortOrder") || 0),
    }, event.currentTarget);
  }

  async function createAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const programId = String(form.get("programId"));
    const programElements = elements.filter((element) => element.programId === programId);
    const elementResults = programElements.map((element) => ({ elementId: element.id, outcome: String(form.get(`outcome:${element.id}`)) as "PASS" | "FAIL" | "NOT_APPLICABLE", notes: null }));
    await submit("/api/training/competency/assessments", {
      employeeId: String(form.get("employeeId")), programId, assessedAt: new Date(String(form.get("assessedAt"))).toISOString(),
      outcome: String(form.get("outcome")), expiresAt: String(form.get("expiresAt")) || null,
      fileId: String(form.get("fileId")) || null, notes: String(form.get("notes")) || null, elementResults,
    }, event.currentTarget);
  }

  return <section className="workspace-section" aria-labelledby="competency-heading">
    <div className="section-heading"><div><p className="eyebrow">Training & competency</p><h2 id="competency-heading">Competency management</h2><p>Manage competency programs and append-only assessments while deriving current status, expiration, and reassessment reminders from immutable history.</p></div></div>
    <div className="stats-grid">
      <article><strong>{dashboard.total}</strong><span>Tracked</span></article><article><strong>{dashboard.current}</strong><span>Current</span></article><article><strong>{dashboard.dueSoon}</strong><span>Due within 30 days</span></article><article><strong>{dashboard.expired}</strong><span>Expired</span></article><article><strong>{dashboard.notQualified}</strong><span>Not qualified</span></article><article><strong>{dashboard.conditional}</strong><span>Conditional</span></article>
    </div>
    {canManage && <>
      <form onSubmit={createProgram} className="admin-form"><label>Program code<input name="code" maxLength={80} required /></label><label>Program title<input name="title" maxLength={240} required /></label><label>Validity days<input name="validityDays" type="number" min={1} max={3650} /></label><label>Description<textarea name="description" maxLength={2000} /></label><button type="submit" disabled={busy}>Create competency program</button></form>
      <form onSubmit={createElement} className="admin-form"><label>Program<select name="programId" defaultValue="" required><option value="" disabled>Select program</option>{programs.filter((program) => program.active).map((program) => <option key={program.id} value={program.id}>{program.code} · {program.title}</option>)}</select></label><label>Element code<input name="code" maxLength={80} required /></label><label>Element title<input name="title" maxLength={240} required /></label><label>Method<input name="method" maxLength={500} /></label><label>Sort order<input name="sortOrder" type="number" min={0} defaultValue={0} /></label><label><input name="required" type="checkbox" defaultChecked /> Required element</label><button type="submit" disabled={busy}>Add competency element</button></form>
      <form onSubmit={createAssessment} className="admin-form">
        <label>Employee<select name="employeeId" defaultValue="" required><option value="" disabled>Select employee</option>{employees.filter((employee) => employee.status !== "TERMINATED").map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeNumber} · {employee.lastName}, {employee.firstName}</option>)}</select></label>
        <label>Program<select name="programId" value={selectedProgramId} onChange={(event) => { setElements([]); setSelectedProgramId(event.target.value); }} required><option value="" disabled>Select program</option>{programs.filter((program) => program.active).map((program) => <option key={program.id} value={program.id}>{program.code} · {program.title}</option>)}</select></label>
        <label>Assessed at<input name="assessedAt" type="datetime-local" required /></label><label>Overall outcome<select name="outcome" defaultValue="QUALIFIED"><option value="QUALIFIED">Qualified</option><option value="CONDITIONAL">Conditional</option><option value="NOT_QUALIFIED">Not qualified</option></select></label><label>Explicit expiration<input name="expiresAt" type="date" /></label><label>Evidence file UUID<input name="fileId" placeholder="Optional AVAILABLE file UUID" /></label><label>Notes<textarea name="notes" maxLength={2000} /></label>
        {elements.map((element) => <label key={element.id}>{element.code} · {element.title}{element.required ? " *" : ""}<select name={`outcome:${element.id}`} defaultValue="PASS" required><option value="PASS">Pass</option><option value="FAIL">Fail</option>{!element.required && <option value="NOT_APPLICABLE">Not applicable</option>}</select></label>)}
        <button type="submit" disabled={busy || !selectedProgramId || elements.length === 0}>Record competency assessment</button>
      </form>
    </>}
    {notice && <p role="status">{notice}</p>}
    <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Program</th><th>Latest assessment</th><th>Expires</th><th>Status</th></tr></thead><tbody>{rollups.map((rollup) => { const employee = employeeById.get(rollup.employeeId); const program = programById.get(rollup.programId); return <tr key={`${rollup.employeeId}:${rollup.programId}`}><td>{employee ? `${employee.employeeNumber} · ${employee.lastName}, ${employee.firstName}` : rollup.employeeId}</td><td>{program ? `${program.code} · ${program.title}` : rollup.programId}</td><td>{new Date(rollup.assessedAt).toLocaleDateString()}</td><td>{rollup.expiresAt ? new Date(rollup.expiresAt).toLocaleDateString() : "—"}</td><td>{rollup.status}</td></tr>; })}{!rollups.length && <tr><td colSpan={5}>No competency assessments have been recorded.</td></tr>}</tbody></table></div>
  </section>;
}
