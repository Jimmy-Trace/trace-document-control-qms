"use client";

import { useState, type FormEvent } from "react";

type ApprovalTask = {
  id: string;
  documentVersionId: string;
  documentNumber: string;
  title: string;
  revisionLabel: string;
  assigneeUserId: string | null;
};
type Approver = { id: string; name: string };
type Queue = { tasks: ApprovalTask[]; approvers: Approver[] };

export function ApprovalOperations({ embedded = false }: { embedded?: boolean }) {
  const [open, setOpen] = useState(embedded);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadQueue() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/documents/approval-assignment", { credentials: "same-origin" });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) {
      setQueue(null);
      setError(response.status === 403 ? "Approval assignment requires review-management access." : body?.error || "Unable to load approval assignments.");
      return;
    }
    const next = body.data as Queue;
    setQueue(next);
    setSelectedTaskId((current) => current || next.tasks[0]?.id || "");
  }

  async function openPanel() {
    setOpen(true);
    setNotice("");
    await loadQueue();
  }

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    const response = await fetch("/api/documents/approval-assignment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workflowTaskId: selectedTaskId, approverUserId: String(form.get("approverUserId")), reason: String(form.get("reason")) }),
    });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) {
      setError(body?.error || "The approval assignment could not be completed.");
      return;
    }
    setNotice("Final approver assigned with notification and audit evidence.");
    event.currentTarget.reset();
    await loadQueue();
  }

  const selectedTask = queue?.tasks.find((task) => task.id === selectedTaskId);
  const content = (
    <div className={embedded ? "admin-section-stack" : "detail-body"}>
      {embedded && <div className="section-heading"><h3>Approval assignments</h3><p>Assign an eligible final approver before electronic signature.</p></div>}
      {notice && <div className="notice" role="status"><span>{notice}</span></div>}
      {error && <div className="detail-error" role="alert">{error}</div>}
      {busy && !queue && <p>Loading approval assignments…</p>}
      {!queue && !busy && embedded && <button type="button" className="secondary-button" onClick={loadQueue}>Load approval assignments</button>}
      {queue && queue.tasks.length === 0 && <div className="permission-state"><strong>No active approval tasks</strong><span>Documents appear here after all required review stages are completed.</span></div>}
      {queue && queue.tasks.length > 0 && (
        <form className="approval-box" onSubmit={assign}>
          <label>Approval task<select value={selectedTaskId} onChange={(event) => setSelectedTaskId(event.target.value)} required>{queue.tasks.map((task) => <option key={task.id} value={task.id}>{task.documentNumber} · v{task.revisionLabel} · {task.title}</option>)}</select></label>
          {selectedTask?.assigneeUserId && <small>This task already has an approver and may be reassigned with a controlled reason.</small>}
          <label>Final approver<select name="approverUserId" required defaultValue=""><option value="" disabled>Select an eligible approver</option>{queue.approvers.map((approver) => <option key={approver.id} value={approver.id}>{approver.name}</option>)}</select></label>
          <label>Controlled reason<textarea name="reason" required maxLength={4000} /></label>
          <button className="primary-button" type="submit" disabled={busy}>Assign final approver</button>
        </form>
      )}
    </div>
  );

  if (embedded) return content;
  return <><button type="button" style={{ position: "fixed", right: 210, bottom: 24, zIndex: 80 }} onClick={openPanel}>Approval assignments</button>{open && <div className="modal-backdrop" role="presentation"><div className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="approval-operations-title"><div className="modal-head"><div><h2 id="approval-operations-title">Approval assignments</h2><p>Assign an eligible final approver before electronic signature.</p></div><button aria-label="Close approval assignments" onClick={() => setOpen(false)}>×</button></div>{content}</div></div>}</>;
}
