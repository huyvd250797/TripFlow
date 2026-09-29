import test from "node:test";
import assert from "node:assert/strict";
import { buildSmartDefaults, expenseContextWarnings, itemContextWarnings } from "../lib/smart-defaults";
import type { Bundle } from "../lib/types";

const bundle = {
  trip: {
    id: "t1", owner_id: "u1", name: "Đà Lạt", destination: "Đà Lạt",
    start_date: "2026-10-10", end_date: "2026-10-12", timezone: "Asia/Ho_Chi_Minh",
    people: 2, status: "traveling", note: "", version: 1,
  },
  role: "owner",
  items: [
    { id: "i1", trip_id: "t1", title: "Ăn sáng", location: "Chợ Đà Lạt", start_at: "2026-10-10T00:00:00.000Z", end_at: "2026-10-10T01:00:00.000Z", status: "planned", map_url: "", note: "", checked_in_at: null, completed_at: null, version: 1, created_at: "2026-09-29T00:00:00Z", updated_at: "2026-09-29T00:00:00Z" },
  ],
  budgets: [
    { id: "b1", title: "Ăn sáng", category: "Ăn uống", quantity: 1, unit_price: 300000, amount: 300000, item_id: "i1", note: "", version: 1, created_at: "2026-09-29T00:00:00Z", updated_at: "2026-09-29T00:00:00Z" },
  ],
  expenses: [
    { id: "e1", title: "Cafe", category: "Ăn uống", amount: 100000, kind: "payment", spent_on: "2026-10-10", budget_id: "b1", refund_of: null, payer: "Huy", note: "", receipt_url: "", version: 1, created_at: "2026-10-10T00:10:00Z", updated_at: "2026-10-10T00:10:00Z" },
    { id: "e2", title: "Bánh", category: "Ăn uống", amount: 90000, kind: "payment", spent_on: "2026-10-10", budget_id: null, refund_of: null, payer: "Huy", note: "", receipt_url: "", version: 1, created_at: "2026-10-10T00:05:00Z", updated_at: "2026-10-10T00:05:00Z" },
    { id: "e3", title: "Nước", category: "Ăn uống", amount: 110000, kind: "payment", spent_on: "2026-10-10", budget_id: null, refund_of: null, payer: "Huy", note: "", receipt_url: "", version: 1, created_at: "2026-10-10T00:02:00Z", updated_at: "2026-10-10T00:02:00Z" },
  ],
  media: [], participants: [], members: [], invitations: [], snapshots: [], audits: [],
} as unknown as Bundle;

test("V1.6 smart defaults reuse contextual payer/category/budget", () => {
  const defaults = buildSmartDefaults(bundle, "2026-10-09T23:30:00.000Z");
  assert.equal(defaults.expense.payer, "Huy");
  assert.equal(defaults.expense.category, "Ăn uống");
  assert.equal(defaults.expense.budget_id, "b1");
  assert.equal(defaults.item.location, "Chợ Đà Lạt");
});

test("V1.6 warns before exceeding a linked budget", () => {
  const warnings = expenseContextWarnings(bundle, { amount: 250000, category: "Ăn uống", budget_id: "b1" });
  assert.ok(warnings.some((x) => x.includes("vượt phần còn lại")));
});

test("V1.6 warns when a new activity overlaps existing itinerary", () => {
  const warnings = itemContextWarnings(bundle, { start_local: "2026-10-10T07:30" });
  assert.ok(warnings.some((x) => x.includes("Trùng giờ")));
});
