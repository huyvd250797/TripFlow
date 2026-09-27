import {
  CATEGORIES,
  type Bundle,
  type Budget,
  type Expense,
  type Item,
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
export function live(items: Item[], now = new Date().toISOString()) {
  const sorted = [...items].sort(
    (a, b) => Date.parse(a.start_at) - Date.parse(b.start_at),
  );
  return {
    active: sorted.find((x) => x.status === "active"),
    scheduled: sorted.filter(
      (x) =>
        x.status === "planned" &&
        Date.parse(x.start_at) <= Date.parse(now) &&
        Date.parse(x.end_at) > Date.parse(now),
    ),
    next: sorted.find(
      (x) => x.status === "planned" && Date.parse(x.start_at) > Date.parse(now),
    ),
    late: sorted.filter(
      (x) => x.status === "planned" && Date.parse(x.end_at) <= Date.parse(now),
    ),
    done: sorted.filter((x) => x.status === "done").length,
    processed: sorted.filter((x) => ["done", "skipped"].includes(x.status))
      .length,
    sorted,
  };
}
export function csv(bundle: Bundle) {
  const t = compare(bundle.budgets, bundle.expenses);
  const rows: unknown[][] = [
    ["TripFlow", bundle.trip.name],
    ["Nhóm", "Dự toán", "Thực chi ròng", "Chênh lệch"],
    ...t.categories.map((x) => [
      x.category,
      x.plan,
      x.actual,
      x.plan - x.actual,
    ]),
    ["TỔNG", t.plan, t.actual, t.remaining],
    [],
    ["DỰ TOÁN"],
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
    [
      "Ngày",
      "Nội dung",
      "Loại",
      "Nhóm",
      "Số tiền",
      "Người trả",
      "Khoản dự toán",
    ],
    ...bundle.expenses.map((x) => [
      dateLabel(x.spent_on),
      x.title,
      x.kind === "refund" ? "Hoàn tiền" : "Chi",
      x.category,
      x.amount,
      x.payer,
      bundle.budgets.find((b) => b.id === x.budget_id)?.title ||
        "Ngoài dự toán",
    ]),
  ];
  return (
    "\ufeff" +
    rows
      .map((r) =>
        r
          .map((x) => {
            let s = String(x ?? "");
            if (typeof x === "string" && /^[=+@\-\t\r]/.test(s)) s = "'" + s;
            return '"' + s.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n")
  );
}
