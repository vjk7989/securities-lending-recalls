"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  CircleHelp,
  Copy,
  MonitorUp,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Users,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { ActionType, AdminCommand, Role, RoomView } from "@/lib/contracts";
import "./presenter.css";

type Props = {
  room: RoomView;
  joinUrl: string;
  onAdmin: (command: AdminCommand, targetSessionId?: string) => Promise<void>;
  busy: boolean;
  error?: string;
};

const roleLabels: Record<Role, string> = {
  portfolio: "Portfolio manager",
  lending: "Lending desk",
  broker_a: "Broker A",
  broker_b: "Broker B",
  custodian: "Custodian",
};

const actionLabels: Record<ActionType, string> = {
  place_sale: "Place sale order",
  issue_recall: "Issue share recall",
  return_150k: "Return 150,000 shares",
  return_100k: "Return 100,000 shares",
  confirm_delivery: "Confirm delivery",
  release_collateral: "Release collateral",
  settle_sale: "Settle sale",
};

const actionDescriptions: Record<ActionType, string> = {
  place_sale: "The portfolio manager starts a 400,000-share sale.",
  issue_recall: "The lending desk recalls the 250,000 shares currently on loan.",
  return_150k: "Broker A returns its 150,000-share allocation.",
  return_100k: "Broker B returns its 100,000-share allocation.",
  confirm_delivery: "The custodian confirms the returned shares have arrived.",
  release_collateral: "The lending desk releases the brokers’ collateral.",
  settle_sale: "The portfolio manager’s sale moves to settlement.",
};

const actionOrder: ActionType[] = [
  "place_sale",
  "issue_recall",
  "return_150k",
  "return_100k",
  "confirm_delivery",
  "release_collateral",
  "settle_sale",
];

const nodes: { role: Role; x: number; y: number; kicker: string; number: string }[] = [
  { role: "portfolio", x: 15, y: 28, kicker: "SALE INITIATOR", number: "01" },
  { role: "lending", x: 48, y: 28, kicker: "COORDINATION", number: "02" },
  { role: "broker_a", x: 82, y: 14, kicker: "BORROWER", number: "03" },
  { role: "broker_b", x: 82, y: 57, kicker: "BORROWER", number: "04" },
  { role: "custodian", x: 48, y: 78, kicker: "DELIVERY", number: "05" },
];

