"use client";

import { useEffect, useMemo, useState } from "react";
import { ApprovalOperations } from "./approval-operations";

type ReviewRow = { id: string; documentNumber: string; title: string; revisionLabel: string; dueAt: string; overdue: boolean };
type DashboardPayload = { capabilities: { canManageReviews: boolean }; reviews: ReviewRow[] };
type Section = "periodic" | "overdue" | "assignments";

function date(value: string) { return new Date(value).toLocaleString(); }

export function ReviewQueueWorkspace({ canManageApprovalAssignments }: { canManageApprovalAssignments: boolean }) {
  const [activeView, setActiveView] = useState("Documents");
  const [section, setSection] = useState<Section>("periodic");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    function handleNavigation(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest(".sidebar nav > button") : null;
      const label = target?.textContent?.trim();
      if (label === "Documents" || label?.startsWith("Review queue") || label === "Administration") setActiveView(label.startsWith("Review queue") ? "Review queue" : label);
    }
    document.addEventListener("click", handleNavigation);
    return () => document.removeEventListener("click", handleNavigation);
  }, []);

  useEffect(() => {
    if (activeView !== "Review queue" || data) return;
    let active = true;
    fetch("/api/workspace/dashboard", { credentials: "same-origin" })
      .then(async (response) => ({ response, body: await response.json().catch(() => null) }))
      .then(({ response, body }) => { if (!active) return; if (response.ok && body?.data) setData(body.data as DashboardPayload); else setError(body?.error || "Review queue could not be loaded."); })
      .catch(() => { if (active) setError("Review queue could not be loaded."); });
    return () => { active = false; };
  }, [activeView, data]);

  const overdue = useMemo(() => data?.reviews.filter((review) => review.overdue) ?? [], [data]);
  if (activeView !== "Review queue") return null;

  const sections: Array<{ id: Section; label: string; description: string }> = [
    { id: "periodic", label: "Periodic reviews", description: "Current effective versions scheduled for periodic review." },
    { id: "overdue", label: "Overdue", description: "Periodic reviews that have passed their controlled due date." },
    ...(canManageApprovalAssignments ? [{ id: "assignments" as Section, label: "Approval assignments", description: "Assign eligible final approvers after required review stages." }] : []),
  ];
  const rows = section === "overdue" ? overdue : data?.reviews ?? [];

  return <section className="panel documents-panel review-queue-hub">
    <div className="panel-header"><div><h2>Review queue</h2><p>Open one governed review workspace at a time.</p></div></div>
    <nav className="section-nav" aria-label="Review queue sections">{sections.map((item) => <button type="button" key={item.id} className={section === item.id ? "active" : ""} aria-current={section === item.id ? "page" : undefined} onClick={() => setSection(item.id)}>{item.label}</button>)}</nav>
    {error && <div className="detail-error" role="alert">{error}</div>}
    {(section === "periodic" || section === "overdue") && <div className="admin-section-stack"><div className="section-heading"><h3>{section === "periodic" ? "Periodic reviews" : "Overdue reviews"}</h3><p>{sections.find((item) => item.id === section)?.description}</p></div>{!data && !error ? <p>Loading review queue…</p> : data && !data.capabilities.canManageReviews ? <div className="permission-state"><strong>Review management access required</strong><span>Your account cannot view the organization-wide periodic review queue.</span></div> : data ? <div className="table-wrap"><table><thead><tr><th>Document</th><th>Version</th><th>Review due</th><th>Status</th></tr></thead><tbody>{rows.map((review) => <tr key={review.id}><td><strong>{review.title}</strong><span>{review.documentNumber}</span></td><td>v{review.revisionLabel}</td><td className={review.overdue ? "due" : ""}>{date(review.dueAt)}</td><td><span className={`status ${review.overdue ? "status-review-due" : "status-effective"}`}><span />{review.overdue ? "Overdue" : "Scheduled"}</span></td></tr>)}</tbody></table>{!rows.length && <div className="empty-state"><strong>{section === "overdue" ? "No overdue reviews" : "No outstanding reviews"}</strong><span>{section === "overdue" ? "No periodic reviews are currently overdue." : "All current effective versions are within schedule."}</span></div>}</div> : null}</div>}
    {section === "assignments" && canManageApprovalAssignments && <ApprovalOperations embedded />}
  </section>;
}
