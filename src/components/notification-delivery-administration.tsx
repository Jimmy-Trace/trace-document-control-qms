"use client";

import { useEffect, useState } from "react";

type FailureRow = {
  id: string;
  status: string;
  attempts: number;
  lastError: string | null;
  availableAt: string;
};

type DashboardPayload = {
  organizationId: string;
  capabilities: {
    canManageReviews: boolean;
    canManageNotifications: boolean;
  };
  failures: FailureRow[];
};

function date(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export function NotificationDeliveryAdministration() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const response = await fetch("/api/workspace/dashboard", { credentials: "same-origin" });
    const body = await response.json().catch(() => null);
    if (response.ok && body?.data) setData(body.data as DashboardPayload);
    else setError(body?.error || "Notification delivery monitoring could not be loaded.");
  }

  useEffect(() => {
    let active = true;
    fetch("/api/workspace/dashboard", { credentials: "same-origin" })
      .then(async (response) => ({ response, body: await response.json().catch(() => null) }))
      .then(({ response, body }) => {
        if (!active) return;
        if (response.ok && body?.data) setData(body.data as DashboardPayload);
        else setError(body?.error || "Notification delivery monitoring could not be loaded.");
      })
      .catch(() => {
        if (active) setError("Notification delivery monitoring could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function monitorOverdue() {
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/documents/workflow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation: "MONITOR_OVERDUE" }),
    });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) {
      setError(body?.error || "Unable to monitor overdue assignments.");
      return;
    }
    setNotice(`${body.data.created} overdue review notification${body.data.created === 1 ? "" : "s"} queued.`);
    await load();
  }

  async function requeue(item: FailureRow) {
    if (!data) return;
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        operation: "REQUEUE",
        organizationId: data.organizationId,
        notificationId: item.id,
      }),
    });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) {
      setError(body?.error || "The dead-letter notification could not be requeued.");
      return;
    }
    setNotice("Dead-letter notification was requeued and the action was audited.");
    await load();
  }

  if (!data && !error) return <p>Loading notification delivery monitoring…</p>;

  return (
    <div className="admin-section-stack">
      <div className="section-heading">
        <h3>Notification delivery monitoring</h3>
        <p>Inspect failed and dead-letter deliveries and run governed recovery actions.</p>
      </div>
      {error && <div className="detail-error" role="alert">{error}</div>}
      {notice && <div className="detail-notice" role="status">{notice}</div>}
      {data && !data.capabilities.canManageNotifications ? (
        <div className="permission-state">
          <strong>Administrator access required</strong>
          <span>Your account cannot view delivery diagnostics.</span>
        </div>
      ) : data ? (
        <>
          <div className="panel-header">
            <div><strong>{data.failures.length} failed or dead-letter deliveries</strong></div>
            {data.capabilities.canManageReviews && (
              <button type="button" className="text-button" disabled={busy} onClick={monitorOverdue}>Queue overdue reviews</button>
            )}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Status</th><th>Attempts</th><th>Next attempt</th><th>Last error</th><th>Recovery</th></tr></thead>
              <tbody>
                {data.failures.map((item) => (
                  <tr key={item.id}>
                    <td>{item.status.replace("_", " ")}</td>
                    <td>{item.attempts}</td>
                    <td>{date(item.availableAt)}</td>
                    <td className="error-cell">{item.lastError ?? "—"}</td>
                    <td><button type="button" className="text-button" disabled={busy || item.status !== "DEAD_LETTER"} onClick={() => requeue(item)}>Requeue</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.failures.length && <div className="empty-state"><strong>Delivery queue healthy</strong><span>No failed or dead-letter notifications.</span></div>}
          </div>
        </>
      ) : null}
    </div>
  );
}
