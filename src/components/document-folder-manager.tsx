"use client";

import { useMemo, useState, type FormEvent } from "react";

type Folder = { id: string; parentFolderId: string | null; name: string; documentCount: number };
type DocumentRow = { documentId: string; documentNumber: string; title: string; folderId: string | null };
type Payload = { folders: Folder[]; documents: DocumentRow[] };

export function DocumentFolderManager() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [parentFolderId, setParentFolderId] = useState<string>("");

  async function load() {
    setBusy(true); setError("");
    const response = await fetch("/api/document-folders", { credentials: "same-origin" });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) { setError(response.status === 403 ? "Folder management requires document access." : body?.error || "Unable to load folders."); return; }
    setData(body.data);
  }

  async function command(payload: unknown) {
    setBusy(true); setError("");
    const response = await fetch("/api/document-folders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) { setError(body?.error || "Folder change could not be completed."); return false; }
    await load(); return true;
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (await command({ operation: "CREATE_FOLDER", parentFolderId: parentFolderId || null, name: String(form.get("name")) })) event.currentTarget.reset();
  }

  const depth = useMemo(() => {
    const map = new Map(data?.folders.map((folder) => [folder.id, folder]) ?? []);
    return (folder: Folder) => { let value = 0, current = folder.parentFolderId; const seen = new Set<string>(); while (current && !seen.has(current)) { seen.add(current); value += 1; current = map.get(current)?.parentFolderId ?? null; } return value; };
  }, [data]);

  return <>
    <button type="button" style={{ position: "fixed", right: 1020, bottom: 24, zIndex: 80 }} onClick={async () => { setOpen(true); await load(); }}>Document folders</button>
    {open && <div className="modal-backdrop" role="presentation"><div className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="folder-manager-title">
      <div className="modal-head"><div><h2 id="folder-manager-title">Document folders</h2><p>Create folders and subfolders and organize stable document identities without changing revision history.</p></div><button aria-label="Close document folders" onClick={() => setOpen(false)}>×</button></div>
      <div className="detail-body">
        {error && <div className="detail-error" role="alert">{error}</div>}
        <form className="approval-box" onSubmit={create}>
          <label>Parent folder<select value={parentFolderId} onChange={(event) => setParentFolderId(event.target.value)}><option value="">Root</option>{data?.folders.map((folder) => <option key={folder.id} value={folder.id}>{"— ".repeat(depth(folder))}{folder.name}</option>)}</select></label>
          <label>Folder name<input name="name" required maxLength={120} /></label>
          <button className="primary-button" disabled={busy} type="submit">Create folder</button>
        </form>
        {busy && !data ? <p>Loading folders…</p> : <div className="template-layout">
          <div><strong>Folder hierarchy</strong>{data?.folders.length ? data.folders.map((folder) => <div key={folder.id} style={{ paddingLeft: depth(folder) * 18, marginTop: 8 }}>📁 {folder.name} · {folder.documentCount} document(s)</div>) : <p>No folders yet.</p>}</div>
          <div><strong>Document placement</strong>{data?.documents.map((document) => <label key={document.documentId} style={{ display: "block", marginTop: 8 }}>{document.documentNumber} · {document.title}<select value={document.folderId ?? ""} onChange={(event) => { if (event.target.value) void command({ operation: "PLACE_DOCUMENT", documentId: document.documentId, folderId: event.target.value }); }}><option value="">Unfiled</option>{data.folders.map((folder) => <option key={folder.id} value={folder.id}>{"— ".repeat(depth(folder))}{folder.name}</option>)}</select></label>)}</div>
        </div>}
      </div>
    </div></div>}
  </>;
}