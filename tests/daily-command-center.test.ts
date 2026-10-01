import test from "node:test";
import assert from "node:assert/strict";
import { buildDailyCommandCenter } from "../lib/daily-command-center";
import type { Bundle } from "../lib/types";

function bundle(status: Bundle["trip"]["status"] = "traveling") {
  return {
    trip: {
      id: "t1", owner_id: "u1", name: "Nha Trang", destination: "Nha Trang",
      start_date: "2026-10-01", end_date: "2026-10-03", timezone: "Asia/Ho_Chi_Minh",
      people: 2, status, note: "", version: 1, created_at: "", updated_at: "",
    },
    role: "owner",
    items: [
      { id: "i1", trip_id: "t1", title: "Ăn sáng", location: "", start_at: "2026-10-01T00:00:00.000Z", end_at: "2026-10-01T01:00:00.000Z", status: "done", map_url: "", note: "", checked_in_at: null, completed_at: null, version: 1, created_at: "", updated_at: "" },
      { id: "i2", trip_id: "t1", title: "Viện Hải Dương Học", location: "12 Trần Phú", start_at: "2026-10-01T02:00:00.000Z", end_at: "2026-10-01T04:00:00.000Z", status: "active", map_url: "https://maps.app.goo.gl/test", note: "", checked_in_at: null, completed_at: null, version: 1, created_at: "", updated_at: "" },
      { id: "i3", trip_id: "t1", title: "Ăn trưa", location: "", start_at: "2026-10-01T04:30:00.000Z", end_at: "2026-10-01T05:30:00.000Z", status: "planned", map_url: "", note: "", checked_in_at: null, completed_at: null, version: 1, created_at: "", updated_at: "" },
    ],
    budgets: [
      { id: "b2", title: "Vé Hải Dương Học", category: "Tham quan", quantity: 1, unit_price: 200000, amount: 200000, item_id: "i2", note: "", version: 1, created_at: "", updated_at: "" },
      { id: "b3", title: "Ăn trưa", category: "Ăn uống", quantity: 1, unit_price: 300000, amount: 300000, item_id: "i3", note: "", version: 1, created_at: "", updated_at: "" },
    ],
    expenses: [
      { id: "e1", title: "Vé", category: "Tham quan", amount: 150000, kind: "payment", spent_on: "2026-10-01", budget_id: "b2", refund_of: null, payer: "HuyVo", note: "", receipt_url: "", version: 1, created_at: "", updated_at: "" },
    ],
    media: [], participants: [], members: [], invitations: [], snapshots: [], audits: [],
  } as Bundle;
}

test("V2.3 daily command center resolves current, next and today's money", () => {
  const result = buildDailyCommandCenter(bundle(), "2026-10-01T03:00:00.000Z");
  assert.equal(result.phase, "live");
  assert.equal(result.today, "2026-10-01");
  assert.equal(result.current?.id, "i2");
  assert.equal(result.next?.id, "i3");
  assert.equal(result.today_done, 1);
  assert.equal(result.today_budget, 500000);
  assert.equal(result.today_actual, 150000);
  assert.equal(result.today_remaining_budget, 350000);
  assert.equal(result.attention.some((x) => x.code === "missing_place"), true);
});

test("V2.3 daily command center uses pre-trip context before departure", () => {
  const result = buildDailyCommandCenter(bundle("ready"), "2026-09-29T03:00:00.000Z");
  assert.equal(result.phase, "pretrip");
  assert.equal(result.days_until_start, 2);
});

test("V2.3 daily command center uses post-trip context after completion", () => {
  const source = bundle("completed");
  source.items[2].status = "planned";
  const result = buildDailyCommandCenter(source, "2026-10-04T03:00:00.000Z");
  assert.equal(result.phase, "posttrip");
  assert.equal(result.attention.some((x) => x.code === "unfinished"), true);
});
