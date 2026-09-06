"use client";

import { useEffect, useState, type FormEvent } from "react";

type ApiStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "EFFECTIVE"
  | "SUPERSEDED"
  | "RETIRED";

type DocumentRow = {
  id: string;
  documentNumber: string;
  title: string;
  revisionLabel: string;
  status: ApiStatus;
  effectiveAt: string | null;
};

type DocumentPage = { items: DocumentRow[] };

type DetailVersion = {
  id: string;
  documentId: string;
  documentNumber: string;
  title: string;
  revisionLabel: string;
  status: ApiStatus;
  lockVersion: number;
  contentText: string | null;
  changeSummary: string;
  effectiveAt: string | null;
};

type DocumentDetail = {
  selected: DetailVersion;
};

type DashboardData = {
  capabilities: {
    canCreateDocuments: boolean;
    canMakeDocumentsEffective: boolean;
  };
};

export function LifecycleOperations() {
  const [open, setOpen] = useState(false);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [capabilities, setCapabilities] = useState<DashboardData["capabilities"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);

  async function loadDocuments() {
    const response = await fetch("/api/documents?limit=100", { credentials: "same-origin" });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error || "Unable to load controlled documents.");
      return;
    }
    const page = body.data as DocumentPage;
    setDocuments(page.items);
    if (!selectedId && page.items.length) setSelectedId(page.items[0].id);
  }

  async function loadDetail(versionId: string) {
    if (!versionId) {
      setDetail(null);
      return;
    }
    const response = await fetch(`/api/documents/${versionId}`, { credentials: "same-origin" });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error || "Unable to load lifecycle detail.");
      setDetail(null);
      return;
    }
    setDetail(body.data as DocumentDetail);
  }

  useEffect(() => {
    if (!open) return;
    setError("");
    fetch("/api/workspace/dashboard", { credentials: "same-origin" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((body) => setCapabilities(body?.data?.capabilities ?? null))
      .catch(() => setCapabilities(null));
    void loadDocuments();
  }, [open]);

  useEffect(() => {
    if (!open || !selectedId) return;
    void loadDetail(selectedId);
  }, [open, selectedId]);

  async function refresh(versionId?: string) {
    await loadDocuments();
    if (versionId) await loadDetail(versionId);
  }

  async function retire() {
    if (!detail) return;
    const reason = window.prompt("Enter the required controlled retirement reason");
    if (!reason?.trim()) return;
    if (!window.confirm(`Retire ${detail.selected.documentNumber} v${detail.selected.revisionLabel}? This preserves the historical version but removes it from current operational use.`)) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/documents/commands", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        operation: "TRANSITION",
        versionId: detail.selected.id,
        command: "RETIRE",
        expectedLockVersion: detail.selected.lockVersion,
        reason: reason.trim(),
      }),
    });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) {
      setError(body?.error || "The document could not be retired.");
      return;
    }
    setNotice("Document retired with append-only audit evidence.");
    await refresh(detail.selected.id);
  }

  async function makeEffectiveNow() {
    if (!detail) return;
    if (!window.confirm(`Make ${detail.selected.documentNumber} v${detail.selected.revisionLabel} effective now?`)) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/documents/commands", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        operation: "TRANSITION",
        versionId: detail.selected.id,
        command: "MAKE_EFFECTIVE",
        expectedLockVersion: detail.selected.lockVersion,
      }),
    });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) {
      setError(body?.error || "The document could not be made effective.");
      return;
    }
    setNotice("Document made effective; prior current version was superseded atomically.");
    await refresh(detail.selected.id);
  }

  async function scheduleEffectiveness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    const form = new FormData(event.currentTarget);
    const rawDate = String(form.get("effectiveAt"));
    const effectiveAt = new Date(rawDate);
    setBusy(true);
    setError("");
    const response = await fetch("/api/documents/effectiveness", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        versionId: detail.selected.id,
        expectedLockVersion: detail.selected.lockVersion,
        effectiveAt: effectiveAt.toISOString(),
        reason: String(form.get("reason")),
      }),
    });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) {
      setError(body?.error || "The effective date could not be scheduled.");
      return;
    }
    setScheduleOpen(false);
    setNotice(`Effectiveness scheduled for ${effectiveAt.toLocaleString()}.`);
    await refresh(detail.selected.id);
  }

  async function createRevision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    const response = await fetch("/api/documents/commands", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        operation: "CREATE_REVISION",
        sourceVersionId: detail.selected.id,
        revisionLabel: String(form.get("revisionLabel")),
        contentText: String(form.get("contentText")),
        changeSummary: String(form.get("changeSummary")),
      }),
    });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) {
      setError(body?.error || "The successor revision could not be created.");
      return;
    }
    setRevisionOpen(false);
    setSelectedId(body.data.id);
    setNotice("Successor revision created from the current effective version.");
    await refresh(body.data.id);
  }

  const selected = detail?.selected;
  const canControl = Boolean(capabilities?.canMakeDocumentsEffective);
  const canRevise = Boolean(capabilities?.canCreateDocuments);
  const scheduled = selected?.status === "APPROVED" && Boolean(selected.effectiveAt);

  return (
    <>
      <button
        type="button"
        className="primary-button"
        style={{ position: "fixed", right: 24, bottom: 24, zIndex: 80 }}
        onClick={() => setOpen(true)}
      >
        Lifecycle operations
      </button>
      {open && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="lifecycle-title">
            <div className="modal-head">
              <div>
                <div>
                  <h2 id="lifecycle-title">Lifecycle operations</h2>
                  <p>Controlled successor revision, effectiveness, and retirement actions.</p>
                </div>
              </div>
              <button aria-label="Close lifecycle operations" onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="detail-body">
              {notice && <div className="notice" role="status"><span>{notice}</span></div>}
              {error && <div className="detail-error" role="alert">{error}</div>}
              <label>
                Controlled document version
                <select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setNotice(""); setError(""); }}>
                  {documents.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.documentNumber} · v{item.revisionLabel} · {item.status.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              {selected && (
                <section className="content-card">
                  <h3>{selected.documentNumber} · {selected.title}</h3>
                  <p>Revision {selected.revisionLabel} · {selected.status.replaceAll("_", " ")}</p>
                  <small>
                    {selected.effectiveAt
                      ? `${selected.status === "APPROVED" ? "Scheduled effective" : "Effective"}: ${new Date(selected.effectiveAt).toLocaleString()}`
                      : "No effective date is currently recorded."}
                  </small>
                </section>
              )}
              <div className="detail-actions">
                <span>Only server-authorized lifecycle actions are offered here.</span>
                <div>
                  {selected?.status === "EFFECTIVE" && canRevise && (
                    <button disabled={busy} onClick={() => setRevisionOpen(true)}>Create successor revision</button>
                  )}
                  {selected?.status === "APPROVED" && canControl && (
                    <>
                      <button disabled={busy || scheduled} onClick={() => setScheduleOpen(true)}>
                        {scheduled ? "Effectiveness scheduled" : "Schedule effective date"}
                      </button>
                      <button className="primary-button" disabled={busy || scheduled} onClick={makeEffectiveNow}>
                        Make effective now
                      </button>
                    </>
                  )}
                  {selected?.status === "EFFECTIVE" && canControl && (
                    <button disabled={busy} onClick={retire}>Retire document</button>
                  )}
                </div>
              </div>
              {selected?.status === "SUPERSEDED" && (
                <div className="permission-state">
                  <strong>Historical version</strong>
                  <span>Successor revisions must be created from the current effective version, not a superseded branch.</span>
                </div>
              )}
              {selected?.status === "RETIRED" && (
                <div className="permission-state">
                  <strong>Terminal lifecycle state</strong>
                  <span>Retired versions remain historical evidence and cannot return to operational use.</span>
                </div>
              )}
              {scheduleOpen && selected && (
                <form className="approval-box" onSubmit={scheduleEffectiveness}>
                  <strong>Schedule future effectiveness</strong>
                  <label>
                    Effective date and time
                    <input name="effectiveAt" type="datetime-local" required min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} />
                  </label>
                  <label>
                    Controlled reason
                    <textarea name="reason" required maxLength={4000} />
                  </label>
                  <div>
                    <button type="button" onClick={() => setScheduleOpen(false)}>Cancel</button>
                    <button className="primary-button" type="submit" disabled={busy}>Schedule effectiveness</button>
                  </div>
                </form>
              )}
              {revisionOpen && selected && (
                <form className="approval-box" onSubmit={createRevision}>
                  <strong>Create successor from current effective version</strong>
                  <label>
                    Revision label
                    <input name="revisionLabel" required maxLength={50} placeholder="1.1" />
                  </label>
                  <label>
                    Controlled content
                    <textarea name="contentText" required maxLength={1_000_000} defaultValue={selected.contentText ?? ""} />
                  </label>
                  <label>
                    Change summary
                    <textarea name="changeSummary" required maxLength={4000} />
                  </label>
                  <div>
                    <button type="button" onClick={() => setRevisionOpen(false)}>Cancel</button>
                    <button className="primary-button" type="submit" disabled={busy}>Create successor</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
