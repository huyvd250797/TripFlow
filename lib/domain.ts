import {
  CATEGORIES,
  type Bundle,
  type Budget,
  type Expense,
  type Item,
  type FinanceReport,
} from "./types";
export const money = (n: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
export const dateLabel = (d: string) => {
  const s = d.slice(0, 10).split("-");
  return s.length === 3 ? `${s[2]}/${s[1]}/${s[0]}` : d;
};
export function parseDate(s: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) throw Error("Nhập ngày theo DD/MM/YYYY.");
  const v = `${m[3]}-${m[2]}-${m[1]}`;
  if (
    Number.isNaN(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    throw Error("Ngày không hợp lệ.");
  return v;
}
export function localTime(iso: string, zone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function utcTime(s: string, zone: string) {
  const base = Date.parse(s + "Z");
  if (!Number.isFinite(base)) throw Error("Ngày giờ không hợp lệ.");
  let t = base;
  for (let i = 0; i < 5; i++) {
    const d =
      base - Date.parse(localTime(new Date(t).toISOString(), zone) + "Z");
    if (!d) break;
    t += d;
  }
  const result = new Date(t).toISOString();
  if (localTime(result, zone) !== s)
    throw Error("Giờ này không tồn tại trong múi giờ đã chọn.");
  return result;
}
export const net = (xs: Expense[]) =>
  xs.reduce((s, x) => s + (x.kind === "refund" ? -1 : 1) * Number(x.amount), 0);
export const planned = (xs: Budget[]) =>
  xs.reduce((s, x) => s + Number(x.amount), 0);
export function compare(budgets: Budget[], expenses: Expense[]) {
  const plan = planned(budgets),
    actual = net(expenses);
  return {
    plan,
    actual,
    remaining: plan - actual,
    unlinked: net(expenses.filter((x) => !x.budget_id)),
    categories: CATEGORIES.map((category) => ({
      category,
      plan: planned(budgets.filter((x) => x.category === category)),
      actual: net(expenses.filter((x) => x.category === category)),
    })),
  };
}

export function buildFinanceReport(bundle: Bundle): FinanceReport {
  const snapshots = [...bundle.snapshots].sort((a, b) => {
    const an = a.snapshot_no ?? Number.MAX_SAFE_INTEGER;
    const bn = b.snapshot_no ?? Number.MAX_SAFE_INTEGER;
    return an - bn || a.created_at.localeCompare(b.created_at);
  });
  const baseline = snapshots[0];
  const originalBudgets = baseline?.data || [];
  const currentBudget = planned(bundle.budgets);
  const originalBudget = planned(originalBudgets);
  const grossPayments = bundle.expenses
    .filter((x) => x.kind === "payment")
    .reduce((sum, x) => sum + Number(x.amount), 0);
  const refunds = bundle.expenses
    .filter((x) => x.kind === "refund")
    .reduce((sum, x) => sum + Number(x.amount), 0);
  const actual = grossPayments - refunds;
  const categories = CATEGORIES.map((category) => {
    const original = planned(originalBudgets.filter((x) => x.category === category));
    const current = planned(bundle.budgets.filter((x) => x.category === category));
    const payments = bundle.expenses
      .filter((x) => x.category === category && x.kind === "payment")
      .reduce((sum, x) => sum + Number(x.amount), 0);
    const categoryRefunds = bundle.expenses
      .filter((x) => x.category === category && x.kind === "refund")
      .reduce((sum, x) => sum + Number(x.amount), 0);
    const categoryActual = payments - categoryRefunds;
    return {
      category,
      original,
      current,
      payments,
      refunds: categoryRefunds,
      actual: categoryActual,
      variance: current - categoryActual,
    };
  });
  const byDay = new Map<string, { payments: number; refunds: number }>();
  for (const expense of bundle.expenses) {
    const row = byDay.get(expense.spent_on) || { payments: 0, refunds: 0 };
    if (expense.kind === "refund") row.refunds += Number(expense.amount);
    else row.payments += Number(expense.amount);
    byDay.set(expense.spent_on, row);
  }
  const days = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, value]) => ({
      day,
      payments: value.payments,
      refunds: value.refunds,
      actual: value.payments - value.refunds,
    }));
  const currentBudgetMap = new Map(bundle.budgets.map((x) => [x.id, x]));
  const activities: FinanceReport["activities"] = bundle.items.map((item) => {
    const current = planned(bundle.budgets.filter((x) => x.item_id === item.id));
    const itemBudgetIds = new Set(
      bundle.budgets.filter((x) => x.item_id === item.id).map((x) => x.id),
    );
    const itemActual = net(
      bundle.expenses.filter((x) => x.budget_id && itemBudgetIds.has(x.budget_id)),
    );
    return {
      item_id: item.id,
      title: item.title,
      current_budget: current,
      actual: itemActual,
      variance: current - itemActual,
    };
  });
  const unassignedBudget = planned(bundle.budgets.filter((x) => !x.item_id));
  const unassignedActual = net(
    bundle.expenses.filter((x) => {
      if (!x.budget_id) return true;
      const budget = currentBudgetMap.get(x.budget_id);
      return !budget || !budget.item_id;
    }),
  );
  activities.push({
    item_id: null,
    title: "Ngoài hoạt động / chưa phân bổ",
    current_budget: unassignedBudget,
    actual: unassignedActual,
    variance: unassignedBudget - unassignedActual,
  });

  const issues: FinanceReport["integrity"]["issues"] = [];
  if (!baseline) {
    issues.push({
      code: "NO_BASELINE",
      count: 1,
      message: "Chưa chốt dự toán gốc để làm mốc đối chiếu.",
    });
  }
  const paymentsById = new Map(
    bundle.expenses.filter((x) => x.kind === "payment").map((x) => [x.id, x]),
  );
  const refundTotals = new Map<string, number>();
  let refundMismatch = 0;
  for (const refund of bundle.expenses.filter((x) => x.kind === "refund")) {
    const original = refund.refund_of ? paymentsById.get(refund.refund_of) : undefined;
    if (!original) {
      refundMismatch += 1;
      continue;
    }
    refundTotals.set(original.id, (refundTotals.get(original.id) || 0) + Number(refund.amount));
    if (refund.category !== original.category || refund.budget_id !== original.budget_id)
      refundMismatch += 1;
  }
  const refundExceeded = [...refundTotals.entries()].filter(([id, amount]) => {
    const original = paymentsById.get(id);
    return !!original && amount > Number(original.amount);
  }).length;
  if (refundExceeded)
    issues.push({
      code: "REFUND_EXCEEDED",
      count: refundExceeded,
      message: "Có khoản hoàn tiền vượt số tiền của giao dịch gốc.",
    });
  if (refundMismatch)
    issues.push({
      code: "REFUND_MISMATCH",
      count: refundMismatch,
      message: "Có giao dịch hoàn tiền không còn khớp giao dịch gốc.",
    });
  const budgetMismatch = bundle.expenses.filter((expense) => {
    if (!expense.budget_id) return false;
    const budget = currentBudgetMap.get(expense.budget_id);
    return !budget || budget.category !== expense.category;
  }).length;
  if (budgetMismatch)
    issues.push({
      code: "BUDGET_LINK_MISMATCH",
      count: budgetMismatch,
      message: "Có thực chi liên kết dự toán không còn hợp lệ hoặc sai nhóm.",
    });

  return {
    generated_at: new Date().toISOString(),
    baseline_snapshot_id: baseline?.id || null,
    baseline_snapshot_no: baseline?.snapshot_no || (baseline ? 1 : null),
    totals: {
      original_budget: originalBudget,
      current_budget: currentBudget,
      gross_payments: grossPayments,
      refunds,
      net_actual: actual,
      unlinked_actual: net(bundle.expenses.filter((x) => !x.budget_id)),
      current_variance: currentBudget - actual,
      original_variance: baseline ? originalBudget - actual : null,
    },
    categories,
    days,
    activities,
    integrity: {
      status: issues.length ? "warning" : "ok",
      issue_count: issues.length,
      issues,
    },
  };
}

