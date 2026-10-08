"use client";

import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { RoomView } from "./contracts";

export async function roomRequest(payload?: Record<string, unknown>) {
  const response = await fetch("/api/room", payload ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store",
  } : { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The room could not be updated.");
  return data;
}

export function useRoom() {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { const data = await roomRequest(); setRoom(data.room); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Room connection failed."); }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => { void refresh(); }, 0);
    const poll = window.setInterval(refresh, 5000);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return () => { window.clearTimeout(initial); window.clearInterval(poll); };
    const client = createClient(url, key, { auth: { persistSession: false } });
    const channel = client.channel("idea2-room-updates").on("postgres_changes", {
      event: "UPDATE", schema: "public", table: "demo_rooms",
    }, () => { void refresh(); }).subscribe();
    return () => { window.clearTimeout(initial); window.clearInterval(poll); void client.removeChannel(channel); };
  }, [refresh]);
  return { room, setRoom, error, refresh };
}
