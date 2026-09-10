"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";

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
    setNotice(`${file.name} uploaded and is pending malware scanning. It will become selectable after the scan passes.`);
    await load();
  }

  const available = files.filter((file) => file.status === "AVAILABLE");
  const pending = files.filter((file) => file.status === "PENDING_SCAN");
  const selectedFile = useMemo(() => available.find((file) => file.id === selected) ?? null, [available, selected]);

  return <fieldset className="evidence-file-picker" disabled={disabled}>
    <legend>Supporting evidence</legend>
    <p className="evidence-file-picker__intro">Attach an existing approved file or upload a new supporting document.</p>

    <label className="evidence-file-picker__field">
      <span>Select existing file</span>
      <select name={name} value={selected} onChange={(event) => setSelected(event.target.value)} disabled={disabled}>
        <option value="">No evidence file attached</option>
        {available.map((file) => <option key={file.id} value={file.id}>{file.originalName}</option>)}
      </select>
    </label>

    {selectedFile && <div className="evidence-file-picker__selected" aria-live="polite">
      <strong>{selectedFile.originalName}</strong>
      <span>Available · SHA-256 {selectedFile.sha256.slice(0, 12)}…</span>
    </div>}

    <div className="evidence-file-picker__upload">
      <label>
        <span>Upload new file</span>
        <input type="file" accept={ACCEPTED} onChange={(event) => void upload(event)} disabled={disabled || uploading} />
      </label>
      <small>PDF, Word, Excel, JPEG, PNG, TIFF, TXT or CSV · Max 25 MB · New files are malware scanned before use.</small>
    </div>

    {pending.length > 0 && <p className="evidence-file-picker__pending">{pending.length} evidence file{pending.length === 1 ? " is" : "s are"} awaiting malware scan.</p>}
    {notice && <p className="evidence-file-picker__notice" role="status">{notice}</p>}
  </fieldset>;
}
