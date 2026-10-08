"use client";

import { useEffect, useState } from "react";
import { PresenterDashboard } from "@/components/presenter/PresenterDashboard";
import { AdminCommand } from "@/lib/contracts";
import { roomRequest, useRoom } from "@/lib/client";

export default function HomePage() {
  const { room, setRoom, error } = useRoom();
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [busy, setBusy] = useState(false);
  const [joinUrl, setJoinUrl] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => { setJoinUrl(`${window.location.origin}/join`); const saved = window.sessionStorage.getItem("idea2-admin-pin"); if (saved) { setPin(saved); void roomRequest({ kind: "admin-check", pin: saved }).then(() => setUnlocked(true)).catch(() => window.sessionStorage.removeItem("idea2-admin-pin")); } }, 0); return () => window.clearTimeout(timer); }, []);
  async function unlock(event: React.FormEvent) {
    event.preventDefault(); setAdminError("");
    try { await roomRequest({ kind: "admin-check", pin }); window.sessionStorage.setItem("idea2-admin-pin", pin); setUnlocked(true); }
    catch (cause) { setAdminError(cause instanceof Error ? cause.message : "Presenter access failed."); }
  }
  async function onAdmin(command: AdminCommand, targetSessionId?: string) {
    setBusy(true); setAdminError("");
    try { const result = await roomRequest({ kind: "admin", pin, command, targetSessionId }); setRoom(result.room); }
    catch (cause) { setAdminError(cause instanceof Error ? cause.message : "Admin action failed."); }
    finally { setBusy(false); }
  }
  return <>
    <div className="simulation-banner">Fictional interactive simulation · no live securities, custody, settlement or blockchain integration</div>
    {error && <div className="page-error" role="alert">{error}</div>}
    {!room ? <div className="page-loading">Connecting to the demonstration room…</div> : <>
      {!unlocked && <form onSubmit={unlock} style={{display:"flex",gap:8,alignItems:"center",justifyContent:"center",flexWrap:"wrap",padding:12,background:"#eaf0ff"}}><label htmlFor="admin-pin">Presenter PIN</label><input id="admin-pin" type="password" value={pin} onChange={(event)=>setPin(event.target.value)} autoComplete="off" required style={{padding:8,border:"1px solid #abbad9",borderRadius:6}}/><button type="submit" style={{padding:"9px 16px",border:0,borderRadius:6,background:"#245bea",color:"white"}}>Unlock controls</button>{adminError && <span role="alert">{adminError}</span>}</form>}
      <PresenterDashboard room={room} joinUrl={joinUrl} onAdmin={onAdmin} busy={busy || !unlocked} error={adminError || undefined}/>
    </>}
  </>;
}
