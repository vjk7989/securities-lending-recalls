import { createHash, randomUUID } from "node:crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ActionType, Role, RoomView, SessionView, roles } from "./contracts";
import { applyAction, resetRoom, RoomRecord, toRoomView, TransitionError } from "./domain";

const localRoomId = "29cdb848-0ae6-456c-a27a-5fb3bff21d02";
type SessionRecord = SessionView & { tokenHash: string };
type LocalState = { room: RoomRecord; sessions: SessionRecord[] };
const memory = globalThis as typeof globalThis & { __idea2State?: LocalState };
memory.__idea2State ??= { room: { id: localRoomId, run: 1, version: 0, events: [] }, sessions: [] };

const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.DEMO_ROOM_ID);
function database(): SupabaseClient {
  if (!configured) throw new Error("Supabase is not configured for this deployment.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}
function localMode(): boolean { return !configured && process.env.NODE_ENV !== "production"; }
function roomId(): string { return process.env.DEMO_ROOM_ID || localRoomId; }
function hash(token: string): string { return createHash("sha256").update(token).digest("hex"); }
function validateRole(value: string): Role {
  if (!roles.includes(value as Role)) throw new TransitionError("forbidden", "Choose an available role.");
  return value as Role;
}
function mapSession(row: Record<string, unknown>): SessionView {
  return { id: String(row.id), role: row.role as Role | null, connected: false, kicked: Boolean(row.kicked), lastSeenAt: String(row.last_seen_at) };
}
function publicSession(session: SessionRecord): SessionView {
  return { id: session.id, role: session.role, connected: session.connected, kicked: session.kicked, lastSeenAt: session.lastSeenAt };
}

async function readRecord(): Promise<{ room: RoomRecord; sessions: SessionView[] }> {
  if (localMode()) {
    const state = memory.__idea2State!;
    return { room: state.room, sessions: state.sessions.map(publicSession) };
  }
  const db = database();
  const [roomResult, sessionResult] = await Promise.all([
    db.from("demo_rooms").select("id,run,version,events").eq("id", roomId()).single(),
    db.from("demo_sessions").select("id,role,kicked,last_seen_at").eq("room_id", roomId()),
  ]);
  if (roomResult.error) throw roomResult.error;
  if (sessionResult.error) throw sessionResult.error;
  return { room: roomResult.data as RoomRecord, sessions: (sessionResult.data || []).map(mapSession) };
}

export async function getRoom(): Promise<RoomView> {
  const { room, sessions } = await readRecord();
  return toRoomView(room, sessions);
}

export async function join(token?: string): Promise<{ token: string; session: SessionView; room: RoomView }> {
  const now = new Date().toISOString();
  if (localMode()) {
    const state = memory.__idea2State!;
    const givenHash = token ? hash(token) : null;
    let session = givenHash && state.sessions.find((item) => item.tokenHash === givenHash);
    if (!session || session.kicked) {
      token = randomUUID() + randomUUID();
      session = { id: randomUUID(), role: null, kicked: false, connected: true, lastSeenAt: now, tokenHash: hash(token) };
      state.sessions.push(session);
    }
    session.lastSeenAt = now;
    return { token: token!, session: publicSession(session), room: toRoomView(state.room, state.sessions.map(publicSession)) };
  }
  const db = database();
  let row = token ? (await db.from("demo_sessions").select("*").eq("room_id", roomId()).eq("token_hash", hash(token)).maybeSingle()).data : null;
  if (!row || row.kicked) {
    token = randomUUID() + randomUUID();
    const inserted = await db.from("demo_sessions").insert({ id: randomUUID(), room_id: roomId(), token_hash: hash(token), last_seen_at: now }).select("*").single();
    if (inserted.error) throw inserted.error;
    row = inserted.data;
  } else {
    const updated = await db.from("demo_sessions").update({ last_seen_at: now }).eq("id", row.id).select("*").single();
    if (updated.error) throw updated.error;
    row = updated.data;
  }
  return { token: token!, session: mapSession(row), room: await getRoom() };
}

export async function claimRole(token: string, candidate: string): Promise<{ session: SessionView; room: RoomView }> {
  const role = validateRole(candidate);
  if (localMode()) {
    const state = memory.__idea2State!;
    const session = state.sessions.find((item) => item.tokenHash === hash(token) && !item.kicked);
    if (!session) throw new TransitionError("forbidden", "Join the room again to choose a role.");
    if (state.sessions.some((item) => item.id !== session.id && !item.kicked && item.role === role)) throw new TransitionError("forbidden", "This role is already assigned.");
    session.role = role;
    session.lastSeenAt = new Date().toISOString();
    return { session: publicSession(session), room: toRoomView(state.room, state.sessions.map(publicSession)) };
  }
  const db = database();
  const result = await db.rpc("demo_claim_role", { p_room: roomId(), p_hash: hash(token), p_role: role });
  if (result.error) throw new TransitionError("forbidden", result.error.message.includes("role_already_assigned") || result.error.message.includes("unique") ? "This role is already assigned." : "Your role could not be assigned. Please rejoin or choose another role.");
  const row = await db.from("demo_sessions").select("*").eq("room_id", roomId()).eq("token_hash", hash(token)).single();
  if (row.error) throw row.error;
  return { session: mapSession(row.data), room: await getRoom() };
}

export async function submitAction(token: string, requestId: string, action: ActionType): Promise<RoomView> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new TransitionError("forbidden", "Invalid request ID.");
  if (localMode()) {
    const state = memory.__idea2State!;
    const session = state.sessions.find((item) => item.tokenHash === hash(token) && !item.kicked);
    if (!session?.role) throw new TransitionError("forbidden", "Join and choose a role before acting.");
    const existing = state.room.events.find((event) => event.id === requestId);
    if (existing && (existing.action !== action || existing.actorRole !== session.role)) throw new TransitionError("forbidden", "Request ID belongs to a different action.");
    if (!existing) state.room = applyAction(state.room, session.role, action, new Date().toISOString(), requestId);
    session.lastSeenAt = new Date().toISOString();
    return toRoomView(state.room, state.sessions.map(publicSession));
  }
  const db = database();
  for (let attempt = 0; attempt < 4; attempt++) {
    const [roomResult, sessionResult] = await Promise.all([
      db.from("demo_rooms").select("id,run,version,events").eq("id", roomId()).single(),
      db.from("demo_sessions").select("role,kicked").eq("room_id", roomId()).eq("token_hash", hash(token)).single(),
    ]);
    if (roomResult.error) throw roomResult.error;
    if (sessionResult.error || sessionResult.data.kicked || !sessionResult.data.role) throw new TransitionError("forbidden", "Your session is not authorized for this action.");
    const room = roomResult.data as RoomRecord;
    const existing = room.events.find((event) => event.id === requestId);
    if (existing && (existing.action !== action || existing.actorRole !== sessionResult.data.role)) throw new TransitionError("forbidden", "Request ID belongs to a different action.");
    if (existing) return getRoom();
    const next = applyAction(room, sessionResult.data.role as Role, action, new Date().toISOString(), requestId);
    const event = next.events.at(-1)!;
    const committed = await db.rpc("demo_commit_event", { p_room: roomId(), p_hash: hash(token), p_expected_version: room.version, p_event: event });
    if (!committed.error) return getRoom();
    if (!committed.error.message.includes("version_conflict")) throw new TransitionError("forbidden", committed.error.message);
  }
  throw new Error("The room changed during your action. Please try again.");
}

export async function heartbeat(token: string): Promise<RoomView> {
  if (localMode()) {
    const session = memory.__idea2State!.sessions.find((item) => item.tokenHash === hash(token) && !item.kicked);
    if (session) session.lastSeenAt = new Date().toISOString();
    return getRoom();
  }
  const db = database();
  await db.from("demo_sessions").update({ last_seen_at: new Date().toISOString() }).eq("room_id", roomId()).eq("token_hash", hash(token)).eq("kicked", false);
  return getRoom();
}

export async function adminCommand(command: "reset" | "kick", targetSessionId?: string): Promise<RoomView> {
  if (localMode()) {
    const state = memory.__idea2State!;
    if (command === "reset") state.room = resetRoom(state.room);
    else {
      const session = state.sessions.find((item) => item.id === targetSessionId);
      if (session) { session.kicked = true; session.role = null; }
    }
    return getRoom();
  }
  const db = database();
  if (command === "reset") {
    const result = await db.rpc("demo_reset_room", { p_room: roomId() });
    if (result.error) throw result.error;
  } else if (targetSessionId) {
    const result = await db.from("demo_sessions").update({ kicked: true, role: null }).eq("room_id", roomId()).eq("id", targetSessionId);
    if (result.error) throw result.error;
  }
  return getRoom();
}
