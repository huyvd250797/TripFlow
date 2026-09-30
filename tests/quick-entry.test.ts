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

test("V2.1 quick entry understands amount, content, budget and payer from one natural command", () => {
  const row = parseQuickEntry("chi 150k ăn trưa viện hải dương học HuyVo", {
    ...context,
    participants: [
      { id: "p-huy", version: 1, created_at: "", updated_at: "", name: "HuyVo", note: "" },
      { id: "p-lan", version: 1, created_at: "", updated_at: "", name: "Lan", note: "" },
    ],
    budgets: [
      {
        id: "b-hdh",
        version: 1,
        created_at: "",
        updated_at: "",
        title: "Vé Viện Hải Dương Học",
        category: "Tham quan",
        quantity: 1,
        unit_price: 200000,
        amount: 200000,
        item_id: null,
        note: "",
      },
    ],
  });
  assert.equal(row?.kind, "expense");
  if (row?.kind !== "expense") throw new Error("Expected expense");
  assert.equal(row.amount, 150000);
  assert.equal(row.title.toLowerCase(), "ăn trưa");
  assert.equal(row.transaction_kind, "payment");
  assert.equal(row.budget_id, "b-hdh");
  assert.equal(row.budget_title, "Vé Viện Hải Dương Học");
  assert.equal(row.payer, "HuyVo");
  assert.equal(row.payer_id, "p-huy");
  assert.equal(row.valid, true);
});

test("V2.1 quick entry fuzzy-matches a shortened budget name", () => {
  const row = parseQuickEntry("chi 80k cafe hải dương học HuyVo", {
    ...context,
    participants: [
      { id: "p-huy", version: 1, created_at: "", updated_at: "", name: "HuyVo", note: "" },
    ],
    budgets: [
      {
        id: "b-hdh",
        version: 1,
        created_at: "",
        updated_at: "",
        title: "Vé Viện Hải Dương Học",
        category: "Tham quan",
        quantity: 1,
        unit_price: 200000,
        amount: 200000,
        item_id: null,
        note: "",
      },
    ],
  });
  assert.equal(row?.kind, "expense");
  if (row?.kind !== "expense") throw new Error("Expected expense");
  assert.equal(row.budget_id, "b-hdh");
  assert.equal(row.payer, "HuyVo");
  assert.equal(row.title.toLowerCase(), "cafe");
  assert.equal(row.valid, true);
});
