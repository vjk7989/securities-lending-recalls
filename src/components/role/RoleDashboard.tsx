"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  FileText,
  Landmark,
  Layers3,
  LockKeyhole,
  Radio,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import type { ActionType, Role, RoomView } from "@/lib/contracts";
import "./role.css";

type Props = {
  role: Role;
  room: RoomView;
  onAction: (action: ActionType) => Promise<void>;
  busy: boolean;
  error?: string;
};

type Tab = "overview" | "work" | "activity";

const actionCopy: Record<ActionType, { title: string; button: string; detail: string }> = {
  place_sale: {
    title: "Place 400,000 share sale",
    button: "Place sale order",
    detail: "The portfolio manager records the 3:40 pm sale order in this shared simulation.",
  },
  issue_recall: {
    title: "Issue recall for 250,000 shares",
    button: "Issue recall",
    detail: "The lending desk sends a recall covering the two broker return legs.",
  },
  return_150k: {
    title: "Record 150,000 share return",
    button: "Record return",
    detail: "Broker A records its 150,000 share leg against the open recall.",
  },
  return_100k: {
    title: "Record 100,000 share return",
    button: "Record return",
    detail: "Broker B records its 100,000 share leg against the open recall.",
  },
  confirm_delivery: {
    title: "Confirm both delivery legs",
    button: "Confirm delivery",
    detail: "The custodian confirms receipt of the returned shares for the T+1 workflow.",
  },
  release_collateral: {
    title: "Record collateral release",
    button: "Release collateral",
    detail: "The lending desk records the collateral release after delivery confirmation.",
  },
  settle_sale: {
    title: "Record sale settlement",
    button: "Settle sale",
    detail: "The custodian records completion of the simulated T+1 sale delivery.",
  },
};

const roleConfig: Record<Role, {
  eyebrow: string;
  name: string;
  initials: string;
  heading: string;
  intro: string;
  icon: typeof WalletCards;
  steps: ActionType[];
  metric: string;
  metricLabel: string;
  secondary: string;
  secondaryLabel: string;
  sampleId: string;
  sampleTitle: string;
  sampleDescription: string;
}> = {
  portfolio: {
    eyebrow: "Investment desk",
    name: "Portfolio Manager",
    initials: "PM",
    heading: "The sale starts here.",
    intro: "A 3:40 pm sell order triggers the need to bring shares back from loan before T+1 settlement.",
    icon: WalletCards,
    steps: ["place_sale"],
    metric: "400,000",
    metricLabel: "shares in sale order",
    secondary: "250,000",
    secondaryLabel: "shares currently on loan",
    sampleId: "SIM-PM-0842",
    sampleTitle: "Equity sale ticket",
    sampleDescription: "A fictional desk ticket used to make the role view feel like an operating workspace. Its identifier is sample data.",
  },
  lending: {
    eyebrow: "Securities finance",
    name: "Lending Desk",
    initials: "LD",
    heading: "Coordinate the recall.",
    intro: "Track the 250,000 shares on loan and the two return legs needed for the sale.",
    icon: Layers3,
    steps: ["issue_recall", "release_collateral"],
    metric: "250,000",
    metricLabel: "shares to recall",
    secondary: "2 legs",
    secondaryLabel: "Broker A + Broker B",
    sampleId: "SIM-LD-2197",
    sampleTitle: "Open loan position",
    sampleDescription: "A fictional loan record for exploring the lending desk. The 250,000 share total is from the deck scenario.",
  },
  broker_a: {
    eyebrow: "Borrower operations",
    name: "Broker A",
    initials: "A",
    heading: "Return the first leg.",
    intro: "Your broker leg contributes 150,000 shares to the 250,000 share recall.",
    icon: ArrowUpRight,
    steps: ["return_150k"],
    metric: "150,000",
    metricLabel: "shares in this return",
    secondary: "250,000",
    secondaryLabel: "total recall across brokers",
    sampleId: "SIM-BA-3912",
    sampleTitle: "Borrower return instruction",
    sampleDescription: "A fictional operations record. The 150,000 share return amount follows the deck scenario.",
  },
  broker_b: {
    eyebrow: "Borrower operations",
    name: "Broker B",
    initials: "B",
    heading: "Complete the return.",
    intro: "Your broker leg contributes the remaining 100,000 shares to the recall.",
    icon: ArrowUpRight,
    steps: ["return_100k"],
    metric: "100,000",
    metricLabel: "shares in this return",
    secondary: "250,000",
    secondaryLabel: "total recall across brokers",
    sampleId: "SIM-BB-3874",
    sampleTitle: "Borrower return instruction",
    sampleDescription: "A fictional operations record. The 100,000 share return amount follows the deck scenario.",
  },
  custodian: {
    eyebrow: "Asset servicing",
    name: "Custodian",
    initials: "C",
    heading: "Verify delivery.",
    intro: "Confirm that both broker legs arrived before the sale is recorded as settled on T+1.",
    icon: Landmark,
    steps: ["confirm_delivery", "settle_sale"],
    metric: "T+1",
    metricLabel: "settlement timeline",
    secondary: "2 legs",
    secondaryLabel: "deliveries to confirm",
    sampleId: "SIM-CU-7604",
    sampleTitle: "Delivery instruction",
    sampleDescription: "A fictional custodian instruction for exploring the role. Confirmation appears in the live activity feed only after an accepted action.",
  },
};

