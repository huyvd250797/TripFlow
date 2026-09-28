import { test } from "node:test";
import assert from "node:assert/strict";
import { searchTripWorkspace } from "../lib/workspace";
import type { Bundle } from "../lib/types";

const bundle = {
  trip: {
    id: "t1",
    owner_id: "u1",
    name: "Nghỉ dưỡng Mũi Né",
    destination: "Mũi Né - Phan Thiết",
    start_date: "2026-10-09",
    end_date: "2026-10-11",
    timezone: "Asia/Ho_Chi_Minh",
    people: 2,
    status: "planning",
    note: "",
    version: 1,
  },
  role: "owner",
  items: [
    {
      id: "i1",
      trip_id: "t1",
      title: "Ngắm bình minh",
      location: "Đồi cát trắng",
      start_at: "2026-10-09T22:00:00.000Z",
      end_at: "2026-10-09T23:00:00.000Z",
      status: "planned",
      map_url: "",
      note: "Mang nước",
      checked_in_at: null,
      completed_at: null,
      version: 1,
    },
  ],
  budgets: [
    { id: "b1", title: "Khách sạn", category: "Lưu trú", quantity: 1, unit_price: 1200000, amount: 1200000, item_id: null, note: "", version: 1 },
  ],
  expenses: [
    { id: "e1", title: "Hải sản", category: "Ăn uống", amount: 450000, kind: "payment", spent_on: "2026-10-10", budget_id: null, refund_of: null, payer: "Huy", note: "bữa tối", receipt_url: "", version: 1 },
  ],
  media: [
    { id: "m1", title: "Album biển", kind: "album", url: "https://example.com", item_id: "i1", note: "", version: 1 },
  ],
  participants: [{ id: "p1", name: "Bún", note: "", version: 1 }],
  members: [], invitations: [], snapshots: [], audits: [],
} as unknown as Bundle;

test("V1.2 workspace search is accent-insensitive and routes result types", () => {
  const item = searchTripWorkspace(bundle, "doi cat");
  assert.equal(item[0]?.kind, "item");
  assert.equal(item[0]?.tab, "route");
  assert.equal(item[0]?.day, "2026-10-10");

  const expense = searchTripWorkspace(bundle, "hai san");
  assert.equal(expense[0]?.kind, "expense");
  assert.equal(expense[0]?.tab, "money");

  const person = searchTripWorkspace(bundle, "bun");
  assert.equal(person[0]?.kind, "participant");
  assert.equal(person[0]?.tab, "more");
});
