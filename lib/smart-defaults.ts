import { CATEGORIES, type Bundle, type Budget, type Expense, type Item } from "./types";
import { localTime, utcTime } from "./domain";

export type SmartDefaults = {
  expense: {
    category: (typeof CATEGORIES)[number];
    payer: string;
    budget_id: string;
    spent_on: string;
    source: string[];
  };
  item: {
    start_at: string;
    location: string;
    source: string[];
  };
  media: {
    item_id: string;
    taken_on: string;
  };
  focusItem: Item | null;
  focusBudget: Budget | null;
};

const byRecent = <T extends { updated_at?: string; created_at?: string }>(rows: T[]) =>
  [...rows].sort((a, b) =>
    String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")),
  );

const addMinutesLocal = (value: string, minutes: number) => {
  const ms = Date.parse(value + "Z");
  if (!Number.isFinite(ms)) return value;
  return new Date(ms + minutes * 60_000).toISOString().slice(0, 16);
};

function pickFocusItem(bundle: Bundle, nowIso: string) {
  const zone = bundle.trip.timezone;
  const nowLocal = localTime(nowIso, zone);
  const rows = [...bundle.items].sort((a, b) => a.start_at.localeCompare(b.start_at));
  const active = rows.find((x) => x.status === "active");
  if (active) return active;
  const planned = rows.filter((x) => x.status === "planned");
  const next = planned.find((x) => localTime(x.start_at, zone) >= nowLocal);
  if (next) return next;
  return planned.at(-1) || rows.at(-1) || null;
}

function recentPayer(expenses: Expense[]) {
  return byRecent(expenses.filter((x) => x.kind === "payment" && x.payer?.trim()))[0]?.payer?.trim() || "";
}

function recentCategory(expenses: Expense[]): (typeof CATEGORIES)[number] {
  const value = byRecent(expenses.filter((x) => x.kind === "payment"))[0]?.category;
  return (CATEGORIES as readonly string[]).includes(value || "")
    ? (value as (typeof CATEGORIES)[number])
    : CATEGORIES[0];
}

function recentLocation(items: Item[]) {
  return byRecent(items.filter((x) => x.location?.trim()))[0]?.location?.trim() || "";
}

export function buildSmartDefaults(bundle: Bundle, nowIso = new Date().toISOString()): SmartDefaults {
  const zone = bundle.trip.timezone;
  const nowLocal = localTime(nowIso, zone);
  const today = nowLocal.slice(0, 10);
  const focusItem = pickFocusItem(bundle, nowIso);
  const lastCategory = recentCategory(bundle.expenses);
  const focusBudgets = focusItem ? bundle.budgets.filter((x) => x.item_id === focusItem.id) : [];
  const focusBudget =
    focusBudgets.find((x) => x.category === lastCategory) || focusBudgets[0] || null;
  const category = (focusBudget?.category || lastCategory || CATEGORIES[0]) as (typeof CATEGORIES)[number];
  const payer = recentPayer(bundle.expenses);

  const sortedItems = [...bundle.items].sort((a, b) => a.start_at.localeCompare(b.start_at));
  const lastItem = sortedItems.at(-1);
  let nextStartLocal = nowLocal;
  if (lastItem) {
    const lastEndLocal = localTime(lastItem.end_at || lastItem.start_at, zone);
    nextStartLocal = addMinutesLocal(lastEndLocal, lastItem.end_at ? 30 : 60);
  }
  if (nextStartLocal < nowLocal) nextStartLocal = addMinutesLocal(nowLocal, 30);

  const expenseSource: string[] = [];
  if (focusBudget) expenseSource.push(`Dự toán theo chặng: ${focusBudget.title}`);
  else if (bundle.expenses.length) expenseSource.push(`Nhóm gần nhất: ${category}`);
  if (payer) expenseSource.push(`Người trả gần nhất: ${payer}`);

  const itemSource: string[] = [];
  if (lastItem) itemSource.push(`Xếp sau hoạt động gần nhất: ${lastItem.title}`);
  const location = focusItem?.location?.trim() || recentLocation(bundle.items);
  if (location) itemSource.push(`Địa điểm theo ngữ cảnh: ${location}`);

  return {
    expense: {
      category,
      payer,
      budget_id: focusBudget?.id || "",
      spent_on: today,
      source: expenseSource,
    },
    item: {
      start_at: utcTime(nextStartLocal, zone),
      location,
      source: itemSource,
    },
    media: {
      item_id: focusItem?.id || "",
      taken_on: focusItem ? localTime(focusItem.start_at, zone).slice(0, 10) : today,
    },
    focusItem,
    focusBudget,
  };
}

function netForBudget(bundle: Bundle, budgetId: string) {
  const payments = bundle.expenses.filter((x) => x.kind === "payment" && x.budget_id === budgetId);
  const ids = new Set(payments.map((x) => x.id));
  const paymentTotal = payments.reduce((sum, x) => sum + Number(x.amount), 0);
  const refunds = bundle.expenses
    .filter((x) => x.kind === "refund" && !!x.refund_of && ids.has(x.refund_of))
    .reduce((sum, x) => sum + Number(x.amount), 0);
  return paymentTotal - refunds;
}

const median = (values: number[]) => {
  const rows = [...values].sort((a, b) => a - b);
  if (!rows.length) return 0;
  const mid = Math.floor(rows.length / 2);
  return rows.length % 2 ? rows[mid] : (rows[mid - 1] + rows[mid]) / 2;
};

export function expenseContextWarnings(
  bundle: Bundle,
  input: { amount: number; category: string; budget_id?: string | null },
) {
  const warnings: string[] = [];
  if (input.budget_id) {
    const budget = bundle.budgets.find((x) => x.id === input.budget_id);
    if (budget) {
      const remaining = Number(budget.amount) - netForBudget(bundle, budget.id);
      if (input.amount > Math.max(0, remaining))
        warnings.push(`Khoản này vượt phần còn lại của dự toán “${budget.title}”.`);
    }
  }
  const peers = bundle.expenses
    .filter((x) => x.kind === "payment" && x.category === input.category)
    .map((x) => Number(x.amount))
    .filter((x) => x > 0);
  const typical = median(peers);
  if (peers.length >= 3 && typical > 0 && input.amount >= typical * 2.5)
    warnings.push("Số tiền cao hơn đáng kể so với các khoản cùng nhóm trước đó.");
  return warnings;
}

export function itemContextWarnings(
  bundle: Bundle,
  input: { start_local: string; duration_minutes?: number },
) {
  const warnings: string[] = [];
  const day = input.start_local.slice(0, 10);
  if (day < bundle.trip.start_date || (bundle.trip.end_date && day > bundle.trip.end_date))
    warnings.push("Thời gian hoạt động nằm ngoài phạm vi ngày của chuyến đi.");

  const start = Date.parse(input.start_local + "Z");
  const end = start + (input.duration_minutes || 60) * 60_000;
  if (Number.isFinite(start)) {
    const overlaps = bundle.items.filter((row) => {
      const localStart = localTime(row.start_at, bundle.trip.timezone);
      const localEnd = row.end_at ? localTime(row.end_at, bundle.trip.timezone) : addMinutesLocal(localStart, 60);
      const a = Date.parse(localStart + "Z");
      const b = Date.parse(localEnd + "Z");
      return Number.isFinite(a) && Number.isFinite(b) && start < b && end > a;
    });
    if (overlaps.length) warnings.push(`Trùng giờ với “${overlaps[0].title}”${overlaps.length > 1 ? ` và ${overlaps.length - 1} hoạt động khác` : ""}.`);
  }
  return warnings;
}
