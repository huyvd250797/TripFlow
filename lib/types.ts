export const VERSION = "1.1.0";
export const DATABASE_VERSION = "1.0.0";
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
export type Snapshot = {
  id: string;
  trip_id: string;
  title: string;
  data: Budget[];
  created_by: string;
  created_at: string;
  snapshot_no?: number;
  snapshot_kind?: "baseline" | "revision";
  total_amount?: number;
  item_count?: number;
};

export type ItineraryEvent = {
  id: number;
  trip_id: string;
  item_id: string;
  operation_id: string;
  actor_id: string | null;
  event_type: "check_in" | "complete" | "auto_complete" | "skip" | "reset" | "status";
  from_status: keyof typeof ITEM_STATUS | null;
  to_status: keyof typeof ITEM_STATUS;
  occurred_at: string;
  metadata: Record<string, unknown>;
};

export type FinanceCategoryReport = {
  category: string;
  original: number;
  current: number;
  payments: number;
  refunds: number;
  actual: number;
  variance: number;
};
export type FinanceDayReport = {
  day: string;
  payments: number;
  refunds: number;
  actual: number;
};
export type FinanceActivityReport = {
  item_id: string | null;
  title: string;
  current_budget: number;
  actual: number;
  variance: number;
};
export type FinanceIntegrityIssue = {
  code: string;
  count: number;
  message: string;
};
export type FinanceReport = {
  generated_at: string;
  baseline_snapshot_id: string | null;
  baseline_snapshot_no: number | null;
  totals: {
    original_budget: number;
    current_budget: number;
    gross_payments: number;
    refunds: number;
    net_actual: number;
    unlinked_actual: number;
    current_variance: number;
    original_variance: number | null;
  };
  categories: FinanceCategoryReport[];
  days: FinanceDayReport[];
  activities: FinanceActivityReport[];
  integrity: {
    status: "ok" | "warning";
    issue_count: number;
    issues: FinanceIntegrityIssue[];
  };
};

export type TripAnalyticsDay = {
  day: string;
  item_count: number;
  done: number;
  skipped: number;
  actual: number;
};

export type TripAnalyticsReport = {
  generated_at: string;
  report_state: "live" | "post_trip";
  readiness: "ready" | "needs_attention";
  trip_days: number;
  itinerary: {
    total: number;
    done: number;
    skipped: number;
    active: number;
    planned: number;
    processed: number;
    completion_rate: number;
    processed_rate: number;
    checked_in: number;
    late_checkins: number;
    average_checkin_delay_minutes: number;
    max_checkin_delay_minutes: number;
    planned_duration_minutes: number;
    actual_duration_minutes: number;
  };
  finance: {
    original_budget: number;
    current_budget: number;
    net_actual: number;
    current_variance: number;
    budget_usage_percent: number | null;
    per_person: number;
    unlinked_actual: number;
    expense_count: number;
    refund_count: number;
    top_category: string | null;
    top_category_actual: number;
    over_budget_categories: number;
  };
  media: {
    total: number;
    albums: number;
    photos: number;
    videos: number;
    documents: number;
    linked_to_activity: number;
  };
  days: TripAnalyticsDay[];
  highlights: string[];
  warnings: string[];
};


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
  live_events?: ItineraryEvent[];
  audits: Audit[];
  finance_report?: FinanceReport;
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

export type AccountState = {
  user_id: string;
  role: "master" | "user";
  status: "active" | "deactivated";
  deactivated_at: string | null;
};

export type TripListResponse = {
  trips: Trip[];
  user?: { id: string; email?: string | null };
  account: AccountState;
};

export type SyncState = "pending" | "sending" | "conflict" | "rejected";
export type QueuedMutation = {
  operationId: string;
  userId: string;
  tripId: string;
  mutation: Mutation;
  state: SyncState;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
};


export type RecoveryBackup = {
  id: string;
  source_trip_id: string | null;
  title: string;
  checksum: string;
  size_bytes: number;
  created_at: string;
  expires_at: string;
};
export type RecoveryTombstone = {
  entity: "item" | "budget" | "expense" | "media" | "participant";
  id: string;
  title: string;
  deleted_at: string;
  purge_after: string;
};
export type RecoveryDeletedTrip = {
  id: string;
  name: string;
  destination: string;
  deleted_at: string;
  purge_after: string;
};
export type RecoveryOverview = {
  policy: {
    recovery_days: number;
    backup_days: number;
    receipt_days: number;
    audit_days: number;
  };
  deleted_trips: RecoveryDeletedTrip[];
  backups: RecoveryBackup[];
  tombstones: RecoveryTombstone[];
  health: {
    last_backup_at: string | null;
    backup_count: number;
    tombstone_count: number;
    eligible_for_purge: number;
    audit_count: number;
    receipt_count: number;
    note: string;
  };
};

export type RecoveryBackupPackage = RecoveryBackup & {
  format_version: number;
  payload: Record<string, unknown>;
};
