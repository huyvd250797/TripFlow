import { CATEGORIES, type Bundle, type Expense } from "./types";
import { buildFinanceReport, localTime } from "./domain";

export type ExpenseCategory = (typeof CATEGORIES)[number];

export type WalletPayer = {
  payer: string;
  net_paid: number;
  share_percent: number;
  transaction_count: number;
};

export type TravelWallet = {
  current_budget: number;
  net_actual: number;
  remaining: number;
  per_person: number;
  safe_daily_remaining: number | null;
  trip_progress_percent: number;
  spending_percent: number | null;
  days_total: number;
  days_elapsed: number;
  days_remaining: number;
  pace: "before" | "healthy" | "watch" | "over" | "complete" | "no_budget";
  pace_message: string;
  payers: WalletPayer[];
};

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

const dayNumber = (day: string) => {
  const [year, month, date] = day.slice(0, 10).split("-").map(Number);
  if (!year || !month || !date) return Number.NaN;
  return Date.UTC(year, month - 1, date) / 86_400_000;
};

const inclusiveDays = (start: string, end: string) => {
  const a = dayNumber(start);
  const b = dayNumber(end);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  return Math.max(1, Math.floor(b - a) + 1);
};

function keywordCategory(title: string): ExpenseCategory {
  const t = ` ${fold(title)} `;
  if (/\b(an|com|pho|bun|banh|cafe|coffee|buffet|nuoc)\b|tra sua|nha hang|hai san|do uong/.test(t)) return "Ăn uống";
  if (/\b(taxi|grab|xe|xang|bus|tau|flight|parking)\b|may bay|ve xe|di chuyen|san bay|thue xe|gui xe/.test(t)) return "Di chuyển";
  if (/\b(hotel|homestay|resort|phong)\b|khach san|luu tru/.test(t)) return "Lưu trú";
  if (/tham quan|ve vao|bao tang|khu vui choi|\btour\b|vinwonder|\bzoo\b|cong vien/.test(t)) return "Tham quan";
  if (/\b(mua|shopping|qua|souvenir)\b|dac san/.test(t)) return "Mua sắm";
  return "Khác";
}

/**
 * Gợi ý nhóm chi từ lịch sử cùng nội dung trước, sau đó mới dùng từ khóa.
 * Chỉ là suggestion ở client; người dùng luôn có thể đổi trước khi lưu.
 */
export function inferExpenseCategory(title: string, history: Expense[] = []): ExpenseCategory {
  const key = fold(title);
  if (!key) return "Khác";
  const exact = [...history]
    .filter((row) => row.kind === "payment" && fold(row.title) === key)
    .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")))[0];
  if (exact && (CATEGORIES as readonly string[]).includes(exact.category)) return exact.category as ExpenseCategory;
  return keywordCategory(title);
}

function expensePayer(expense: Expense, byId: Map<string, Expense>) {
  if (expense.payer?.trim()) return expense.payer.trim();
  if (expense.kind === "refund" && expense.refund_of) return byId.get(expense.refund_of)?.payer?.trim() || "Chưa ghi người trả";
  return "Chưa ghi người trả";
}

export function buildTravelWallet(bundle: Bundle, nowIso = new Date().toISOString()): TravelWallet {
  const finance = bundle.finance_report || buildFinanceReport(bundle);
  const currentBudget = Number(finance.totals.current_budget || 0);
  const actual = Number(finance.totals.net_actual || 0);
  const remaining = currentBudget - actual;
  const today = localTime(nowIso, bundle.trip.timezone).slice(0, 10);
  const start = bundle.trip.start_date;
  const inferredEnd = bundle.trip.end_date || bundle.items
    .map((row) => localTime(row.start_at, bundle.trip.timezone).slice(0, 10))
    .sort()
    .at(-1) || start;
  const end = inferredEnd < start ? start : inferredEnd;
  const daysTotal = inclusiveDays(start, end);
  const startNo = dayNumber(start);
  const endNo = dayNumber(end);
  const todayNo = dayNumber(today);

  let daysElapsed = 0;
  let daysRemaining = daysTotal;
  if (Number.isFinite(todayNo) && Number.isFinite(startNo) && Number.isFinite(endNo)) {
    if (todayNo < startNo) {
      daysElapsed = 0;
      daysRemaining = daysTotal;
    } else if (todayNo > endNo) {
      daysElapsed = daysTotal;
      daysRemaining = 0;
    } else {
      daysElapsed = Math.min(daysTotal, Math.max(1, Math.floor(todayNo - startNo) + 1));
      daysRemaining = Math.max(1, Math.floor(endNo - todayNo) + 1);
    }
  }

  const progress = Math.round((daysElapsed / daysTotal) * 1000) / 10;
  const spending = currentBudget > 0 ? Math.round((actual / currentBudget) * 1000) / 10 : null;
  let pace: TravelWallet["pace"] = "healthy";
  let paceMessage = "Tốc độ chi đang phù hợp với tiến độ chuyến đi.";

  if (currentBudget <= 0) {
    pace = actual > 0 ? "no_budget" : today < start ? "before" : today > end ? "complete" : "healthy";
    paceMessage = actual > 0
      ? "Đã phát sinh chi tiêu nhưng chưa có dự toán hiện tại để so sánh tốc độ chi."
      : "Chưa có dữ liệu chi tiêu để đánh giá tốc độ sử dụng ngân sách.";
  } else if (actual > currentBudget) {
    pace = "over";
    paceMessage = `Đã vượt dự toán ${Math.max(0, Math.round(((actual - currentBudget) / currentBudget) * 100))}%.`;
  } else if (today < start) {
    pace = "before";
    paceMessage = actual > 0
      ? `Trước ngày khởi hành đã sử dụng ${spending ?? 0}% dự toán.`
      : "Chuyến đi chưa bắt đầu; ngân sách hiện chưa phát sinh thực chi.";
  } else if (today > end || bundle.trip.status === "completed") {
    pace = "complete";
    paceMessage = `Chuyến đi đã kết thúc với ${spending ?? 0}% dự toán được sử dụng.`;
  } else if ((spending ?? 0) > progress + 15) {
    pace = "watch";
    paceMessage = `Đã dùng ${spending}% dự toán trong khi chuyến đi mới đi qua ${progress}% thời gian.`;
  }

  const byId = new Map(bundle.expenses.map((row) => [row.id, row]));
  const payerMap = new Map<string, { amount: number; count: number }>();
  for (const expense of bundle.expenses) {
    const payer = expensePayer(expense, byId);
    const current = payerMap.get(payer) || { amount: 0, count: 0 };
    current.amount += (expense.kind === "refund" ? -1 : 1) * Number(expense.amount || 0);
    current.count += 1;
    payerMap.set(payer, current);
  }
  const denominator = Math.max(0, actual);
  const payers = [...payerMap.entries()]
    .map(([payer, row]) => ({
      payer,
      net_paid: row.amount,
      transaction_count: row.count,
      share_percent: denominator > 0 ? Math.round((row.amount / denominator) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.net_paid - a.net_paid || a.payer.localeCompare(b.payer, "vi"));

  return {
    current_budget: currentBudget,
    net_actual: actual,
    remaining,
    per_person: actual / Math.max(1, Number(bundle.trip.people || 1)),
    safe_daily_remaining: daysRemaining > 0 ? Math.max(0, remaining) / daysRemaining : null,
    trip_progress_percent: progress,
    spending_percent: spending,
    days_total: daysTotal,
    days_elapsed: daysElapsed,
    days_remaining: daysRemaining,
    pace,
    pace_message: paceMessage,
    payers,
  };
}
