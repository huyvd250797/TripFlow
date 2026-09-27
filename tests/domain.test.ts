import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseDate,
  utcTime,
  localTime,
  compare,
  live,
  csv,
} from "../lib/domain";
import { mutationSchema } from "../lib/validation";
import type { Budget, Expense, Item, Bundle } from "../lib/types";
test("dates and timezones stay consistent", () => {
  assert.equal(parseDate("25/09/2026"), "2026-09-25");
  assert.throws(() => parseDate("31/02/2026"));
  assert.equal(
    utcTime("2026-09-25T10:30", "Asia/Ho_Chi_Minh"),
    "2026-09-25T03:30:00.000Z",
  );
  assert.equal(
    localTime("2026-09-25T03:30:00.000Z", "Asia/Tokyo"),
    "2026-09-25T12:30",
  );
  assert.throws(() => utcTime("2026-03-08T02:30", "America/New_York"));
});
test("financial totals account for refunds and unlinked expenses", () => {
  const r = compare([{ amount: 1000000, category: "Lưu trú" } as Budget], [
    { amount: 300000, kind: "payment", category: "Lưu trú", budget_id: "b" },
    { amount: 800000, kind: "payment", category: "Lưu trú", budget_id: null },
    { amount: 100000, kind: "refund", category: "Lưu trú", budget_id: "b" },
  ] as Expense[]);
  assert.equal(r.actual, 1000000);
  assert.equal(r.remaining, 0);
  assert.equal(r.unlinked, 800000);
});
test("actual check-in remains distinct from planned current activity", () => {
  const r = live(
    [
      {
        id: "1",
        status: "active",
        start_at: "2026-09-25T01:00:00Z",
        end_at: "2026-09-25T02:00:00Z",
      },
      {
        id: "2",
        status: "planned",
        start_at: "2026-09-25T03:00:00Z",
        end_at: "2026-09-25T04:00:00Z",
      },
    ] as Item[],
    "2026-09-25T03:30:00Z",
  );
  assert.equal(r.active?.id, "1");
  assert.equal(r.scheduled[0].id, "2");
});
test("request validation blocks unsafe links", () => {
  const base = {
    operationId: crypto.randomUUID(),
    tripId: crypto.randomUUID(),
    entity: "media",
    action: "create",
    data: {
      title: "Test",
      kind: "album",
      url: "javascript:alert(1)",
      note: "",
    },
  };
  assert.equal(mutationSchema.safeParse(base).success, false);
});
test("CSV neutralizes formula injection", () => {
  const data = {
    trip: { name: "=BAD()" },
    budgets: [],
    expenses: [],
  } as unknown as Bundle;
  assert.match(csv(data), /"'=BAD\(\)"/);
});
