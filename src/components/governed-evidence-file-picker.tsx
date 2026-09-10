"use client";

import { useEffect, useState, type ChangeEvent } from "react";

type EvidenceFile = { id: string; originalName: string; mimeType: string; sizeBytes: string; sha256: string; status: string };
const ACCEPTED = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.tif,.tiff,.txt,.csv";

export function GovernedEvidenceFilePicker({ name = "fileId", disabled = false }: { name?: string; disabled?: boolean }) {
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [selected, setSelected] = useState("");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);

  async function load() {
    const response = await fetch("/api/evidence-files", { credentials: "same-origin" });
    const body = await response.json().catch(() => null);
    if (response.ok) setFiles(body?.data ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/evidence-files", { credentials: "same-origin" }).then(async (response) => {
      const body = await response.json().catch(() => null);
      if (!cancelled && response.ok) setFiles(body?.data ?? []);
    });
    return () => { cancelled = true; };
  }, []);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true); setNotice("");
    const form = new FormData(); form.append("file", file);
    const response = await fetch("/api/evidence-files", { method: "POST", body: form, credentials: "same-origin" });
    const body = await response.json().catch(() => null);
    setUploading(false); event.target.value = "";
    if (!response.ok) { setNotice(body?.error ?? "Evidence file could not be uploaded."); return; }
    setNotice(`${file.name} uploaded and is pending malware scanning. Select it after its status becomes AVAILABLE.`);
    await load();
  }

  const available = files.filter((file) => file.status === "AVAILABLE");
  const pending = files.filter((file) => file.status === "PENDING_SCAN");

  return <div className="evidence-file-picker">
    <label>Evidence attachment<select name={name} value={selected} onChange={(event) => setSelected(event.target.value)} disabled={disabled}><option value="">No evidence file attached</option>{available.map((file) => <option key={file.id} value={file.id}>{file.originalName} · {file.sha256.slice(0, 12)}…</option>)}</select></label>
    <label>Upload evidence file<input type="file" accept={ACCEPTED} onChange={(event) => void upload(event)} disabled={disabled || uploading} /></label>
    <small>Accepted: PDF, Word, Excel, JPEG, PNG, TIFF, TXT, and CSV. Maximum 25 MB. New uploads must pass malware scanning before attachment.</small>
    {pending.length > 0 && <small>{pending.length} evidence file{pending.length === 1 ? " is" : "s are"} pending malware scan.</small>}
    {notice && <p role="status">{notice}</p>}
  </div>;
}
