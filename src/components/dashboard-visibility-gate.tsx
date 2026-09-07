"use client";

import { useEffect, useState } from "react";

type Visibility = {
  documents: boolean;
  reviewQueue: boolean;
  administration: boolean;
  createDocument: boolean;
  deliveryFailures: boolean;
};

export function DashboardVisibilityGate() {
  const [visibility, setVisibility] = useState<Visibility | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/workspace/dashboard", { credentials: "same-origin" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (active && body?.data?.visibility) setVisibility(body.data.visibility as Visibility);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!visibility) return null;

  return (
    <style>{`
      ${visibility.reviewQueue ? "" : ".sidebar nav > button:nth-child(2){display:none!important}.metric-grid > article:nth-child(2){display:none!important}"}
      ${visibility.administration ? "" : ".sidebar nav > button:nth-child(3){display:none!important}"}
      ${visibility.createDocument ? "" : ".page-heading .primary-button{display:none!important}"}
      ${visibility.deliveryFailures ? "" : ".metric-grid > article:nth-child(4){display:none!important}"}
      ${visibility.documents ? "" : ".sidebar nav > button:nth-child(1){display:none!important}"}
    `}</style>
  );
}
