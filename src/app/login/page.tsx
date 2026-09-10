"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

const modules = [
  ["Policy & Documentation", "Controlled documents, review workflows, acknowledgments, controlled copies, folders, and retention."],
  ["Personnel", "Governed employee records, job assignments, credentials, qualifications, and supporting evidence."],
  ["Training & Competency", "Training assignments, completions, competency programs, assessments, and reassessment tracking."],
  ["Quality Events & CAPA", "Event intake, investigation, root cause, corrective and preventive actions, effectiveness, and closure."],
  ["Laboratory Operations", "Equipment oversight, compliance holds, service history, calibration, and maintenance visibility."],
  ["Records Management", "Tenant-scoped governed records with controlled identity and historical state."],
  ["Reporting & Analytics", "Governed reports, approved filters, execution history, saved views, and finalized exports."],
  ["Administration", "Organizations, sites, departments, users, roles, permissions, workflows, notifications, and audit history."],
];

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationCode: form.get("organizationCode"), email: form.get("email"), password: form.get("password") }),
    });
    const body = await response.json().catch(() => null);
    setSubmitting(false);
    if (!response.ok) return setError(body?.error ?? "Sign-in failed.");
    router.replace("/");
    router.refresh();
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <a className={styles.brand} href="#top" aria-label="Trace QMS home">
        <span className={styles.brandMark}>T</span>
        <span className={styles.brandText}><strong>TRACE QMS</strong><span>by Trace Scientific</span></span>
      </a>
      <nav className={styles.actions} aria-label="Public page actions">
        <a className={styles.linkButton} href="#request-demo">Request a Demo</a>
        <a className={styles.primaryButton} href="#login">Log In</a>
      </nav>
    </header>

    <section className={styles.hero} id="top">
      <div>
        <p className={styles.eyebrow}>Quality management for modern laboratories</p>
        <h1>Bring controlled quality workflows into one governed workspace.</h1>
        <p className={styles.lede}>Trace QMS helps laboratory teams manage documents, personnel, training, quality events, equipment, records, and reporting without scattering critical quality work across disconnected systems.</p>
        <div className={styles.heroCtas}>
          <a className={styles.primaryButton} href="#request-demo">Request a Demo</a>
          <a className={styles.linkButton} href="#modules">Explore Modules</a>
        </div>
        <p className={styles.trustLine}>Tenant-scoped workflows · Role-based access · Controlled history · Governed evidence</p>
      </div>

      <form className={styles.loginCard} id="login" onSubmit={submit}>
        <p className={styles.eyebrow}>Secure workspace access</p>
        <h2>Log in to Trace QMS</h2>
        <p>Use your assigned organization and account credentials.</p>
        <label>Organization code<input name="organizationCode" defaultValue="orange-county-labs" autoComplete="organization" required /></label>
        <label>Email address<input name="email" type="email" autoComplete="username" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Log in"}</button>
        <small className={styles.previewNote}>Development preview — synthetic data only.</small>
      </form>
    </section>

    <section className={styles.valueBand} aria-label="Trace QMS product benefits">
      <div className={styles.valueInner}>
        <article><strong>One quality workspace</strong><span>Bring controlled documents, people, training, events, equipment, and records together without losing domain-specific governance.</span></article>
        <article><strong>Built around controlled workflows</strong><span>Use focused lifecycle actions, approvals, supporting evidence, and historical records instead of informal shared-file processes.</span></article>
        <article><strong>Designed for laboratory operations</strong><span>Support day-to-day quality work with tenant-scoped access, operational queues, due dates, monitoring, and governed reporting.</span></article>
      </div>
    </section>

    <section className={styles.section} id="modules">
      <div className={styles.sectionHeading}>
        <p className={styles.eyebrow}>Modular platform</p>
        <h2>Quality operations in focused, connected modules.</h2>
        <p>Organizations can use the QMS as a unified platform while teams work inside purpose-built governed workspaces for each quality domain.</p>
      </div>
      <div className={styles.moduleGrid}>{modules.map(([title, description]) => <article className={styles.moduleCard} key={title}><h3>{title}</h3><p>{description}</p></article>)}</div>
    </section>

    <section className={styles.section} id="request-demo">
      <div className={styles.demo}>
        <div>
          <p className={styles.eyebrow}>See Trace QMS in action</p>
          <h2>Request a guided product demonstration.</h2>
          <p>Explore the document, personnel, training, quality, laboratory operations, records, and reporting workflows with your organization&apos;s use cases in mind.</p>
          <p className={styles.demoNote}>Demo-request intake is being connected as a separate commercial workflow before launch. No regulated tenant data will be collected through the public marketing page.</p>
        </div>
        <a className={styles.primaryButton} href="#login">Existing customer? Log In</a>
      </div>
    </section>

    <footer className={styles.footer}><strong>Trace QMS</strong> · Quality management software by Trace Scientific · Development preview</footer>
  </main>;
}
