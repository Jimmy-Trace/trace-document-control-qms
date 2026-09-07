"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

type Employee = { id: string; employeeNumber: string; firstName: string; lastName: string; status: "ACTIVE" | "INACTIVE" | "TERMINATED" };
type Qualification = { id: string; employeeId: string; qualificationType: string; qualificationScope: string | null; qualifiedAt: string; expiresAt: string | null; fileId: string | null; createdAt: string };

export function PersonnelQualificationWorkspace({ canManage, today }: { canManage: boolean; today: string }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [employeeResponse, qualificationResponse] = await Promise.all([
      fetch("/api/personnel", { credentials: "same-origin" }),
      fetch("/api/personnel/qualifications", { credentials: "same-origin" }),
    ]);
    if (employeeResponse.ok) setEmployees((await employeeResponse.json()).data ?? []);
    if (qualificationResponse.ok) setQualifications((await qualificationResponse.json()).data ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch("/api/personnel", { credentials: "same-origin" }),
      fetch("/api/personnel/qualifications", { credentials: "same-origin" }),
    ]).then(async ([employeeResponse, qualificationResponse]) => {
      if (cancelled) return;
      if (employeeResponse.ok) {
        const body = await employeeResponse.json();
        if (!cancelled) setEmployees(body.data ?? []);
      }
      if (qualificationResponse.ok) {
        const body = await qualificationResponse.json();
        if (!cancelled) setQualifications(body.data ?? []);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const todayStart = useMemo(() => new Date(`${today}T00:00:00.000Z`).getTime(), [today]);

  async function createQualification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setNotice("");
    const response = await fetch("/api/personnel/qualifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        employeeId: String(form.get("employeeId")),
        qualificationType: String(form.get("qualificationType")),
        qualificationScope: String(form.get("qualificationScope")) || null,
        qualifiedAt: String(form.get("qualifiedAt")),
        expiresAt: String(form.get("expiresAt")) || null,
        fileId: String(form.get("fileId")) || null,
      }),
    });
    const body = await response.json().catch(() => null); setBusy(false);
    if (!response.ok) return setNotice(body?.error || "Qualification could not be created.");
    event.currentTarget.reset();
    setNotice("Qualification recorded with audit evidence. Requalification should be recorded as a new entry.");
    await load();
  }

  return <section className="workspace-section" aria-labelledby="personnel-qualification-heading">
    <div className="section-heading"><div><p className="eyebrow">Personnel qualifications</p><h2 id="personnel-qualification-heading">Qualification evidence</h2><p>Record governed qualification decisions and supporting evidence without rewriting historical qualification records.</p></div></div>
    {canManage && <form onSubmit={createQualification} className="admin-form">
      <label>Employee<select name="employeeId" defaultValue="" required><option value="" disabled>Select employee</option>{employees.filter((employee) => employee.status !== "TERMINATED").map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeNumber} · {employee.lastName}, {employee.firstName}</option>)}</select></label>
      <label>Qualification type<input name="qualificationType" maxLength={160} required /></label>
      <label>Qualification scope<textarea name="qualificationScope" maxLength={500} /></label>
      <label>Qualified date<input name="qualifiedAt" type="date" required /></label>
      <label>Expiration date<input name="expiresAt" type="date" /></label>
      <label>Evidence file UUID<input name="fileId" placeholder="Optional AVAILABLE file UUID" /></label>
      <button type="submit" disabled={busy}>Record qualification</button>
    </form>}
    {notice && <p role="status">{notice}</p>}
    <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Qualification</th><th>Scope</th><th>Qualified</th><th>Expires</th><th>Status</th><th>Evidence</th></tr></thead><tbody>
      {qualifications.map((qualification) => {
        const employee = employeeById.get(qualification.employeeId);
        const expired = qualification.expiresAt ? new Date(qualification.expiresAt).getTime() < todayStart : false;
        return <tr key={qualification.id}><td>{employee ? `${employee.employeeNumber} · ${employee.lastName}, ${employee.firstName}` : qualification.employeeId}</td><td>{qualification.qualificationType}</td><td>{qualification.qualificationScope ?? "—"}</td><td>{new Date(qualification.qualifiedAt).toLocaleDateString()}</td><td>{qualification.expiresAt ? new Date(qualification.expiresAt).toLocaleDateString() : "—"}</td><td>{expired ? "EXPIRED" : "CURRENT"}</td><td>{qualification.fileId ? "Attached" : "—"}</td></tr>;
      })}
      {!qualifications.length && <tr><td colSpan={7}>No governed personnel qualifications have been recorded.</td></tr>}
    </tbody></table></div>
  </section>;
}
