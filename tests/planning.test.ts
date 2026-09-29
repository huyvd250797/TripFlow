import test from "node:test";
import assert from "node:assert/strict";
import { moveItemToDay, planningDays, shiftItemMinutes } from "../lib/planning";
import type { Item, Trip } from "../lib/types";

const trip = {
  id: "t", version: 1, created_at: "", updated_at: "", owner_id: "u", name: "Trip", destination: "",
  start_date: "2026-10-09", end_date: "2026-10-11", timezone: "Asia/Ho_Chi_Minh", people: 2, status: "planning", note: "",
} satisfies Trip;
const item = {
  id: "i", version: 1, created_at: "", updated_at: "", trip_id: "t", title: "Ăn sáng", location: "",
  start_at: "2026-10-09T00:30:00.000Z", end_at: "2026-10-09T01:30:00.000Z", status: "planned", map_url: "", note: "", checked_in_at: null, completed_at: null,
} satisfies Item;

test("planningDays enumerates short trip range", () => {
  assert.deepEqual(planningDays(trip, [item]), ["2026-10-09", "2026-10-10", "2026-10-11"]);
});

test("moveItemToDay preserves local time and duration", () => {
  const moved = moveItemToDay(item, "2026-10-10", trip.timezone);
  assert.equal(moved.start_at, "2026-10-10T00:30:00.000Z");
  assert.equal(Date.parse(moved.end_at!) - Date.parse(moved.start_at), 60 * 60 * 1000);
});

test("shiftItemMinutes moves start and optional end together", () => {
  const moved = shiftItemMinutes(item, 30);
  assert.equal(moved.start_at, "2026-10-09T01:00:00.000Z");
  assert.equal(moved.end_at, "2026-10-09T02:00:00.000Z");
});
