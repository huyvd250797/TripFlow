import test from "node:test";
import assert from "node:assert/strict";
import { parseCompactMoney, parseQuickEntry } from "../lib/quick-entry";

const context = { baseDay: "2026-09-29", nowLocal: "2026-09-29T09:15" };

test("V1.5 quick entry parses common Vietnamese money shorthand", () => {
  assert.equal(parseCompactMoney("Taxi 350k")?.amount, 350000);
  assert.equal(parseCompactMoney("Khách sạn 1tr2")?.amount, 1200000);
  assert.equal(parseCompactMoney("Ăn tối 1.250.000")?.amount, 1250000);
});

test("V1.5 quick entry infers expense and category", () => {
  const row = parseQuickEntry("Taxi sân bay 350k", context);
  assert.equal(row?.kind, "expense");
  if (row?.kind !== "expense") throw new Error("Expected expense");
  assert.equal(row.amount, 350000);
  assert.equal(row.title, "Taxi sân bay");
  assert.equal(row.category, "Di chuyển");
  assert.equal(row.spent_on, "2026-09-29");
});

test("V1.5 quick entry parses itinerary date and time", () => {
  const row = parseQuickEntry("lịch Ăn sáng 7:30 ngày mai", context);
  assert.equal(row?.kind, "item");
  if (row?.kind !== "item") throw new Error("Expected item");
  assert.equal(row.title, "Ăn sáng");
  assert.equal(row.start_local, "2026-09-30T07:30");
});
