import test from "node:test";
import assert from "node:assert/strict";
import { buildTravelWallet, inferExpenseCategory } from "../lib/expense-intelligence";
import type { Bundle, Expense } from "../lib/types";

const base = {
  trip: {
    id: "t1", owner_id: "u1", name: "Nha Trang", destination: "Nha Trang",
    start_date: "2026-10-01", end_date: "2026-10-04", timezone: "Asia/Ho_Chi_Minh",
    people: 2, status: "traveling", note: "", version: 1,
  },
  role: "owner", items: [],
  budgets: [{ id: "b1", title: "Trip", category: "Khác", quantity: 1, unit_price: 4000000, amount: 4000000, item_id: null, note: "", version: 1 }],
  expenses: [
    { id: "e1", title: "Khách sạn", category: "Lưu trú", amount: 1200000, kind: "payment", spent_on: "2026-10-01", budget_id: null, refund_of: null, payer: "Huy", note: "", receipt_url: "", version: 1, created_at: "2026-10-01T01:00:00Z", updated_at: "2026-10-01T01:00:00Z" },
    { id: "e2", title: "Ăn tối", category: "Ăn uống", amount: 400000, kind: "payment", spent_on: "2026-10-01", budget_id: null, refund_of: null, payer: "Lan", note: "", receipt_url: "", version: 1, created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z" },
    { id: "e3", title: "Hoàn khách sạn", category: "Lưu trú", amount: 200000, kind: "refund", spent_on: "2026-10-02", budget_id: null, refund_of: "e1", payer: "", note: "", receipt_url: "", version: 1, created_at: "2026-10-02T01:00:00Z", updated_at: "2026-10-02T01:00:00Z" },
  ],
  media: [], participants: [], members: [], invitations: [], snapshots: [], audits: [],
} as unknown as Bundle;

test("V1.9 category intelligence recognizes common travel expenses", () => {
  assert.equal(inferExpenseCategory("Grab từ sân bay"), "Di chuyển");
  assert.equal(inferExpenseCategory("Buffet hải sản"), "Ăn uống");
  assert.equal(inferExpenseCategory("Phòng khách sạn La Vague"), "Lưu trú");
});

test("V1.9 category intelligence prefers same-title history", () => {
  const history = [{ title: "Vé cáp treo", category: "Tham quan", kind: "payment", updated_at: "2026-09-01" }] as Expense[];
  assert.equal(inferExpenseCategory("Vé cáp treo", history), "Tham quan");
});

test("V1.9 wallet calculates remaining budget, daily allowance and payer net contribution", () => {
  const wallet = buildTravelWallet(base, "2026-10-02T05:00:00.000Z");
  assert.equal(wallet.current_budget, 4000000);
  assert.equal(wallet.net_actual, 1400000);
  assert.equal(wallet.remaining, 2600000);
  assert.equal(Math.round(wallet.per_person), 700000);
  assert.equal(Math.round(wallet.safe_daily_remaining || 0), 866667);
  assert.equal(wallet.payers.find((x) => x.payer === "Huy")?.net_paid, 1000000);
  assert.equal(wallet.payers.find((x) => x.payer === "Lan")?.net_paid, 400000);
});

test("V1.9 wallet warns when spending runs materially ahead of trip progress", () => {
  const heavy = {
    ...base,
    expenses: [{ ...(base.expenses[0] as Expense), amount: 3000000 }],
  } as Bundle;
  const wallet = buildTravelWallet(heavy, "2026-10-01T05:00:00.000Z");
  assert.equal(wallet.pace, "watch");
  assert.match(wallet.pace_message, /Đã dùng/);
});
