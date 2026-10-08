"use client";

import { useCallback, useEffect, useState } from "react";
import { RoleDashboard } from "@/components/role/RoleDashboard";
import { ActionType, Role, roles, SessionView } from "@/lib/contracts";
import { roomRequest, useRoom } from "@/lib/client";
import "./join.css";

const labels: Record<Role, string> = { portfolio: "Portfolio team", lending: "Lending desk", broker_a: "Prime broker A", broker_b: "Prime broker B", custodian: "Custodian" };

export default function JoinPage() {
  const { room, setRoom, error: roomError } = useRoom();
  const [token, setToken] = useState("");
  const [session, setSession] = useState<SessionView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rejoin = useCallback(async (currentToken?: string) => {
    try {
      const result = await roomRequest({ kind: "join", token: currentToken });
      localStorage.setItem("idea2-session-token", result.token);
      setToken(result.token); setSession(result.session); setRoom(result.room); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not join room."); }
  }, [setRoom]);
  useEffect(() => { const timer = window.setTimeout(() => { void rejoin(localStorage.getItem("idea2-session-token") || undefined); }, 0); return () => window.clearTimeout(timer); }, [rejoin]);
  useEffect(() => {
    if (!token) return;
    const timer = window.setInterval(() => { void roomRequest({ kind: "heartbeat", token }).then((result) => setRoom(result.room)).catch(() => undefined); }, 15000);
    return () => window.clearInterval(timer);
  }, [token, setRoom]);
  const currentSession = room?.sessions.find((item) => item.id === session?.id) || session;
  async function chooseRole(role: Role) {
    setBusy(true); setError("");
    try { const result = await roomRequest({ kind: "role", token, role }); setSession(result.session); setRoom(result.room); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not assign role."); }
    finally { setBusy(false); }
  }
  async function onAction(action: ActionType) {
    setBusy(true); setError("");
    try { const result = await roomRequest({ kind: "action", token, requestId: crypto.randomUUID(), action }); setRoom(result.room); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Action was not accepted."); }
    finally { setBusy(false); }
  }
  return <>
    {!currentSession?.role && <div className="simulation-banner">Fictional interactive simulation · no live securities, custody, settlement or blockchain integration</div>}
    {roomError && <div className="page-error" role="alert">{roomError}</div>}
    {!room || !currentSession ? <div className="page-loading">Joining the demonstration room…</div> : currentSession.kicked ? <main className="join-shell"><section className="join-card"><p className="eyebrow">Connection ended</p><h1>Presenter removed this device</h1><p>You can rejoin as a waiting device and choose an available role.</p><button className="join-primary" onClick={() => void rejoin()} disabled={busy}>Rejoin room</button></section></main> : !currentSession.role ? <main className="join-shell"><section className="join-card"><p className="eyebrow">Buckleson · Idea 02</p><h1>Join the recall desk</h1><p>Choose one participant role. Each device owns one role in this fictional T+1 securities lending workflow.</p><div className="join-stats"><span>{room.connectedCount} devices connected</span><span>{room.waitingCount} waiting</span></div><div className="role-picker">{roles.map((role) => { const taken = room.sessions.some((item) => item.id !== currentSession.id && item.role === role && !item.kicked); return <button key={role} onClick={() => void chooseRole(role)} disabled={taken || busy} aria-label={`Choose ${labels[role]}${taken ? ", already assigned" : ""}`}><strong>{labels[role]}</strong><small>{taken ? "Assigned" : "Available"}</small></button>; })}</div>{error && <p className="join-error" role="alert">{error}</p>}</section></main> : <RoleDashboard role={currentSession.role} room={room} onAction={onAction} busy={busy} error={error || undefined}/>}
    <div className="screen-reader-only" role="status" aria-live="polite">{room ? `Room status: ${room.phase}. ${room.events.length} actions accepted.` : "Connecting."}</div>
  </>;
}