const orderedActions: ActionType[] = [
  "place_sale", "issue_recall", "return_150k", "return_100k",
  "confirm_delivery", "release_collateral", "settle_sale",
];

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function statusFor(action: ActionType, room: RoomView, available: ActionType[]): "complete" | "ready" | "waiting" {
  if (room.events.some((event) => event.action === action && event.run === room.run)) return "complete";
  return available.includes(action) ? "ready" : "waiting";
}

export function RoleDashboard({ role, room, onAction, busy, error }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [detailOpen, setDetailOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const detailCloseRef = useRef<HTMLButtonElement>(null);
  const config = roleConfig[role];
  const Icon = config.icon;
  const available = room.availableActions[role] ?? [];
  const nextAction = config.steps.find((action) => available.includes(action));
  const completeCount = orderedActions.filter((action) => statusFor(action, room, available) === "complete").length;
  const events = [...room.events].filter((event) => event.run === room.run).sort((a, b) => b.seq - a.seq);
  const ownEvents = events.filter((event) => event.actorRole === role);
  const roleSessions = room.sessions.filter((session) => session.role === role && session.connected && !session.kicked).length;

  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setDetailOpen(false);
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  useEffect(() => {
    if (!detailOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    detailCloseRef.current?.focus();
    return () => previousFocus?.focus();
  }, [detailOpen]);

  async function handleAction(action: ActionType) {
    setActionError(null);
    try {
      await onAction(action);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Action could not be recorded. Please try again.");
    }
  }

  return (
    <div className={`role-shell role-${role}`}>
      <div className="role-simulation" role="note">
        <CircleDot size={13} aria-hidden="true" />
        <span>SIMULATION · No real securities or settlement</span>
      </div>

      <header className="role-header">
        <div className="role-brand-mark" aria-hidden="true"><Icon size={22} strokeWidth={1.8} /></div>
        <div className="role-brand-copy">
          <span className="role-eyebrow">{config.eyebrow}</span>
          <strong>{config.name}</strong>
        </div>
        <div className={`role-live-indicator ${roleSessions ? "" : "is-disconnected"}`} role="status" aria-label={roleSessions ? "Connected to the room" : "Reconnecting to the room"} title={`${roleSessions} connected in this role`}>
          <Radio size={14} aria-hidden="true" />
          <span>{roleSessions ? "Live room" : "Reconnecting"}</span>
        </div>
      </header>

      <main className="role-main">
        <div className="role-topline">
          <span>ROOM {room.id.slice(0, 8).toUpperCase()}</span>
          <span>RUN {String(room.run).padStart(2, "0")}</span>
        </div>

        {tab === "overview" && (
          <section className="role-view" aria-labelledby="role-overview-heading">
            <div className="role-hero">
              <div className="role-hero-orbit" aria-hidden="true"><Icon size={58} strokeWidth={1.15} /></div>
              <div className="role-hero-content">
                <span className="role-kicker">YOUR WORKSPACE / {config.initials}</span>
                <h1 id="role-overview-heading">{config.heading}</h1>
                <p>{config.intro}</p>
              </div>
              <div className="role-hero-foot"><span>IDEA 2 · SECURITIES LENDING RECALL</span><ArrowUpRight size={16} aria-hidden="true" /></div>
            </div>

            <div className="role-section-heading"><span>Deck scenario</span><span className="role-source-label">AUTHORITATIVE FIGURES</span></div>
            <div className="role-metric-grid">
              <div className="role-metric role-metric-primary"><span className="role-metric-label">01 / PRIMARY</span><strong>{config.metric}</strong><span>{config.metricLabel}</span></div>
              <div className="role-metric"><span className="role-metric-label">02 / CONTEXT</span><strong>{config.secondary}</strong><span>{config.secondaryLabel}</span></div>
            </div>

            <div className="role-section-heading"><span>What happens next</span><span>{completeCount} / {orderedActions.length} recorded</span></div>
            <div className="role-next-card">
              <div className={`role-next-icon ${nextAction ? "is-ready" : ""}`}><ArrowRight size={20} aria-hidden="true" /></div>
              <div>
                <span className="role-card-overline">{nextAction ? "READY FOR YOUR ACTION" : config.steps.every((action) => statusFor(action, room, available) === "complete") ? "YOUR ACTIONS ARE COMPLETE" : "AWAITING PRIOR ACTIONS"}</span>
                <strong>{nextAction ? actionCopy[nextAction].title : config.steps.every((action) => statusFor(action, room, available) === "complete") ? "Your part is recorded" : "Follow the shared workflow"}</strong>
                <p>{nextAction ? actionCopy[nextAction].detail : "The live workflow will update when another participant records the next accepted step."}</p>
              </div>
              <button className="role-next-link" type="button" onClick={() => setTab("work")} aria-label="Open work view"><ChevronRight size={20} /></button>
            </div>

            <button className="role-sample-card" type="button" onClick={() => setDetailOpen(true)}>
              <span className="role-sample-icon"><FileText size={19} aria-hidden="true" /></span>
              <span className="role-sample-copy"><small>FICTIONAL SAMPLE RECORD</small><strong>{config.sampleTitle}</strong><span>{config.sampleId}</span></span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </section>
        )}

        {tab === "work" && (
          <section className="role-view" aria-labelledby="role-work-heading">
            <div className="role-page-title"><span className="role-kicker">ACTION DESK / {config.initials}</span><h1 id="role-work-heading">Your work</h1><p>Only accepted actions change the shared simulation. The next available step unlocks in sequence.</p></div>
            <div className="role-progress-strip"><div><span>WORKFLOW PROGRESS</span><strong>{completeCount} of {orderedActions.length} steps</strong></div><div className="role-progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={orderedActions.length} aria-valuenow={completeCount} aria-label="Workflow progress"><span style={{ width: `${(completeCount / orderedActions.length) * 100}%` }} /></div></div>
            <div className="role-section-heading"><span>Assigned actions</span><span>{config.steps.length} steps</span></div>
            <div className="role-work-list">
              {config.steps.map((action, index) => {
                const status = statusFor(action, room, available);
                return <article className={`role-work-card role-work-${status}`} key={action}>
                  <div className="role-work-card-top"><span>STEP {String(index + 1).padStart(2, "0")}</span><span className={`role-status role-status-${status}`}>{status === "complete" ? <Check size={12} /> : status === "ready" ? <CircleDot size={12} /> : <LockKeyhole size={12} />}{status === "complete" ? "Recorded" : status === "ready" ? "Ready" : "Waiting"}</span></div>
                  <h2>{actionCopy[action].title}</h2>
                  <p>{actionCopy[action].detail}</p>
                  {status === "ready" ? <button className="role-action-button" type="button" disabled={busy} onClick={() => void handleAction(action)}>{busy ? "Recording…" : actionCopy[action].button}<ArrowRight size={17} aria-hidden="true" /></button> : <div className="role-action-locked">{status === "complete" ? "Accepted in shared activity" : "Unlocks after earlier workflow steps"}</div>}
                </article>;
              })}
            </div>
            {(error || actionError) && <div className="role-action-error" role="alert">{error || actionError}</div>}
            <div className="role-work-note"><ShieldCheck size={18} aria-hidden="true" /><p>These controls update this room’s shared simulation. They do not send orders, transfer assets, or contact a custodian.</p></div>
          </section>
        )}

        {tab === "activity" && (
          <section className="role-view" aria-labelledby="role-activity-heading">
            <div className="role-page-title"><span className="role-kicker">SHARED LEDGER / RUN {room.run}</span><h1 id="role-activity-heading">Activity</h1><p>Accepted participant actions in this run. Fictional sample records are excluded.</p></div>
            <div className="role-activity-summary"><div><Activity size={20} aria-hidden="true" /><span>Live transaction record</span></div><strong>{events.length} accepted</strong></div>
            {events.length === 0 ? <div className="role-empty-state"><Clock3 size={28} aria-hidden="true" /><strong>No actions recorded yet</strong><p>When participants act, accepted steps appear here in real time.</p></div> : <ol className="role-timeline" aria-live="polite" aria-relevant="additions text">{events.map((event) => <li key={event.id} className={event.actorRole === role ? "is-own" : ""}><span className="role-timeline-dot"><BadgeCheck size={15} aria-hidden="true" /></span><div className="role-timeline-entry"><div className="role-timeline-meta"><span>#{String(event.seq).padStart(2, "0")} · {roleConfig[event.actorRole].name}</span><time dateTime={event.createdAt}>{formatTime(event.createdAt)}</time></div><strong>{actionCopy[event.action].title}</strong><p>{event.description}</p>{event.actorRole === role && <small>YOUR ACTION</small>}</div></li>)}</ol>}
            <div className="role-activity-foot"><span>Your accepted actions</span><strong>{ownEvents.length}</strong></div>
          </section>
        )}
      </main>

      <nav className="role-nav" aria-label="Participant navigation">
        <button type="button" className={tab === "overview" ? "is-active" : ""} onClick={() => setTab("overview")} aria-current={tab === "overview" ? "page" : undefined}><WalletCards size={19} aria-hidden="true" /><span>Overview</span></button>
        <button type="button" className={tab === "work" ? "is-active" : ""} onClick={() => setTab("work")} aria-current={tab === "work" ? "page" : undefined}><Layers3 size={19} aria-hidden="true" /><span>Work</span>{available.length > 0 && <i aria-label={`${available.length} available actions`} />}</button>
        <button type="button" className={tab === "activity" ? "is-active" : ""} onClick={() => setTab("activity")} aria-current={tab === "activity" ? "page" : undefined}><Activity size={19} aria-hidden="true" /><span>Activity</span></button>
      </nav>

      {detailOpen && <div className="role-detail-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailOpen(false); }}><aside className="role-detail" role="dialog" aria-modal="true" aria-labelledby="role-detail-title" onKeyDown={(event) => { if (event.key === "Tab") { event.preventDefault(); detailCloseRef.current?.focus(); } }}><div className="role-detail-handle" aria-hidden="true" /><div className="role-detail-top"><span>FICTIONAL SAMPLE RECORD</span><button ref={detailCloseRef} type="button" onClick={() => setDetailOpen(false)} aria-label="Close sample record"><X size={20} /></button></div><div className="role-detail-emblem"><FileText size={28} aria-hidden="true" /></div><h2 id="role-detail-title">{config.sampleTitle}</h2><p>{config.sampleDescription}</p><dl><div><dt>Reference</dt><dd>{config.sampleId}</dd></div><div><dt>Workspace</dt><dd>{config.name}</dd></div><div><dt>Scenario run</dt><dd>{room.run}</dd></div><div><dt>Record type</dt><dd>Illustrative only</dd></div></dl><div className="role-detail-disclaimer"><ShieldCheck size={17} aria-hidden="true" />This is sample UI data. Only entries in Activity represent accepted actions in this room.</div></aside></div>}
    </div>
  );
}

export default RoleDashboard;
