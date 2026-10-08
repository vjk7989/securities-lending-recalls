import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { scenario, type ActionType, type Role, type SessionView } from "../src/lib/contracts";
import { applyAction, currentEvents, resetRoom, toRoomView, TransitionError, type RoomRecord } from "../src/lib/domain";

const time = "2026-10-09T10:00:00.000Z";
const emptyRoom = (): RoomRecord => ({ id: "room-1", run: 1, version: 0, events: [] });
const step = (room: RoomRecord, role: Role, action: ActionType): RoomRecord =>
  applyAction(room, role, action, time, randomUUID());
const expectRejection = (run: () => unknown, code: TransitionError["code"]) => {
  try {
    run();
    throw new Error("Expected a transition rejection");
  } catch (error) {
    expect(error).toBeInstanceOf(TransitionError);
    expect((error as TransitionError).code).toBe(code);
  }
};

describe("deck-grounded recall scenario", () => {
  it("keeps the pitch figures and each accepted action in one ordered run", () => {
    expect(scenario).toEqual({
      saleShares: 400_000,
      onLoanShares: 250_000,
      brokerAReturnShares: 150_000,
      brokerBReturnShares: 100_000,
      sellOrderTime: "3:40 pm",
      settlement: "T+1",
    });
    expect(scenario.brokerAReturnShares + scenario.brokerBReturnShares).toBe(scenario.onLoanShares);

    let room = emptyRoom();
    const sequence: [Role, ActionType][] = [
      ["portfolio", "place_sale"],
      ["lending", "issue_recall"],
      ["broker_a", "return_150k"],
      ["broker_b", "return_100k"],
      ["custodian", "confirm_delivery"],
      ["lending", "release_collateral"],
      ["custodian", "settle_sale"],
    ];
    for (const [role, action] of sequence) room = step(room, role, action);
    expect(room.version).toBe(sequence.length);
    expect(currentEvents(room).map(({ action, seq, actorRole }) => ({ action, seq, actorRole }))).toEqual(
      sequence.map(([actorRole, action], index) => ({ action, seq: index + 1, actorRole })),
    );
    expect(toRoomView(room, []).phase).toBe("Settled");
  });

  it("rejects an early recall and delivery until both brokers have returned shares", () => {
    let room = emptyRoom();
    expectRejection(() => step(room, "lending", "issue_recall"), "out_of_order");
    room = step(room, "portfolio", "place_sale");
    room = step(room, "lending", "issue_recall");
    room = step(room, "broker_a", "return_150k");
    expectRejection(() => step(room, "custodian", "confirm_delivery"), "out_of_order");
    expectRejection(() => step(room, "lending", "release_collateral"), "out_of_order");
    expectRejection(() => step(room, "custodian", "settle_sale"), "out_of_order");
    expect(room.version).toBe(3);
  });

  it("accepts the broker returns in either order and then exposes custodian confirmation", () => {
    let room = step(step(emptyRoom(), "portfolio", "place_sale"), "lending", "issue_recall");
    room = step(room, "broker_b", "return_100k");
    expect(toRoomView(room, []).availableActions.custodian).toEqual([]);
    room = step(room, "broker_a", "return_150k");
    expect(toRoomView(room, []).availableActions.custodian).toEqual(["confirm_delivery"]);
  });

  it("rejects wrong-role and repeated actions without mutating the accepted record", () => {
    const initial = emptyRoom();
    expectRejection(() => step(initial, "lending", "place_sale"), "forbidden");
    const sold = step(initial, "portfolio", "place_sale");
    expectRejection(() => step(sold, "portfolio", "place_sale"), "already_done");
    expect(initial.events).toEqual([]);
    expect(sold.events).toHaveLength(1);
    expect(sold.version).toBe(1);
  });

  it("starts a repeatable run without displaying the previous run's events", () => {
    const first = step(emptyRoom(), "portfolio", "place_sale");
    const restarted = resetRoom(first);
    expect(restarted.run).toBe(2);
    expect(restarted.version).toBe(2);
    expect(currentEvents(restarted)).toEqual([]);
    expect(toRoomView(restarted, []).phase).toBe("Ready for sell order");
    const second = step(restarted, "portfolio", "place_sale");
    expect(second.events).toHaveLength(2);
    expect(currentEvents(second)).toHaveLength(1);
    expect(currentEvents(second)[0]).toMatchObject({ run: 2, seq: 3, action: "place_sale" });
  });
});

describe("room projection", () => {
  it("counts active and waiting devices while excluding kicked or stale sessions", () => {
    const sessions: SessionView[] = [
      { id: "assigned", role: "portfolio", connected: false, kicked: false, lastSeenAt: time },
      { id: "waiting", role: null, connected: false, kicked: false, lastSeenAt: time },
      { id: "kicked", role: "lending", connected: true, kicked: true, lastSeenAt: time },
      { id: "stale", role: "custodian", connected: true, kicked: false, lastSeenAt: "2026-10-09T09:58:00.000Z" },
    ];
    const view = toRoomView(emptyRoom(), sessions, Date.parse(time) + 1_000);
    expect(view.connectedCount).toBe(2);
    expect(view.waitingCount).toBe(1);
    expect(view.sessions.map(({ id, connected }) => [id, connected])).toEqual([
      ["assigned", true], ["waiting", true], ["kicked", false], ["stale", false],
    ]);
    expect(view.availableActions.portfolio).toEqual(["place_sale"]);
    expect(view.availableActions.lending).toEqual([]);
  });
});
