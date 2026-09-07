"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

type RecordType = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
};

type QualityRecord = {
  id: string;
  recordTypeId: string;
  recordNumber: string;
  title: string;
  status: "ACTIVE" | "ARCHIVED";
  occurredAt: string | null;
  fileId: string | null;
  createdAt: string;
};

export function RecordManagementWorkspace({ canCreate, canArchive, canConfigureTypes }: { canCreate: boolean; canArchive: boolean; canConfigureTypes: boolean }) {
  const [types, setTypes] = useState<RecordType[]>([]);
  const [records, setRecords] = useState<QualityRecord[]>([]);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [typesResponse, recordsResponse] = await Promise.all([
      fetch("/api/records/types", { credentials: "same-origin" }),
      fetch("/api/records", { credentials: "same-origin" }),
    ]);
    if (typesResponse.ok) setTypes((await typesResponse.json()).data ?? []);
    if (recordsResponse.ok) setRecords((await recordsResponse.json()).data ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch("/api/records/types", { credentials: "same-origin" }),
      fetch("/api/records", { credentials: "same-origin" }),
    ]).then(async ([typesResponse, recordsResponse]) => {
      if (cancelled) return;
      if (typesResponse.ok) {
        const body = await typesResponse.json();
        if (!cancelled) setTypes(body.data ?? []);
      }
      if (recordsResponse.ok) {
        const body = await recordsResponse.json();
        if (!cancelled) setRecords(body.data ?? []);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const typeById = useMemo(() => new Map(types.map((type) => [type.id, type])), [types]);
  const visibleRecords = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return records;
    return records.filter((record) => {
      const type = typeById.get(record.recordTypeId);
      return [record.recordNumber, record.title, record.status, type?.code ?? "", type?.name ?? ""]
        .some((value) => value.toLowerCase().includes(normalized));
    });
  }, [query, records, typeById]);

  async function createType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/records/types", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: String(form.get("code")), name: String(form.get("name")), description: String(form.get("description")) || null }),
    });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) return setNotice(body?.error || "Record type could not be created.");
    event.currentTarget.reset();
    setNotice(`Record type ${body.data.code} created with audit evidence.`);
    await load();
  }

  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setNotice("");
    const occurredAt = String(form.get("occurredAt"));
    const response = await fetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recordTypeId: String(form.get("recordTypeId")),
        recordNumber: String(form.get("recordNumber")),
        title: String(form.get("title")),
        occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null,
        fileId: null,
      }),
    });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) return setNotice(body?.error || "Record could not be created.");
    event.currentTarget.reset();
    setNotice(`Record ${body.data.recordNumber} created with audit evidence.`);
    await load();
  }

  async function archiveRecord(record: QualityRecord) {
    const reason = window.prompt(`Archive ${record.recordNumber}. Enter the controlled disposition reason:`);
    if (!reason?.trim()) return;
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation: "ARCHIVE", recordId: record.id, reason }),
    });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) return setNotice(body?.error || "Record could not be archived.");
    setNotice(`Record ${record.recordNumber} archived with retention and audit evidence.`);
    await load();
  }

  return (
    <section className="workspace-section" aria-labelledby="record-management-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Regulated records</p>
          <h2 id="record-management-heading">Record management</h2>
          <p>Create and browse tenant-scoped quality records without rewriting historical record identity.</p>
        </div>
      </div>

      {canConfigureTypes && (
        <form onSubmit={createType} className="admin-form">
          <label>Record type code<input name="code" maxLength={40} required /></label>
          <label>Record type name<input name="name" maxLength={200} required /></label>
          <label>Description<textarea name="description" maxLength={1000} /></label>
          <button type="submit" disabled={busy}>Create governed record type</button>
        </form>
      )}

      {canCreate && (
        <form onSubmit={createRecord} className="admin-form">
          <label>
            Record type
            <select name="recordTypeId" defaultValue="" required>
              <option value="" disabled>Select a record type</option>
              {types.filter((type) => type.active).map((type) => <option key={type.id} value={type.id}>{type.code} · {type.name}</option>)}
            </select>
          </label>
          <label>Record number<input name="recordNumber" maxLength={120} required /></label>
          <label>Title<input name="title" maxLength={300} required /></label>
          <label>Occurred at<input name="occurredAt" type="datetime-local" /></label>
          <button type="submit" disabled={busy || !types.some((type) => type.active)}>Create regulated record</button>
        </form>
      )}

      {notice && <p role="status">{notice}</p>}

      <label>
        Search records
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Number, title, type, or status" />
      </label>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Record</th><th>Title</th><th>Type</th><th>Status</th><th>Occurred</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {visibleRecords.map((record) => {
              const type = typeById.get(record.recordTypeId);
              return <tr key={record.id}>
                <td>{record.recordNumber}</td>
                <td>{record.title}</td>
                <td>{type ? `${type.code} · ${type.name}` : record.recordTypeId}</td>
                <td>{record.status}</td>
                <td>{record.occurredAt ? new Date(record.occurredAt).toLocaleString() : "—"}</td>
                <td>{new Date(record.createdAt).toLocaleString()}</td>
                <td>{canArchive && record.status === "ACTIVE" ? <button type="button" disabled={busy} onClick={() => void archiveRecord(record)}>Archive</button> : "—"}</td>
              </tr>;
            })}
            {!visibleRecords.length && <tr><td colSpan={7}>{records.length ? "No records match the current search." : "No regulated records have been created."}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
