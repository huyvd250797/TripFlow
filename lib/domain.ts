import {
  CATEGORIES,
  ITEM_STATUS,
  VERSION,
  type Bundle,
  type Budget,
  type Expense,
  type Item,
  type FinanceReport,
  type TripAnalyticsReport,
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

export function buildTripAnalytics(bundle: Bundle): TripAnalyticsReport {
  const finance = bundle.finance_report || buildFinanceReport(bundle);
  const total = bundle.items.length;
  const done = bundle.items.filter((x) => x.status === "done").length;
  const skipped = bundle.items.filter((x) => x.status === "skipped").length;
  const active = bundle.items.filter((x) => x.status === "active").length;
  const plannedCount = bundle.items.filter((x) => x.status === "planned").length;
  const processed = done + skipped;
  const checked = bundle.items.filter((x) => !!x.checked_in_at);
  const delays = checked.map((x) =>
    Math.max(0, Math.round((Date.parse(x.checked_in_at!) - Date.parse(x.start_at)) / 60000)),
  );
  const actualDurations = bundle.items
    .filter((x) => x.checked_in_at && x.completed_at)
    .map((x) =>
      Math.max(
        0,
        Math.round((Date.parse(x.completed_at!) - Date.parse(x.checked_in_at!)) / 60000),
      ),
    );
  const plannedDuration = bundle.items.reduce(
    (sum, x) =>
      sum + Math.max(0, Math.round((Date.parse(x.end_at) - Date.parse(x.start_at)) / 60000)),
    0,
  );
  const actualDuration = actualDurations.reduce((sum, value) => sum + value, 0);
  const start = Date.parse(bundle.trip.start_date + "T00:00:00Z");
  const end = Date.parse(bundle.trip.end_date + "T00:00:00Z");
  const tripDays = Number.isFinite(start) && Number.isFinite(end)
    ? Math.max(1, Math.floor((end - start) / 86400000) + 1)
    : 1;
  const categoryRows = [...finance.categories].sort(
    (a, b) => Number(b.actual) - Number(a.actual),
  );
  const topCategory = categoryRows.find((x) => Number(x.actual) > 0) || null;
  const overBudgetCategories = finance.categories.filter(
    (x) => Number(x.actual) > Number(x.current),
  ).length;
  const dayMap = new Map<
    string,
    { item_count: number; done: number; skipped: number; actual: number }
  >();
  for (const item of bundle.items) {
    const day = localTime(item.start_at, bundle.trip.timezone).slice(0, 10);
    const row = dayMap.get(day) || { item_count: 0, done: 0, skipped: 0, actual: 0 };
    row.item_count += 1;
    if (item.status === "done") row.done += 1;
    if (item.status === "skipped") row.skipped += 1;
    dayMap.set(day, row);
  }
  for (const row of finance.days) {
    const value = dayMap.get(row.day) || { item_count: 0, done: 0, skipped: 0, actual: 0 };
    value.actual = Number(row.actual);
    dayMap.set(row.day, value);
  }
  const days = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, value]) => ({ day, ...value }));

  const completionRate = total ? Math.round((done / total) * 100) : 0;
  const processedRate = total ? Math.round((processed / total) * 100) : 0;
  const budgetUsage = finance.totals.current_budget
    ? Math.round((finance.totals.net_actual / finance.totals.current_budget) * 1000) / 10
    : null;
  const people = Math.max(1, Number(bundle.trip.people) || 1);
  const warnings: string[] = [];
  if (bundle.trip.status !== "completed")
    warnings.push("Chuyến đi chưa được chuyển sang trạng thái Đã kết thúc.");
  if (active || plannedCount)
    warnings.push(`Còn ${active + plannedCount} hoạt động chưa được xử lý hoàn tất.`);
  if (!finance.baseline_snapshot_id)
    warnings.push("Chưa có dự toán gốc để đối chiếu sau chuyến đi.");
  if (finance.integrity.status !== "ok")
    warnings.push(`Tài chính còn ${finance.integrity.issue_count} nhóm cảnh báo integrity cần rà soát.`);
  if (finance.totals.unlinked_actual > 0)
    warnings.push(`Có ${money(finance.totals.unlinked_actual)} thực chi chưa liên kết dự toán.`);

  const highlights: string[] = [];
  highlights.push(
    total
      ? `Hoàn thành ${done}/${total} hoạt động (${completionRate}%).`
      : "Chuyến đi chưa có hoạt động lịch trình.",
  );
  if (finance.totals.current_budget > 0) {
    highlights.push(
      finance.totals.current_variance >= 0
        ? `Thực chi thấp hơn dự toán hiện tại ${money(finance.totals.current_variance)}.`
        : `Thực chi vượt dự toán hiện tại ${money(Math.abs(finance.totals.current_variance))}.`,
    );
  } else if (finance.totals.net_actual > 0) {
    highlights.push(`Đã phát sinh ${money(finance.totals.net_actual)} nhưng chưa có dự toán hiện tại.`);
  }
  if (topCategory)
    highlights.push(`Nhóm chi nhiều nhất: ${topCategory.category} · ${money(Number(topCategory.actual))}.`);
  if (bundle.media.length)
    highlights.push(`Đã lưu ${bundle.media.length} liên kết media/tài liệu cho chuyến đi.`);

  return {
    generated_at: new Date().toISOString(),
    report_state: bundle.trip.status === "completed" ? "post_trip" : "live",
    readiness: warnings.length ? "needs_attention" : "ready",
    trip_days: tripDays,
    itinerary: {
      total,
      done,
      skipped,
      active,
      planned: plannedCount,
      processed,
      completion_rate: completionRate,
      processed_rate: processedRate,
      checked_in: checked.length,
      late_checkins: delays.filter((x) => x > 0).length,
      average_checkin_delay_minutes: delays.length
        ? Math.round(delays.reduce((sum, value) => sum + value, 0) / delays.length)
        : 0,
      max_checkin_delay_minutes: delays.length ? Math.max(...delays) : 0,
      planned_duration_minutes: plannedDuration,
      actual_duration_minutes: actualDuration,
    },
    finance: {
      original_budget: finance.totals.original_budget,
      current_budget: finance.totals.current_budget,
      net_actual: finance.totals.net_actual,
      current_variance: finance.totals.current_variance,
      budget_usage_percent: budgetUsage,
      per_person: finance.totals.net_actual / people,
      unlinked_actual: finance.totals.unlinked_actual,
      expense_count: bundle.expenses.filter((x) => x.kind === "payment").length,
      refund_count: bundle.expenses.filter((x) => x.kind === "refund").length,
      top_category: topCategory?.category || null,
      top_category_actual: Number(topCategory?.actual || 0),
      over_budget_categories: overBudgetCategories,
    },
    media: {
      total: bundle.media.length,
      albums: bundle.media.filter((x) => x.kind === "album").length,
      photos: bundle.media.filter((x) => x.kind === "photo").length,
      videos: bundle.media.filter((x) => x.kind === "video").length,
      documents: bundle.media.filter((x) => x.kind === "document").length,
      linked_to_activity: bundle.media.filter((x) => !!x.item_id).length,
    },
    days,
    highlights,
    warnings,
  };
}

function safeCsvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function postTripCsv(bundle: Bundle) {
  const analytics = buildTripAnalytics(bundle);
  const finance = bundle.finance_report || buildFinanceReport(bundle);
  const rows: unknown[][] = [
    ["TripFlow", bundle.trip.name],
    ["BÁO CÁO TỔNG KẾT CHUYẾN ĐI", `V${VERSION}`],
    ["Điểm đến", bundle.trip.destination],
    ["Thời gian", `${dateLabel(bundle.trip.start_date)} - ${dateLabel(bundle.trip.end_date)}`],
    ["Trạng thái báo cáo", analytics.report_state === "post_trip" ? "Sau chuyến đi" : "Tạm thời"],
    [],
    ["TỔNG QUAN"],
    ["Số ngày", analytics.trip_days],
    ["Số người", bundle.trip.people],
    ["Hoạt động", analytics.itinerary.total],
    ["Hoàn thành", analytics.itinerary.done],
    ["Bỏ qua", analytics.itinerary.skipped],
    ["Tỷ lệ hoàn thành", `${analytics.itinerary.completion_rate}%`],
    ["Check-in trễ", analytics.itinerary.late_checkins],
    ["Trễ trung bình (phút)", analytics.itinerary.average_checkin_delay_minutes],
    [],
    ["TÀI CHÍNH"],
    ["Dự toán gốc", analytics.finance.original_budget],
    ["Dự toán hiện tại", analytics.finance.current_budget],
    ["Thực chi ròng", analytics.finance.net_actual],
    ["Chênh lệch", analytics.finance.current_variance],
    ["Chi phí/người", analytics.finance.per_person],
    ["Ngoài dự toán", analytics.finance.unlinked_actual],
    ["Nhóm chi nhiều nhất", analytics.finance.top_category || "—"],
    [],
    ["THEO NGÀY"],
    ["Ngày", "Hoạt động", "Hoàn thành", "Bỏ qua", "Thực chi"],
    ...analytics.days.map((x) => [dateLabel(x.day), x.item_count, x.done, x.skipped, x.actual]),
    [],
    ["THEO NHÓM CHI PHÍ"],
    ["Nhóm", "Dự toán hiện tại", "Thực chi", "Chênh lệch"],
    ...finance.categories.map((x) => [x.category, x.current, x.actual, x.variance]),
    [],
    ["LỊCH TRÌNH"],
    ["Hoạt động", "Trạng thái", "Bắt đầu", "Kết thúc", "Check-in thực tế", "Hoàn thành thực tế"],
    ...bundle.items
      .toSorted((a, b) => a.start_at.localeCompare(b.start_at))
      .map((x) => [
        x.title,
        ITEM_STATUS[x.status],
        localTime(x.start_at, bundle.trip.timezone),
        localTime(x.end_at, bundle.trip.timezone),
        x.checked_in_at ? localTime(x.checked_in_at, bundle.trip.timezone) : "",
        x.completed_at ? localTime(x.completed_at, bundle.trip.timezone) : "",
      ]),
    [],
    ["ĐIỂM NỔI BẬT"],
    ...analytics.highlights.map((x) => [x]),
    [],
    ["CẦN RÀ SOÁT"],
    ...(analytics.warnings.length ? analytics.warnings.map((x) => [x]) : [["Không có cảnh báo."]]),
  ];
  return "\ufeff" + rows.map((row) => row.map(safeCsvCell).join(",")).join("\r\n");
}

