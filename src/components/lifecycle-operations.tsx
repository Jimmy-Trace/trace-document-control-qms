"use client";

import { useState, type FormEvent } from "react";

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
  const [scheduleMin, setScheduleMin] = useState("");

  async function fetchDocuments() {
    const response = await fetch("/api/documents?limit=100", {
      credentials: "same-origin",
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.error || "Unable to load controlled documents.");
    }
    return (body.data as DocumentPage).items;
  }

  async function fetchDetail(versionId: string) {
    const response = await fetch(`/api/documents/${versionId}`, {
      credentials: "same-origin",
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.error || "Unable to load lifecycle detail.");
    }
    return body.data as DocumentDetail;
  }

  async function openPanel() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const [dashboardResponse, items] = await Promise.all([
        fetch("/api/workspace/dashboard", { credentials: "same-origin" }),
        fetchDocuments(),
      ]);
      const dashboardBody = await dashboardResponse.json().catch(() => null);
      setCapabilities(
        dashboardResponse.ok ? dashboardBody?.data?.capabilities ?? null : null,
      );
      setDocuments(items);
      const nextSelectedId = selectedId || items[0]?.id || "";
      setSelectedId(nextSelectedId);
      setDetail(nextSelectedId ? await fetchDetail(nextSelectedId) : null);
      setOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load lifecycle operations.");
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  async function selectVersion(versionId: string) {
    setSelectedId(versionId);
    setNotice("");
    setError("");
    setScheduleOpen(false);
    setRevisionOpen(false);
    if (!versionId) {
      setDetail(null);
      return;
    }
    setBusy(true);
    try {
      setDetail(await fetchDetail(versionId));
    } catch (cause) {
      setDetail(null);
      setError(cause instanceof Error ? cause.message : "Unable to load lifecycle detail.");
    } finally {
      setBusy(false);
    }
  }

  async function refresh(versionId?: string) {
    try {
      const items = await fetchDocuments();
      setDocuments(items);
      const targetId = versionId || selectedId || items[0]?.id || "";
      setSelectedId(targetId);
      setDetail(targetId ? await fetchDetail(targetId) : null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to refresh lifecycle state.");
    }
  }

  async function retire() {
    if (!detail) return;
    const reason = window.prompt("Enter the required controlled retirement reason");
    if (!reason?.trim()) return;
    if (
      !window.confirm(
        `Retire ${detail.selected.documentNumber} v${detail.selected.revisionLabel}? This preserves the historical version but removes it from current operational use.`,
      )
    )
      return;
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
    if (
      !window.confirm(
        `Make ${detail.selected.documentNumber} v${detail.selected.revisionLabel} effective now?`,
      )
    )
      return;
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
    setNotice(
      "Document made effective; prior current version was superseded atomically.",
    );
    await refresh(detail.selected.id);
  }

  function openSchedule() {
    const earliest = new Date();
    earliest.setMinutes(earliest.getMinutes() + 1);
    setScheduleMin(earliest.toISOString().slice(0, 16));
    setScheduleOpen(true);
  }

  async function scheduleEffectiveness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    const form = new FormData(event.currentTarget);
    const effectiveAt = new Date(String(form.get("effectiveAt")));
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
    setNotice("Successor revision created from the current effective version.");
    await refresh(body.data.id);
  }

  const selected = detail?.selected;
  const canControl = Boolean(capabilities?.canMakeDocumentsEffective);
  const canRevise = Boolean(capabilities?.canCreateDocuments);
  const scheduled =
    selected?.status === "APPROVED" && Boolean(selected.effectiveAt);

  return (
    <>
      <button
        type="button"
        className="primary-button"
        style={{ position: "fixed", right: 24, bottom: 24, zIndex: 80 }}
        disabled={busy}
        onClick={openPanel}
      >
        Lifecycle operations
      </button>
      {open && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lifecycle-title"
          >
            <div className="modal-head">
              <div>
                <div>
                  <h2 id="lifecycle-title">Lifecycle operations</h2>
                  <p>
                    Controlled successor revision, effectiveness, and retirement
                    actions.
                  </p>
                </div>
              </div>
              <button
                aria-label="Close lifecycle operations"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="detail-body">
              {notice && (
                <div className="notice" role="status">
                  <span>{notice}</span>
                </div>
              )}
              {error && (
                <div className="detail-error" role="alert">
                  {error}
                </div>
              )}
              <label>
                Controlled document version
                <select
                  value={selectedId}
                  onChange={(event) => void selectVersion(event.target.value)}
                  disabled={busy}
                >
                  {documents.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.documentNumber} · v{item.revisionLabel} ·{" "}
                      {item.status.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              {selected && (
                <section className="content-card">
                  <h3>
                    {selected.documentNumber} · {selected.title}
                  </h3>
                  <p>
                    Revision {selected.revisionLabel} ·{" "}
                    {selected.status.replaceAll("_", " ")}
                  </p>
                  <small>
                    {selected.effectiveAt
                      ? `${selected.status === "APPROVED" ? "Scheduled effective" : "Effective"}: ${new Date(selected.effectiveAt).toLocaleString()}`
                      : "No effective date is currently recorded."}
                  </small>
                </section>
              )}
              <div className="detail-actions">
                <span>
                  Only server-authorized lifecycle actions are offered here.
                </span>
                <div>
                  {selected?.status === "EFFECTIVE" && canRevise && (
                    <button
                      disabled={busy}
                      onClick={() => setRevisionOpen(true)}
                    >
                      Create successor revision
                    </button>
                  )}
                  {selected?.status === "APPROVED" && canControl && (
                    <>
                      <button
                        disabled={busy || scheduled}
                        onClick={openSchedule}
                      >
                        {scheduled
                          ? "Effectiveness scheduled"
                          : "Schedule effective date"}
                      </button>
                      <button
                        className="primary-button"
                        disabled={busy || scheduled}
                        onClick={makeEffectiveNow}
                      >
                        Make effective now
                      </button>
                    </>
                  )}
                  {selected?.status === "EFFECTIVE" && canControl && (
                    <button disabled={busy} onClick={retire}>
                      Retire document
                    </button>
                  )}
                </div>
              </div>
              {selected?.status === "SUPERSEDED" && (
                <div className="permission-state">
                  <strong>Historical version</strong>
                  <span>
                    Successor revisions must be created from the current effective
                    version, not a superseded branch.
                  </span>
                </div>
              )}
              {selected?.status === "RETIRED" && (
                <div className="permission-state">
                  <strong>Terminal lifecycle state</strong>
                  <span>
                    Retired versions remain historical evidence and cannot return
                    to operational use.
                  </span>
                </div>
              )}
              {scheduleOpen && selected && (
                <form className="approval-box" onSubmit={scheduleEffectiveness}>
                  <strong>Schedule future effectiveness</strong>
                  <label>
                    Effective date and time
                    <input
                      name="effectiveAt"
                      type="datetime-local"
                      required
                      min={scheduleMin}
                    />
                  </label>
                  <label>
                    Controlled reason
                    <textarea name="reason" required maxLength={4000} />
                  </label>
                  <div>
                    <button
                      type="button"
                      onClick={() => setScheduleOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={busy}
                    >
                      Schedule effectiveness
                    </button>
                  </div>
                </form>
              )}
              {revisionOpen && selected && (
                <form className="approval-box" onSubmit={createRevision}>
                  <strong>Create successor from current effective version</strong>
                  <label>
                    Revision label
                    <input
                      name="revisionLabel"
                      required
                      maxLength={50}
                      placeholder="1.1"
                    />
                  </label>
                  <label>
                    Controlled content
                    <textarea
                      name="contentText"
                      required
                      maxLength={1_000_000}
                      defaultValue={selected.contentText ?? ""}
                    />
                  </label>
                  <label>
                    Change summary
                    <textarea
                      name="changeSummary"
                      required
                      maxLength={4000}
                    />
                  </label>
                  <div>
                    <button
                      type="button"
                      onClick={() => setRevisionOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={busy}
                    >
                      Create successor
                    </button>
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
