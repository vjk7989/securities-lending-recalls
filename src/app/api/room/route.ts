import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ActionType, AdminCommand } from "@/lib/contracts";
import { TransitionError } from "@/lib/domain";
import { adminCommand, claimRole, getRoom, heartbeat, join, submitAction } from "@/lib/store";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error.";
  const status = error instanceof TransitionError ? (error.code === "already_done" || error.code === "out_of_order" ? 409 : 403) : message.includes("not configured") ? 503 : 500;
  if (status === 500) console.error("Room API error", error);
  return NextResponse.json({ error: status === 500 ? "The room service could not complete the request. Please retry." : message }, { status });
}

const validActions: ActionType[] = ["place_sale", "issue_recall", "return_150k", "return_100k", "confirm_delivery", "release_collateral", "settle_sale"];

function validAdminPin(candidate: unknown): boolean {
  const actual = process.env.DEMO_ADMIN_PIN || (process.env.NODE_ENV === "production" ? "" : "demo-admin");
  if (!actual || typeof candidate !== "string") return false;
  const left = Buffer.from(candidate);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET() {
  try { return NextResponse.json({ room: await getRoom() }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  try {
    switch (body.kind) {
      case "join": return NextResponse.json(await join(typeof body.token === "string" ? body.token : undefined));
      case "role": {
        if (typeof body.token !== "string" || typeof body.role !== "string") return NextResponse.json({ error: "Token and role are required." }, { status: 400 });
        return NextResponse.json(await claimRole(body.token, body.role));
      }
      case "heartbeat": {
        if (typeof body.token !== "string") return NextResponse.json({ error: "Token is required." }, { status: 400 });
        return NextResponse.json({ room: await heartbeat(body.token) });
      }
      case "action": {
        if (typeof body.token !== "string" || typeof body.requestId !== "string" || typeof body.action !== "string") return NextResponse.json({ error: "Token, request ID, and action are required." }, { status: 400 });
        if (!validActions.includes(body.action as ActionType)) return NextResponse.json({ error: "Unknown workflow action." }, { status: 400 });
        return NextResponse.json({ room: await submitAction(body.token, body.requestId, body.action as ActionType) });
      }
      case "admin": {
        if (!validAdminPin(body.pin)) return NextResponse.json({ error: "Presenter PIN is incorrect." }, { status: 403 });
        if (body.command !== "reset" && body.command !== "kick") return NextResponse.json({ error: "Unknown admin command." }, { status: 400 });
        return NextResponse.json({ room: await adminCommand(body.command as AdminCommand, typeof body.targetSessionId === "string" ? body.targetSessionId : undefined) });
      }
      case "admin-check": return validAdminPin(body.pin) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Presenter PIN is incorrect." }, { status: 403 });
      default: return NextResponse.json({ error: "Unknown request kind." }, { status: 400 });
    }
  } catch (error) { return errorResponse(error); }
}
