import { randomUUID } from "node:crypto";
import { ActionType, Role, RoomEvent, RoomView, SessionView, scenario } from "./contracts";

export type RoomRecord = { id: string; run: number; version: number; events: RoomEvent[] };
export type TransitionErrorCode = "forbidden" | "out_of_order" | "already_done";
export class TransitionError extends Error {
  constructor(public code: TransitionErrorCode, message: string) { super(message); }
}

const roleForAction: Record<ActionType, Role> = {
  place_sale: "portfolio",
  issue_recall: "lending",
  return_150k: "broker_a",
  return_100k: "broker_b",
  confirm_delivery: "custodian",
  release_collateral: "lending",
  settle_sale: "custodian",
};

const requirements: Record<ActionType, ActionType[]> = {
  place_sale: [],
  issue_recall: ["place_sale"],
  return_150k: ["issue_recall"],
  return_100k: ["issue_recall"],
  confirm_delivery: ["return_150k", "return_100k"],
  release_collateral: ["confirm_delivery"],
  settle_sale: ["release_collateral"],
};

const descriptions: Record<ActionType, string> = {
  place_sale: "Portfolio team records the 400K share sale",
  issue_recall: "Lending desk issues the 250K share recall",
  return_150k: "Prime broker A returns 150K shares",
  return_100k: "Prime broker B returns 100K shares",
  confirm_delivery: "Custodian confirms shares available for delivery",
  release_collateral: "Lending desk records collateral release instruction",
  settle_sale: "Custodian records 400K share delivery for T+1 settlement",
};

export const actionLabels: Record<ActionType, string> = {
  place_sale: "Record sell order",
  issue_recall: "Issue recall",
  return_150k: "Return 150K shares",
  return_100k: "Return 100K shares",
  confirm_delivery: "Confirm delivery",
  release_collateral: "Record collateral release",
  settle_sale: "Record settlement",
};

export function currentEvents(room: RoomRecord): RoomEvent[] {
  return room.events.filter((event) => event.run === room.run).sort((a, b) => a.seq - b.seq);
}

export function canApply(room: RoomRecord, role: Role, action: ActionType): void {
  if (roleForAction[action] !== role) throw new TransitionError("forbidden", "This action belongs to a different participant role.");
  const done = new Set(currentEvents(room).map((event) => event.action));
  if (done.has(action)) throw new TransitionError("already_done", "This action was already recorded for this run.");
  if (requirements[action].some((required) => !done.has(required))) {
    throw new TransitionError("out_of_order", "A required earlier step has not been recorded yet.");
  }
}

export function applyAction(room: RoomRecord, role: Role, action: ActionType, now = new Date().toISOString(), id: string = randomUUID()): RoomRecord {
  canApply(room, role, action);
  const event: RoomEvent = {
    id, seq: room.version + 1, run: room.run, action, actorRole: role, createdAt: now, description: descriptions[action],
  };
  return { ...room, version: room.version + 1, events: [...room.events, event] };
}

export function resetRoom(room: RoomRecord): RoomRecord {
  return { ...room, run: room.run + 1, version: room.version + 1 };
}

export function toRoomView(room: RoomRecord, sessions: SessionView[], now = Date.now()): RoomView {
  const events = currentEvents(room);
  const done = new Set(events.map((event) => event.action));
  const availableActions: Record<Role, ActionType[]> = { portfolio: [], lending: [], broker_a: [], broker_b: [], custodian: [] };
  (Object.keys(requirements) as ActionType[]).forEach((action) => {
    if (done.has(action) || requirements[action].some((required) => !done.has(required))) return;
    availableActions[roleForAction[action]].push(action);
  });
  const live = sessions.map((session) => ({ ...session, connected: !session.kicked && now - Date.parse(session.lastSeenAt) < 35_000 }));
  const phase = done.has("settle_sale") ? "Settled" : done.has("confirm_delivery") ? "Delivery confirmed" : done.has("issue_recall") ? "Recall in progress" : done.has("place_sale") ? "Sale recorded" : "Ready for sell order";
  return {
    id: room.id, run: room.run, version: room.version, phase, events, sessions: live,
    connectedCount: live.filter((session) => session.connected).length,
    waitingCount: live.filter((session) => session.connected && !session.role).length,
    availableActions, scenario,
  };
}
