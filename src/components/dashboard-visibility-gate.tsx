"use client";

import { useEffect, useState } from "react";
import { DocumentsContentTabs } from "./documents-content-tabs";
import { ReviewQueueWorkspace } from "./review-queue-workspace";

type Visibility = { documents: boolean; reviewQueue: boolean; administration: boolean; createDocument: boolean; deliveryFailures: boolean };
type DashboardView = "Documents" | "Review queue" | "Administration";

export function DashboardVisibilityGate() {
  const [visibility, setVisibility] = useState<Visibility | null>(null);
  const [activeView, setActiveView] = useState<DashboardView>("Documents");
  useEffect(() => { let active = true; fetch("/api/workspace/dashboard", { credentials: "same-origin" }).then(async (response) => (response.ok ? response.json() : null)).then((body) => { if (active && body?.data?.visibility) setVisibility(body.data.visibility as Visibility); }).catch(() => {}); return () => { active = false; }; }, []);
  useEffect(() => { function handleNavigation(event: MouseEvent) { const target = event.target instanceof Element ? event.target.closest(".sidebar nav > button") : null; const label = target?.textContent?.trim(); if (label === "Documents" || label === "Administration") setActiveView(label); else if (label?.startsWith("Review queue")) setActiveView("Review queue"); } document.addEventListener("click", handleNavigation); return () => document.removeEventListener("click", handleNavigation); }, []);
  useEffect(() => { if (activeView !== "Administration") return; const hideLegacyPanels = () => { document.querySelectorAll<HTMLElement>(".admin-stack > section.panel").forEach((panel) => { const heading = panel.querySelector("h2")?.textContent?.trim(); if (heading === "Review workflow templates" || heading === "Notification delivery monitoring") panel.hidden = true; }); }; hideLegacyPanels(); const observer = new MutationObserver(hideLegacyPanels); observer.observe(document.body, { childList: true, subtree: true }); return () => observer.disconnect(); }, [activeView]);
  if (!visibility) return null;
  return <><style>{`${visibility.reviewQueue ? "" : ".sidebar nav > button:nth-child(2){display:none!important}.metric-grid > article:nth-child(2){display:none!important}"}${visibility.administration ? "" : ".sidebar nav > button:nth-child(3){display:none!important}"}${visibility.createDocument ? "" : ".page-heading .primary-button{display:none!important}"}${visibility.deliveryFailures ? "" : ".metric-grid > article:nth-child(4){display:none!important}"}${visibility.documents ? "" : ".sidebar nav > button:nth-child(1){display:none!important}"}${activeView === "Documents" ? "" : ".qms-module-shell{display:none!important}"}${activeView === "Review queue" ? ".workspace-main > section.panel.documents-panel:not(.review-queue-hub){display:none!important}" : ""}`}</style><DocumentsContentTabs active={activeView === "Documents" && visibility.documents} /><ReviewQueueWorkspace active={activeView === "Review queue"} /></>;
}