const routes: { id: string; action: ActionType; d: string }[] = [
  { id: "sale", action: "place_sale", d: "M 245 143 C 315 143, 342 143, 418 143" },
  { id: "recall-a", action: "issue_recall", d: "M 572 122 C 644 122, 665 70, 740 70" },
  { id: "recall-b", action: "issue_recall", d: "M 572 163 C 660 163, 668 289, 740 289" },
  { id: "return-a", action: "return_150k", d: "M 818 116 C 805 315, 688 396, 573 396" },
  { id: "return-b", action: "return_100k", d: "M 742 340 C 704 378, 630 396, 573 396" },
  { id: "delivery", action: "confirm_delivery", d: "M 485 352 C 485 310, 485 240, 485 192" },
  { id: "collateral-a", action: "release_collateral", d: "M 570 115 C 625 60, 675 48, 740 48" },
  { id: "collateral-b", action: "release_collateral", d: "M 575 173 C 655 195, 689 272, 740 272" },
  { id: "settle", action: "settle_sale", d: "M 418 162 C 340 192, 315 192, 245 162" },
];

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function PresenterDashboard({ room, joinUrl, onAdmin, busy, error }: Props) {
  const events = room.events.filter((event) => event.run === room.run).sort((a, b) => a.seq - b.seq);
  const latest = events.at(-1);
  const currentEventKey = `${room.run}:${latest?.seq ?? 0}`;
  const currentAction = latest?.action;
  const [animatedAction, setAnimatedAction] = useState<ActionType | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [confirmReset, setConfirmReset] = useState(false);
  const lastEvent = useRef(currentEventKey);

  useEffect(() => {
    const key = currentEventKey;
    const previous = lastEvent.current;
    lastEvent.current = key;
    if (!currentAction || previous === key) return;
    if (previous.split(":")[0] !== String(room.run)) {
      setAnimatedAction(null);
      return;
    }
    setAnimatedAction(currentAction);
    const timeout = window.setTimeout(() => setAnimatedAction(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [currentAction, currentEventKey, room.run]);

  const complete = events.some((event) => event.action === "settle_sale");
  const done = new Set(events.map((event) => event.action));
  const connectedByRole = new Map<Role, number>();
  for (const session of room.sessions) {
    if (session.connected && !session.kicked && session.role) {
      connectedByRole.set(session.role, (connectedByRole.get(session.role) ?? 0) + 1);
    }
  }

  async function copyJoinUrl() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2400);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 2400);
    }
  }

  async function resetRun() {
    await onAdmin("reset");
    setConfirmReset(false);
    setAnimatedAction(null);
  }

  return (
    <main className="presenter">
      <div className="presenter-shell">
        <header className="presenter-topbar">
          <div className="presenter-brand">
            <span className="presenter-brand-mark"><span /></span>
            <span className="presenter-brand-name">HYPER<span>-0X</span></span>
            <span className="presenter-brand-divider" />
            <span className="presenter-brand-context">SECURITIES LENDING / LIVE ROOM</span>
          </div>
          <div className="presenter-topbar-right">
            <span className="presenter-live"><span className="presenter-live-dot" /> LIVE DEMONSTRATION</span>
            <span className="presenter-run">RUN {String(room.run).padStart(2, "0")}</span>
            <span className="presenter-room-id">ROOM {room.id.slice(0, 8).toUpperCase()}</span>
          </div>
        </header>

        <section className="presenter-intro">
          <div>
            <div className="presenter-eyebrow"><span>01 / SCENARIO</span><span className="presenter-eyebrow-line" /></div>
            <h1>A sale triggers a <em>share recall.</em></h1>
            <p>Five parties. One shared sequence. Watch each accepted action move through the room in real time.</p>
          </div>
          <div className="presenter-intro-metrics">
            <div><strong>{(room.scenario.saleShares / 1000).toFixed(0)}k</strong><span>shares to sell</span></div>
            <div><strong>{(room.scenario.onLoanShares / 1000).toFixed(0)}k</strong><span>shares on loan</span></div>
            <div><strong>{room.scenario.settlement}</strong><span>settlement</span></div>
          </div>
        </section>

        <div className="presenter-main-grid">
          <section className="presenter-flow-panel" aria-label="Live securities lending workflow">
            <div className="presenter-section-heading">
              <div><span className="presenter-section-index">02</span><h2>Live transaction flow</h2></div>
              <span className={`presenter-phase ${complete ? "is-complete" : ""}`}>
                <span className="presenter-phase-dot" />{complete ? "SETTLED" : events.length ? "IN PROGRESS" : "AWAITING FIRST ACTION"}
              </span>
            </div>
            <div className="presenter-flow-stage">
              <div className="presenter-stage-grid" aria-hidden="true" />
              <svg className="presenter-routes" viewBox="0 0 1000 460" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <marker id="presenter-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#42556a" /></marker>
                  <marker id="presenter-arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#e8b876" /></marker>
                </defs>
                {routes.map((route) => (
                  <g key={route.id}>
                    <path className="presenter-route-base" d={route.d} markerEnd="url(#presenter-arrow)" />
                    {animatedAction === route.action && (
                      <path key={`${room.run}-${latest?.seq}-${route.id}`} className="presenter-route-active" d={route.d} markerEnd="url(#presenter-arrow-active)" />
                    )}
                  </g>
                ))}
              </svg>
              {nodes.map((node) => {
                const isActor = animatedAction && latest?.actorRole === node.role;
                return (
                  <div
                    key={node.role}
                    className={`presenter-node presenter-node-${node.role}${isActor ? " is-actor" : ""}${connectedByRole.has(node.role) ? " is-connected" : ""}`}
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                  >
                    <div className="presenter-node-top"><span>{node.number} / {node.kicker}</span><span className="presenter-node-status" /></div>
                    <div className="presenter-node-name">{roleLabels[node.role]}</div>
                    <div className="presenter-node-bottom">{connectedByRole.has(node.role) ? `${connectedByRole.get(node.role)} device${connectedByRole.get(node.role) === 1 ? "" : "s"} live` : "Waiting for device"}</div>
                  </div>
                );
              })}
              <div className="presenter-stage-annotation presenter-stage-annotation-sale">SELL ORDER <b>{room.scenario.sellOrderTime}</b></div>
              <div className="presenter-stage-annotation presenter-stage-annotation-loan">ON LOAN <b>{(room.scenario.onLoanShares / 1000).toFixed(0)}K</b></div>
              <div className="presenter-stage-annotation presenter-stage-annotation-return">RETURNED <b>{((done.has("return_150k") ? room.scenario.brokerAReturnShares : 0) + (done.has("return_100k") ? room.scenario.brokerBReturnShares : 0)) / 1000}K / 250K</b></div>
              <div className="presenter-stage-footer"><span><span className="presenter-legend-line" /> EVENT ROUTE</span><span><span className="presenter-legend-line presenter-legend-line-active" /> NEWLY ACCEPTED ACTION</span></div>
            </div>
            <div className="presenter-current-event" aria-live="polite">
              <div className="presenter-current-icon">{latest ? <ArrowDownRight size={21} strokeWidth={1.7} /> : <CircleHelp size={21} strokeWidth={1.7} />}</div>
              <div><span>{latest ? `LATEST ACCEPTED ACTION · #${String(latest.seq).padStart(2, "0")}` : "READY FOR THE FIRST ACTION"}</span><strong>{latest ? actionLabels[latest.action] : "Invite a participant to begin"}</strong><p>{latest ? actionDescriptions[latest.action] : "Open the join link on a phone and take a role to start the live sequence."}</p></div>
              {latest && <time>{formatTime(latest.createdAt)} IST</time>}
            </div>
          </section>

          <aside className="presenter-side">
            <section className="presenter-card presenter-join-card">
              <div className="presenter-card-heading"><div><Smartphone size={17} /><h2>Join this room</h2></div><span>SCAN TO PLAY</span></div>
              <div className="presenter-qr-wrap"><QRCodeSVG value={joinUrl} size={154} level="M" includeMargin={false} bgColor="#ffffff" fgColor="#17253a" aria-label="QR code for the participant join link" /></div>
              <p>Participants scan, choose a role, and submit their action from any device.</p>
              <div className="presenter-join-link"><span title={joinUrl}>{joinUrl}</span><button type="button" onClick={copyJoinUrl} aria-label="Copy join link" title="Copy join link">{copyState === "copied" ? <Check size={16} /> : <Copy size={16} />}</button></div>
              <div className="presenter-join-feedback" aria-live="polite">{copyState === "copied" ? "Join link copied" : copyState === "failed" ? "Copy unavailable; use the QR code" : ""}</div>
            </section>
            <section className="presenter-card presenter-devices-card">
              <div className="presenter-card-heading"><div><Users size={17} /><h2>Connected devices</h2></div><strong>{room.connectedCount}</strong></div>
              <div className="presenter-device-summary"><span><i /> {room.connectedCount} connected</span><span>{room.waitingCount} waiting for role</span></div>
              <div className="presenter-device-list">
                {room.sessions.filter((session) => !session.kicked).length === 0 ? <p className="presenter-empty">No participants yet. Scan the code to join.</p> : room.sessions.filter((session) => !session.kicked).map((session) => (
                  <div className="presenter-device" key={session.id}>
                    <span className={`presenter-device-indicator${session.connected ? " is-online" : ""}`} />
                    <div><strong>{session.role ? roleLabels[session.role] : "Choosing a role"}</strong><small>{session.connected ? "Connected" : "Disconnected"} · {session.id.slice(0, 6).toUpperCase()}</small></div>
                    <button type="button" disabled={busy} onClick={() => void onAdmin("kick", session.id)} title="Remove device" aria-label={`Remove ${session.role ? roleLabels[session.role] : "unassigned"} device ${session.id.slice(0, 6)}`}><X size={15} /></button>
                  </div>
                ))}
              </div>
            </section>
            <section className="presenter-admin-card">
              <div><MonitorUp size={17} /><span>Presenter controls</span></div>
              {!confirmReset ? (
                <button type="button" disabled={busy} onClick={() => setConfirmReset(true)}><RotateCcw size={15} /> Reset run</button>
              ) : (
                <div className="presenter-reset-confirm"><span>Start a new run?</span><button type="button" onClick={() => setConfirmReset(false)}>Cancel</button><button type="button" disabled={busy} onClick={() => void resetRun()}>Confirm</button></div>
              )}
            </section>
            {error && <div className="presenter-error" role="alert">{error}</div>}
          </aside>
        </div>

        <div className="presenter-bottom-grid">
          <section className="presenter-comparison-panel">
            <div className="presenter-section-heading"><div><span className="presenter-section-index">03</span><h2>Same actions. Shared visibility.</h2></div><span className="presenter-comparison-note">ILLUSTRATIVE PROCESS COMPARISON</span></div>
            <div className="presenter-comparison-head"><span>WITHOUT A SHARED WORKFLOW <small>Illustrative bilateral coordination</small></span><span>WITH HYPER-0X <small>Live accepted actions in this room</small></span></div>
            <div className="presenter-comparison-rows">
              {actionOrder.map((action, index) => {
                const event = events.find((item) => item.action === action);
                return <div className="presenter-comparison-row" key={action}>
                  <div className="presenter-comparison-traditional"><span>{String(index + 1).padStart(2, "0")}</span><strong>{actionLabels[action]}</strong><small>Coordination across parties</small></div>
                  <ArrowRight size={15} className="presenter-comparison-arrow" />
                  <div className={`presenter-comparison-hyper${event ? " is-done" : ""}`}><span>{event ? <Check size={13} /> : "·"}</span><strong>{actionLabels[action]}</strong><small>{event ? `Accepted · event #${event.seq}` : "Awaiting action"}</small></div>
                </div>;
              })}
            </div>
            <p className="presenter-comparison-disclaimer">The left column illustrates coordination for the same seven actions. It is not a measured workflow or a performance claim.</p>
          </section>
          <section className="presenter-log-panel">
            <div className="presenter-section-heading"><div><span className="presenter-section-index">04</span><h2>Accepted action log</h2></div><span className="presenter-log-count">{events.length} / {actionOrder.length}</span></div>
            <div className="presenter-log-list" aria-live="polite">
              {events.length === 0 ? <div className="presenter-log-empty"><ShieldCheck size={25} strokeWidth={1.4} /><strong>The log is ready.</strong><span>Accepted actions appear here as the room progresses.</span></div> : [...events].reverse().map((event) => <div className="presenter-log-entry" key={event.id}><span className="presenter-log-seq">#{String(event.seq).padStart(2, "0")}</span><div><strong>{actionLabels[event.action]}</strong><small>{roleLabels[event.actorRole]}</small></div><time>{formatTime(event.createdAt)}</time></div>)}
            </div>
            <div className="presenter-log-footer"><span><span className="presenter-live-dot" /> LIVE ROOM STATE</span><span>VERSION {room.version}</span></div>
          </section>
        </div>
        <footer className="presenter-footer"><span>HYPER-0X / VANGUARD DEMONSTRATION</span><span>Illustrative securities lending scenario · {room.scenario.settlement} settlement</span></footer>
      </div>
    </main>
  );
}

export default PresenterDashboard;
