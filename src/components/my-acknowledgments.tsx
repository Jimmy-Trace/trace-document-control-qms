"use client";

import { useState, type FormEvent } from "react";

type Assignment = {
  assignmentId: string;
  documentId: string;
  documentVersionId: string;
  documentNumber: string;
  title: string;
  revisionLabel: string;
  contentHash: string;
  dueAt: string | null;
  assignedAt: string;
  dueState: "UPCOMING" | "DUE" | "OVERDUE";
  daysUntilDue: number | null;
};

const meaning = "I acknowledge that I have read and understand this controlled document.";

export function MyAcknowledgments() {
  const [open, setOpen] = useState(false);
  const [organizationId, setOrganizationId] = useState("");
  const [items, setItems] = useState<Assignment[]>([]);
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadQueue() {
    setBusy(true);
    setError("");
    const workspace = await fetch("/api/workspace/dashboard", { credentials: "same-origin" });
    const workspaceBody = await workspace.json().catch(() => null);
    if (!workspace.ok) {
      setBusy(false);
      setError(workspaceBody?.error || "Unable to load acknowledgment workspace.");
      return;
    }
    const orgId = String(workspaceBody.data.organizationId);
    setOrganizationId(orgId);
    const response = await fetch(`/api/documents/acknowledgments?organizationId=${encodeURIComponent(orgId)}&scope=mine`, { credentials: "same-origin" });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) {
      setItems([]);
      setError(response.status === 403 ? "Your account does not have acknowledgment access." : body?.error || "Unable to load acknowledgments.");
      return;
    }
    setItems(body.data as Assignment[]);
  }

  async function openPanel() {
    setOpen(true);
    setNotice("");
    setSelected(null);
    await loadQueue();
  }

  async function complete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !organizationId) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/documents/acknowledgments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        operation: "COMPLETE",
        organizationId,
        assignmentId: selected.assignmentId,
        password: String(form.get("password")),
        confirmed: form.get("confirmed") === "on",
      }),
    });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) {
      setError(body?.error || "Acknowledgment could not be completed.");
      return;
    }
    setNotice(`Acknowledgment recorded for ${selected.documentNumber} v${selected.revisionLabel}.`);
    setSelected(null);
    await loadQueue();
  }

  return (
    <>
      <button type="button" style={{ position: "fixed", right: 24, bottom: 80, zIndex: 80 }} onClick={openPanel}>
        My acknowledgments
      </button>
      {open && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="my-acknowledgments-title">
            <div className="modal-head">
              <div>
                <h2 id="my-acknowledgments-title">My acknowledgments</h2>
                <p>Read and acknowledge the exact effective controlled-document version assigned to you.</p>
              </div>
              <button aria-label="Close acknowledgments" onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="detail-body">
              {notice && <div className="notice" role="status"><span>{notice}</span></div>}
              {error && <div className="detail-error" role="alert">{error}</div>}
              {busy && items.length === 0 && <p>Loading acknowledgments…</p>}
              {!busy && !error && items.length === 0 && (
                <div className="permission-state">
                  <strong>No outstanding acknowledgments</strong>
                  <span>You have no active read-and-understand assignments.</span>
                </div>
              )}
              {items.length > 0 && !selected && (
                <div className="review-list">
                  {items.map((item) => (
                    <button key={item.assignmentId} type="button" className="review-row" onClick={() => { setError(""); setSelected(item); }}>
                      <span>
                        <strong>{item.documentNumber} · v{item.revisionLabel}</strong>
                        <small>{item.title}</small>
                      </span>
                      <span>
                        <strong>{item.dueState}</strong>
                        <small>{item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "No due date"}</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {selected && (
                <form className="approval-box" onSubmit={complete}>
                  <button type="button" onClick={() => { setSelected(null); setError(""); }}>← Back to queue</button>
                  <div>
                    <strong>{selected.documentNumber} · v{selected.revisionLabel}</strong>
                    <p>{selected.title}</p>
                  </div>
                  <dl>
                    <dt>Status</dt><dd>{selected.dueState}</dd>
                    <dt>Assigned</dt><dd>{new Date(selected.assignedAt).toLocaleString()}</dd>
                    <dt>Due</dt><dd>{selected.dueAt ? new Date(selected.dueAt).toLocaleString() : "No due date"}</dd>
                    <dt>Version ID</dt><dd><code>{selected.documentVersionId}</code></dd>
                    <dt>Content SHA-256</dt><dd><code>{selected.contentHash}</code></dd>
                  </dl>
                  <p><strong>Electronic acknowledgment meaning</strong><br />{meaning}</p>
                  <label>
                    <input name="confirmed" type="checkbox" required /> I confirm the acknowledgment meaning above.
                  </label>
                  <label>
                    Re-enter your password
                    <input name="password" type="password" autoComplete="current-password" required maxLength={1024} />
                  </label>
                  <button className="primary-button" type="submit" disabled={busy}>Record acknowledgment</button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
