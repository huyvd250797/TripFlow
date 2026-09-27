export const VERSION = "0.1.0";
export const CATEGORIES = [
  "Di chuyển",
  "Lưu trú",
  "Ăn uống",
  "Tham quan",
  "Mua sắm",
  "Khác",
] as const;
export const ZONES = [
  "Asia/Ho_Chi_Minh",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Europe/Paris",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
];
export const TRIP_STATUS = {
  planning: "Đang lên kế hoạch",
  ready: "Sẵn sàng",
  traveling: "Đang trong chuyến đi",
  completed: "Đã kết thúc",
  cancelled: "Đã hủy",
};
export const ITEM_STATUS = {
  planned: "Chưa bắt đầu",
  active: "Đang ở đây",
  done: "Hoàn thành",
  skipped: "Bỏ qua",
};
export type Entity =
  | "trip"
  | "item"
  | "budget"
  | "expense"
  | "media"
  | "participant"
  | "invitation"
  | "member"
  | "snapshot";
export type Row = {
  id: string;
  version: number;
  created_at: string;
  updated_at: string;
};
export type Trip = Row & {
  owner_id: string;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  timezone: string;
  people: number;
  status: keyof typeof TRIP_STATUS;
  note: string;
};
export type Item = Row & {
  trip_id: string;
  title: string;
  location: string;
  start_at: string;
  end_at: string;
  status: keyof typeof ITEM_STATUS;
  map_url: string;
  note: string;
  checked_in_at: string | null;
  completed_at: string | null;
};
export type Budget = Row & {
  title: string;
  category: string;
  quantity: number;
  unit_price: number;
  amount: number;
  item_id: string | null;
  note: string;
};
export type Expense = Row & {
  title: string;
  category: string;
  amount: number;
  kind: "payment" | "refund";
  spent_on: string;
  budget_id: string | null;
  refund_of: string | null;
  payer: string;
  note: string;
  receipt_url: string;
};
export type Media = Row & {
  title: string;
  kind: "album" | "photo" | "video" | "document";
  url: string;
  item_id: string | null;
  note: string;
};
export type Participant = Row & { name: string; note: string };
export type Member = Row & {
  user_id: string;
  email: string;
  role: "editor" | "viewer";
};
export type Invitation = Row & {
  email: string;
  role: "editor" | "viewer";
  token: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
};
export type Snapshot = Row & { title: string; data: Budget[] };
export type Audit = {
  id: number;
  entity: string;
  action: string;
  created_at: string;
  actor_id: string;
  after_data: Record<string, unknown> | null;
};
export type Bundle = {
  trip: Trip;
  role: "owner" | "editor" | "viewer";
  items: Item[];
  budgets: Budget[];
  expenses: Expense[];
  media: Media[];
  participants: Participant[];
  members: Member[];
  invitations: Invitation[];
  snapshots: Snapshot[];
  audits: Audit[];
};
export type Mutation = {
  operationId: string;
  tripId: string;
  entity: Entity;
  action: "create" | "update" | "delete" | "status" | "accept";
  id?: string;
  version?: number;
  data?: Record<string, unknown>;
};
