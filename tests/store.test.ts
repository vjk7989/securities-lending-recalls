import { beforeEach, describe, expect, it } from "vitest";
import { adminCommand, claimRole, getRoom, join, submitAction } from "../src/lib/store";

const requestId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

beforeEach(() => {
  (globalThis as typeof globalThis & { __idea2State?: unknown }).__idea2State = {
    room: { id: "29cdb848-0ae6-456c-a27a-5fb3bff21d02", run: 1, version: 0, events: [] },
    sessions: [],
  };
});

describe("local development room session and action contract", () => {
  it("reconnects with the same token and retains the assigned role", async () => {
    const first = await join();
    await claimRole(first.token, "portfolio");
    const resumed = await join(first.token);
    expect(resumed.token).toBe(first.token);
    expect(resumed.session.id).toBe(first.session.id);
    expect(resumed.session.role).toBe("portfolio");
    expect(resumed.room.connectedCount).toBe(1);
  });

  it("enforces exclusive roles while allowing a participant to change to an available role", async () => {
    const first = await join();
    const second = await join();
    await claimRole(first.token, "portfolio");
    await expect(claimRole(second.token, "portfolio")).rejects.toMatchObject({ code: "forbidden" });
    await claimRole(first.token, "lending");
    const reassigned = await claimRole(second.token, "portfolio");
    expect(reassigned.session.role).toBe("portfolio");
    expect(reassigned.room.sessions.find((session) => session.id === first.session.id)?.role).toBe("lending");
  });

  it("accepts one action per request ID and keeps one shared ordered record", async () => {
    const portfolio = await join();
    const lending = await join();
    await claimRole(portfolio.token, "portfolio");
    await claimRole(lending.token, "lending");
    const sold = await submitAction(portfolio.token, requestId(1), "place_sale");
    const retried = await submitAction(portfolio.token, requestId(1), "place_sale");
    const recalled = await submitAction(lending.token, requestId(2), "issue_recall");
    expect(sold.events).toHaveLength(1);
    expect(retried.events).toHaveLength(1);
    expect(retried.version).toBe(sold.version);
    expect(recalled.events.map((event) => event.seq)).toEqual([1, 2]);
    expect((await getRoom()).events.map((event) => event.action)).toEqual(["place_sale", "issue_recall"]);
  });

  it("rejects anonymous, wrong-role, out-of-order, and malformed requests", async () => {
    const participant = await join();
    await expect(submitAction(participant.token, requestId(1), "place_sale")).rejects.toMatchObject({ code: "forbidden" });
    await claimRole(participant.token, "portfolio");
    await expect(submitAction(participant.token, "bad-id", "place_sale")).rejects.toMatchObject({ code: "forbidden" });
    await expect(submitAction(participant.token, requestId(1), "issue_recall")).rejects.toMatchObject({ code: "forbidden" });
    expect((await getRoom()).events).toEqual([]);
  });

  it("kicks a device, releases its role, and admits it only as a new waiting session", async () => {
    const first = await join();
    await claimRole(first.token, "portfolio");
    const kicked = await adminCommand("kick", first.session.id);
    expect(kicked.sessions.find((session) => session.id === first.session.id)).toMatchObject({ role: null, kicked: true, connected: false });
    await expect(submitAction(first.token, requestId(1), "place_sale")).rejects.toMatchObject({ code: "forbidden" });
    const rejoined = await join(first.token);
    expect(rejoined.session.id).not.toBe(first.session.id);
    expect(rejoined.token).not.toBe(first.token);
    expect(rejoined.session.role).toBeNull();
    expect(rejoined.room.waitingCount).toBe(1);
    await claimRole(rejoined.token, "portfolio");
  });

  it("resets for a second pitch run and retains historical events outside the current projection", async () => {
    const first = await join();
    await claimRole(first.token, "portfolio");
    await submitAction(first.token, requestId(1), "place_sale");
    const reset = await adminCommand("reset");
    expect(reset.run).toBe(2);
    expect(reset.events).toEqual([]);
    const repeated = await submitAction(first.token, requestId(2), "place_sale");
    expect(repeated.events).toHaveLength(1);
    expect(repeated.events[0]).toMatchObject({ run: 2, seq: 3 });
  });
});