export function postTripJson(bundle: Bundle) {
  return JSON.stringify(
    {
      format: "tripflow-post-trip-report",
      version: VERSION,
      exported_at: new Date().toISOString(),
      trip: bundle.trip,
      analytics: buildTripAnalytics(bundle),
      finance: bundle.finance_report || buildFinanceReport(bundle),
      itinerary: bundle.items,
      expenses: bundle.expenses,
      media: bundle.media,
      participants: bundle.participants,
    },
    null,
    2,
  );
}

function htmlEscape(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function postTripHtml(bundle: Bundle) {
  const analytics = buildTripAnalytics(bundle);
  const finance = bundle.finance_report || buildFinanceReport(bundle);
  const categoryRows = finance.categories
    .filter((x) => Number(x.current) || Number(x.actual))
    .map(
      (x) => `<tr><td>${htmlEscape(x.category)}</td><td>${htmlEscape(money(Number(x.current)))}</td><td>${htmlEscape(money(Number(x.actual)))}</td><td>${htmlEscape(money(Number(x.variance)))}</td></tr>`,
    )
    .join("");
  const dayRows = analytics.days
    .map(
      (x) => `<tr><td>${htmlEscape(dateLabel(x.day))}</td><td>${x.item_count}</td><td>${x.done}</td><td>${x.skipped}</td><td>${htmlEscape(money(x.actual))}</td></tr>`,
    )
    .join("");
  const itineraryRows = bundle.items
    .toSorted((a, b) => a.start_at.localeCompare(b.start_at))
    .map(
      (x) => `<tr><td>${htmlEscape(x.title)}</td><td>${htmlEscape(ITEM_STATUS[x.status])}</td><td>${htmlEscape(dateLabel(localTime(x.start_at, bundle.trip.timezone)))}</td><td>${htmlEscape(localTime(x.start_at, bundle.trip.timezone).slice(11))}</td></tr>`,
    )
    .join("");
  const list = (values: string[], empty: string) =>
    values.length
      ? `<ul>${values.map((x) => `<li>${htmlEscape(x)}</li>`).join("")}</ul>`
      : `<p>${htmlEscape(empty)}</p>`;
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TripFlow · ${htmlEscape(bundle.trip.name)}</title>
<style>
:root{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033;background:#f4f6f8}*{box-sizing:border-box}body{margin:0;padding:32px}.report{max-width:980px;margin:auto;background:white;padding:38px;border-radius:24px;box-shadow:0 12px 40px #10213b14}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em;color:#667085}.header{display:flex;justify-content:space-between;gap:24px;border-bottom:1px solid #e6e9ee;padding-bottom:24px}.header h1{font-size:34px;margin:6px 0 8px}.muted{color:#667085}.status{font-size:13px;font-weight:700;border:1px solid #d8dde6;padding:8px 12px;border-radius:999px;align-self:flex-start}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:24px 0}.kpi{border:1px solid #e6e9ee;border-radius:16px;padding:16px}.kpi span{display:block;color:#667085;font-size:12px}.kpi b{display:block;font-size:22px;margin-top:6px}.section{margin-top:28px}.section h2{font-size:20px;margin-bottom:12px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:10px;border-bottom:1px solid #eceff3}th{color:#667085}.good{background:#eef9f2;border-radius:14px;padding:14px}.warn{background:#fff7e8;border-radius:14px;padding:14px}ul{padding-left:20px}.footer{margin-top:34px;padding-top:18px;border-top:1px solid #e6e9ee;color:#667085;font-size:12px}@media(max-width:720px){body{padding:0}.report{border-radius:0;padding:22px}.header{display:block}.status{display:inline-block;margin-top:12px}.grid{grid-template-columns:1fr 1fr}.table-wrap{overflow:auto}}@media print{body{background:white;padding:0}.report{box-shadow:none;max-width:none;padding:0}.no-print{display:none}}
</style></head><body><main class="report">
<header class="header"><div><span class="eyebrow">TRIPFLOW · POST-TRIP REPORT · V${VERSION}</span><h1>${htmlEscape(bundle.trip.name)}</h1><div class="muted">${htmlEscape(bundle.trip.destination)} · ${htmlEscape(dateLabel(bundle.trip.start_date))} – ${htmlEscape(dateLabel(bundle.trip.end_date))} · ${bundle.trip.people} người</div></div><span class="status">${analytics.report_state === "post_trip" ? "Báo cáo sau chuyến" : "Báo cáo tạm thời"}</span></header>
<section class="grid"><div class="kpi"><span>Hoàn thành lịch trình</span><b>${analytics.itinerary.completion_rate}%</b></div><div class="kpi"><span>Thực chi ròng</span><b>${htmlEscape(money(analytics.finance.net_actual))}</b></div><div class="kpi"><span>Chi phí / người</span><b>${htmlEscape(money(analytics.finance.per_person))}</b></div><div class="kpi"><span>Media</span><b>${analytics.media.total}</b></div></section>
<section class="section"><h2>Điểm nổi bật</h2><div class="good">${list(analytics.highlights, "Chưa có dữ liệu nổi bật.")}</div></section>
<section class="section"><h2>Cần rà soát</h2><div class="${analytics.warnings.length ? "warn" : "good"}">${list(analytics.warnings, "Dữ liệu đã sẵn sàng để lưu trữ báo cáo.")}</div></section>
<section class="section"><h2>Tài chính theo nhóm</h2><div class="table-wrap"><table><thead><tr><th>Nhóm</th><th>Dự toán</th><th>Thực chi</th><th>Chênh lệch</th></tr></thead><tbody>${categoryRows || '<tr><td colspan="4">Chưa có dữ liệu tài chính.</td></tr>'}</tbody></table></div></section>
<section class="section"><h2>Tổng kết theo ngày</h2><div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Hoạt động</th><th>Hoàn thành</th><th>Bỏ qua</th><th>Thực chi</th></tr></thead><tbody>${dayRows || '<tr><td colspan="5">Chưa có dữ liệu theo ngày.</td></tr>'}</tbody></table></div></section>
<section class="section"><h2>Lịch trình</h2><div class="table-wrap"><table><thead><tr><th>Hoạt động</th><th>Trạng thái</th><th>Ngày</th><th>Giờ dự kiến</th></tr></thead><tbody>${itineraryRows || '<tr><td colspan="4">Chưa có hoạt động.</td></tr>'}</tbody></table></div></section>
<footer class="footer">Tạo lúc ${htmlEscape(new Date(analytics.generated_at).toLocaleString("vi-VN"))}. Báo cáo được tổng hợp từ dữ liệu TripFlow tại thời điểm xuất.</footer>
</main><script>window.addEventListener('load',()=>{if(location.hash==='#print')window.print()})</script></body></html>`;
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
    ["BÁO CÁO TÀI CHÍNH", `V${VERSION}`],
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

