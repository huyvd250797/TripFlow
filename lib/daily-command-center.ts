import type { Bundle, Item } from "./types";
import { localTime } from "./domain";

export type DailyPhase = "pretrip" | "live" | "posttrip" | "cancelled";

export type DailyAttention = {
  code: "late" | "missing_place" | "over_budget" | "unfinished";
  label: string;
  detail: string;
  item_id?: string;
};

export type DailyCommandCenter = {
  phase: DailyPhase;
  today: string;
  day_number: number;
  trip_days: number;
  days_until_start: number;
  current: Item | null;
  next: Item | null;
  today_items: Item[];
  today_done: number;
  today_remaining: number;
  today_actual: number;
  today_budget: number;
  today_remaining_budget: number | null;
  late_count: number;
  attention: DailyAttention[];
};

function dayDistance(fromDay: string, toDay: string) {
  const from = Date.parse(`${fromDay}T00:00:00Z`);
  const to = Date.parse(`${toDay}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / 86400000);
}

function netAmount(rows: Bundle["expenses"]) {
  return rows.reduce(
    (sum, row) => sum + (row.kind === "refund" ? -1 : 1) * Number(row.amount || 0),
    0,
  );
}

export function buildDailyCommandCenter(
  bundle: Bundle,
  now = new Date().toISOString(),
): DailyCommandCenter {
  const { trip } = bundle;
  const today = localTime(now, trip.timezone).slice(0, 10);
  const tripEnd = trip.end_date || trip.start_date;
  const tripDays = Math.max(1, dayDistance(trip.start_date, tripEnd) + 1);
  const dayNumber = Math.min(
    tripDays,
    Math.max(1, dayDistance(trip.start_date, today) + 1),
  );
  const daysUntilStart = Math.max(0, dayDistance(today, trip.start_date));

  const phase: DailyPhase =
    trip.status === "cancelled"
      ? "cancelled"
      : trip.status === "completed"
        ? "posttrip"
        : trip.status === "traveling"
          ? "live"
          : "pretrip";

  const todayItems = bundle.items
    .filter((item) => localTime(item.start_at, trip.timezone).slice(0, 10) === today)
    .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));

  const nowMs = Date.parse(now);
  const current =
    todayItems.find((item) => item.status === "active") ||
    todayItems.find(
      (item) =>
        item.status === "planned" &&
        Date.parse(item.start_at) <= nowMs &&
        (!item.end_at || Date.parse(item.end_at) > nowMs),
    ) ||
    null;
  const next =
    todayItems.find(
      (item) => item.status === "planned" && Date.parse(item.start_at) > nowMs,
    ) || null;

  const lateItems = todayItems.filter(
    (item) =>
      item.status === "planned" &&
      !!item.end_at &&
      Date.parse(item.end_at) <= nowMs,
  );
  const todayDone = todayItems.filter((item) => item.status === "done").length;
  const todayRemaining = todayItems.filter(
    (item) => item.status === "planned" || item.status === "active",
  ).length;

  const todayIds = new Set(todayItems.map((item) => item.id));
  const todayBudget = bundle.budgets
    .filter((budget) => !!budget.item_id && todayIds.has(budget.item_id))
    .reduce((sum, budget) => sum + Number(budget.amount || 0), 0);
  const todayActual = netAmount(bundle.expenses.filter((expense) => expense.spent_on === today));
  const todayRemainingBudget = todayBudget > 0 ? todayBudget - todayActual : null;

  const attention: DailyAttention[] = [];
  for (const item of lateItems.slice(0, 2)) {
    attention.push({
      code: "late",
      label: "Hoạt động đã qua giờ",
      detail: item.title,
      item_id: item.id,
    });
  }

  const missingPlace = todayItems.find(
    (item) =>
      (item.status === "planned" || item.status === "active") &&
      !item.location.trim() &&
      !item.map_url.trim(),
  );
  if (missingPlace) {
    attention.push({
      code: "missing_place",
      label: "Chưa có địa điểm",
      detail: missingPlace.title,
      item_id: missingPlace.id,
    });
  }

  if (todayBudget > 0 && todayActual > todayBudget) {
    attention.push({
      code: "over_budget",
      label: "Chi hôm nay vượt kế hoạch",
      detail: `Vượt ${Math.round(todayActual - todayBudget).toLocaleString("vi-VN")} đ`,
    });
  }

  if (phase === "posttrip") {
    const unfinished = bundle.items.filter(
      (item) => item.status === "planned" || item.status === "active",
    ).length;
    if (unfinished) {
      attention.push({
        code: "unfinished",
        label: "Còn hoạt động chưa xử lý",
        detail: `${unfinished} hoạt động`,
      });
    }
  }

  return {
    phase,
    today,
    day_number: dayNumber,
    trip_days: tripDays,
    days_until_start: daysUntilStart,
    current,
    next,
    today_items: todayItems,
    today_done: todayDone,
    today_remaining: todayRemaining,
    today_actual: todayActual,
    today_budget: todayBudget,
    today_remaining_budget: todayRemainingBudget,
    late_count: lateItems.length,
    attention,
  };
}