export function financeJson(bundle: Bundle) {
  const report = bundle.finance_report || buildFinanceReport(bundle);
  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      trip: {
        id: bundle.trip.id,
        name: bundle.trip.name,
        destination: bundle.trip.destination,
        start_date: bundle.trip.start_date,
        end_date: bundle.trip.end_date,
        timezone: bundle.trip.timezone,
      },
      finance_report: report,
      budget_snapshots: bundle.snapshots,
      budgets: bundle.budgets,
      expenses: bundle.expenses,
    },
    null,
    2,
  );
}

export function live(items: Item[], now = new Date().toISOString()) {
  const sorted = [...items].sort(
    (a, b) => Date.parse(a.start_at) - Date.parse(b.start_at),
  );
  const nowMs = Date.parse(now);
  const active = sorted.find((x) => x.status === "active");
  const scheduled = sorted.filter(
    (x) =>
      x.status === "planned" &&
      Date.parse(x.start_at) <= nowMs &&
      Date.parse(x.end_at) > nowMs,
  );
  const late = sorted.filter(
    (x) => x.status === "planned" && Date.parse(x.end_at) <= nowMs,
  );
  const next = sorted.find(
    (x) => x.status === "planned" && Date.parse(x.start_at) > nowMs,
  );
  const current = active || scheduled[0];
  const activeLateMinutes = active
    ? Math.max(0, Math.floor((nowMs - Date.parse(active.end_at)) / 60000))
    : 0;
  const lateMinutes = late.map((x) => ({
    item: x,
    minutes: Math.max(0, Math.floor((nowMs - Date.parse(x.end_at)) / 60000)),
  }));
  const nextInMinutes = next
    ? Math.max(0, Math.ceil((Date.parse(next.start_at) - nowMs) / 60000))
    : null;
  return {
    active,
    current,
    scheduled,
    next,
    late,
    lateMinutes,
    activeLateMinutes,
    nextInMinutes,
    done: sorted.filter((x) => x.status === "done").length,
    skipped: sorted.filter((x) => x.status === "skipped").length,
    processed: sorted.filter((x) => ["done", "skipped"].includes(x.status))
      .length,
    sorted,
  };
}
export function csv(bundle: Bundle) {
  const report = bundle.finance_report || buildFinanceReport(bundle);
  const rows: unknown[][] = [
    ["TripFlow", bundle.trip.name],
    ["BÁO CÁO TÀI CHÍNH", "V0.4.0"],
    ["Chỉ số", "Số tiền"],
    ["Dự toán gốc", report.baseline_snapshot_id ? report.totals.original_budget : "Chưa chốt"],
    ["Dự toán hiện tại", report.totals.current_budget],
    ["Tổng chi trước hoàn", report.totals.gross_payments],
    ["Hoàn tiền", report.totals.refunds],
    ["Thực chi ròng", report.totals.net_actual],
    ["Ngoài dự toán", report.totals.unlinked_actual],
    ["Chênh lệch hiện tại", report.totals.current_variance],
    [],
    ["THEO NHÓM"],
    ["Nhóm", "Dự toán gốc", "Dự toán hiện tại", "Chi", "Hoàn", "Thực chi ròng", "Chênh lệch"],
    ...report.categories.map((x) => [
      x.category,
      x.original,
      x.current,
      x.payments,
      x.refunds,
      x.actual,
      x.variance,
    ]),
    [],
    ["THEO NGÀY"],
    ["Ngày", "Chi", "Hoàn", "Thực chi ròng"],
    ...report.days.map((x) => [dateLabel(x.day), x.payments, x.refunds, x.actual]),
    [],
    ["THEO HOẠT ĐỘNG"],
    ["Hoạt động", "Dự toán hiện tại", "Thực chi ròng", "Chênh lệch"],
    ...report.activities.map((x) => [x.title, x.current_budget, x.actual, x.variance]),
    [],
    ["DỰ TOÁN HIỆN TẠI"],
    ["Nội dung", "Nhóm", "Số lượng", "Đơn giá", "Thành tiền"],
    ...bundle.budgets.map((x) => [
      x.title,
      x.category,
      x.quantity,
      x.unit_price,
      x.amount,
    ]),
    [],
    ["THỰC CHI"],
    ["Ngày", "Nội dung", "Loại", "Nhóm", "Số tiền", "Người trả", "Khoản dự toán"],
    ...bundle.expenses.map((x) => [
      dateLabel(x.spent_on),
      x.title,
      x.kind === "refund" ? "Hoàn tiền" : "Chi",
      x.category,
      x.amount,
      x.payer,
      bundle.budgets.find((b) => b.id === x.budget_id)?.title || "Ngoài dự toán",
    ]),
  ];
  return (
    "\ufeff" +
    rows
      .map((r) =>
        r
          .map((x) => {
            let value = String(x ?? "");
            if (typeof x === "string" && /^[=+@\-\t\r]/.test(value)) value = "'" + value;
            return '"' + value.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n")
  );
}

