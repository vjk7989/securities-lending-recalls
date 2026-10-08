export const roles = ["portfolio", "lending", "broker_a", "broker_b", "custodian"] as const;
export type Role = (typeof roles)[number];
export type ActionType =
  | "place_sale"
  | "issue_recall"
  | "return_150k"
  | "return_100k"
  | "confirm_delivery"
  | "release_collateral"
  | "settle_sale";
export type AdminCommand = "reset" | "kick";

export type RoomEvent = {
  id: string;
  seq: number;
  run: number;
  action: ActionType;
  actorRole: Role;
  createdAt: string;
  description: string;
};

export type SessionView = {
  id: string;
  role: Role | null;
  connected: boolean;
  kicked: boolean;
  lastSeenAt: string;
};

export type RoomView = {
  id: string;
  run: number;
  version: number;
  phase: string;
  events: RoomEvent[];
  sessions: SessionView[];
  connectedCount: number;
  waitingCount: number;
  availableActions: Record<Role, ActionType[]>;
  scenario: {
    saleShares: 400000;
    onLoanShares: 250000;
    brokerAReturnShares: 150000;
    brokerBReturnShares: 100000;
    sellOrderTime: "3:40 pm";
    settlement: "T+1";
  };
};

export const scenario = {
  saleShares: 400000,
  onLoanShares: 250000,
  brokerAReturnShares: 150000,
  brokerBReturnShares: 100000,
  sellOrderTime: "3:40 pm",
  settlement: "T+1",
} as const;
