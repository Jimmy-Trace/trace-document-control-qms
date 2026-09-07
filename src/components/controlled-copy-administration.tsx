"use client";

import { useEffect, useState, type FormEvent } from "react";

type CopyRecord = {
  id: string;
  documentVersionId: string;
  copyNumber: number;
  recipientName: string;
  location: string | null;
  purpose: string;
  status: "ISSUED" | "RECALL_REQUESTED" | "RETURNED" | "DESTROYED";
  issuedAt: string;
};

type EffectiveVersion = {
  id: string;
  documentNumber: string;
  title: string;
  revisionLabel: string;
};

export function ControlledCopyAdministration() {
  const [copies, setCopies] = useState<CopyRecord[]>([]);
  const [versions, setVersions] = useState<EffectiveVersion[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [copiesResponse, versionsResponse] = await Promise.all([
      fetch("/api/documents/controlled-copies", { credentials: "same-origin" }),
      fetch("/api/documents?status=EFFECTIVE&limit=100", { credentials: "same-origin" }),
    ]);
    if (copiesResponse.ok) {
      const body = await copiesResponse.json();
      setCopies(body.data ?? []);
    }
    if (versionsResponse.ok) {
      const body = await versionsResponse.json();
      setVersions(body.data?.items ?? []);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch("/api/documents/controlled-copies", { credentials: "same-origin" }),
      fetch("/api/documents?status=EFFECTIVE&limit=100", { credentials: "same-origin" }),
    ]).then(async ([copiesResponse, versionsResponse]) => {
      if (cancelled) return;
      if (copiesResponse.ok) {
        const body = await copiesResponse.json();
        if (!cancelled) setCopies(body.data ?? []);
      }
      if (versionsResponse.ok) {
        const body = await versionsResponse.json();
        if (!cancelled) setVersions(body.data?.items ?? []);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/documents/controlled-copies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        operation: "ISSUE",
        documentVersionId: String(form.get("documentVersionId")),
        recipientName: String(form.get("recipientName")),
        location: String(form.get("location")) || null,
        purpose: String(form.get("purpose")),
      }),
    });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) {
      setNotice(body?.error || "Controlled copy could not be issued.");
      return;
    }
    event.currentTarget.reset();
    setNotice(`Controlled copy #${body.data.copyNumber} issued with audit evidence.`);
    await load();
  }

  async function transition(copyId: string, operation: "RECALL" | "RETURN" | "DESTROY") {
    const reason = window.prompt(`Reason for ${operation.toLowerCase()} action`);
    if (!reason?.trim()) return;
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/documents/controlled-copies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation, copyId, reason }),
    });
    const body = await response.json().catch(() => null);
    setBusy(false);
    setNotice(response.ok ? `Controlled copy ${operation.toLowerCase()} recorded with audit evidence.` : body?.error || "Controlled copy action failed.");
    if (response.ok) await load();
  }

  return (
    <section className="workspace-section" aria-labelledby="controlled-copy-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Controlled distribution</p>
          <h2 id="controlled-copy-heading">Controlled copies</h2>
          <p>Issue and reconcile numbered physical or external copies against one exact effective revision.</p>
        </div>
      </div>

      <form onSubmit={issue} className="admin-form">
        <label>
          Effective document version
          <select name="documentVersionId" required defaultValue="">
            <option value="" disabled>Select an effective revision</option>
            {versions.map((version) => (
              <option key={version.id} value={version.id}>{version.documentNumber} · {version.title} · {version.revisionLabel}</option>
            ))}
          </select>
        </label>
        <label>Recipient / holder<input name="recipientName" maxLength={200} required /></label>
        <label>Location<input name="location" maxLength={300} /></label>
        <label>Purpose<textarea name="purpose" maxLength={500} required /></label>
        <button type="submit" disabled={busy}>Issue numbered controlled copy</button>
      </form>

      {notice && <p role="status">{notice}</p>}

      <div className="table-wrap">
        <table>
          <thead><tr><th>Copy</th><th>Recipient</th><th>Location</th><th>Status</th><th>Issued</th><th>Actions</th></tr></thead>
          <tbody>
            {copies.map((copy) => (
              <tr key={copy.id}>
                <td>#{copy.copyNumber}</td>
                <td>{copy.recipientName}</td>
                <td>{copy.location || "—"}</td>
                <td>{copy.status.replaceAll("_", " ")}</td>
                <td>{new Date(copy.issuedAt).toLocaleString()}</td>
                <td>
                  {copy.status === "ISSUED" && <button type="button" disabled={busy} onClick={() => transition(copy.id, "RECALL")}>Recall</button>}
                  {(copy.status === "ISSUED" || copy.status === "RECALL_REQUESTED") && <button type="button" disabled={busy} onClick={() => transition(copy.id, "RETURN")}>Return</button>}
                  {(copy.status === "ISSUED" || copy.status === "RECALL_REQUESTED") && <button type="button" disabled={busy} onClick={() => transition(copy.id, "DESTROY")}>Destroy</button>}
                </td>
              </tr>
            ))}
            {!copies.length && <tr><td colSpan={6}>No controlled copies have been issued.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
