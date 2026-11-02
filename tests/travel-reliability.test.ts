import test from "node:test";
import assert from "node:assert/strict";
import type { Bundle, Item, Mutation } from "../lib/types";
import {
  buildFinanceReport,
  buildTripAnalytics,
  csv,
  itemOnDay,
  tripPeriod,
} from "../lib/domain";
import { buildTravelWallet } from "../lib/expense-intelligence";
import { buildDailyCommandCenter } from "../lib/daily-command-center";
import {
  applyOptimisticMutation,
  overlayQueuedMutations,
} from "../lib/offline-reliability";
import {
  buildDirectionsSegments,
  buildDirectionsUrl,
} from "../lib/route-intelligence";
import { planningDays } from "../lib/planning";
import { tripPermissions } from "../lib/permissions";
function source(): Bundle {
  const row = {
    version: 1,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  };
  return {
    trip: {
      ...row,
      id: "t",
      owner_id: "u",
      name: "Travel",
      destination: "Nha Trang",
      start_date: "2026-10-01",
      end_date: null,
      timezone: "Asia/Ho_Chi_Minh",
      people: 2,
      status: "traveling",
      note: "",
    },
    role: "owner",
    items: [],
    budgets: [
      {
        ...row,
        id: "b",
        title: "Food",
        category: "Ăn uống",
        quantity: 1,
        unit_price: 1000000,
        amount: 1000000,
        item_id: null,
        note: "",
      },
    ],
    expenses: [],
    media: [],
    participants: [],
    members: [],
    invitations: [],
    snapshots: [],
    audits: [],
  };
}
function expense(id = "e", amount = 200000): Mutation {
  return {
    operationId: id,
    tripId: "t",
    id,
    entity: "expense",
    action: "create",
    data: {
      title: "Lunch",
      kind: "payment",
      category: "Ăn uống",
      budget_id: "b",
      amount,
      spent_on: "2026-10-01",
      payer: "Huy",
    },
  };
}
function night(): Item {
  return {
    id: "night",
    trip_id: "t",
    title: "Xe đêm",
    location: "Bến xe",
    map_url: "",
    start_at: "2026-10-01T15:00:00Z",
    end_at: "2026-10-02T00:00:00Z",
    status: "active",
    checked_in_at: "2026-10-01T15:00:00Z",
    completed_at: null,
    note: "",
    version: 1,
    created_at: "",
    updated_at: "",
  };
}

test("V2.4.1 offline create/update/refund/delete keeps Wallet, analytics and CSV consistent with visible rows", () => {
  let b = source();
  b.finance_report = buildFinanceReport(b);
  b = applyOptimisticMutation(b, expense());
  assert.equal(b.finance_report, undefined);
  assert.equal(buildTravelWallet(b).net_actual, 200000);
  assert.equal(buildTripAnalytics(b).finance.net_actual, 200000);
  assert.match(csv(b), /"Thực chi ròng","200000"/);
  b = applyOptimisticMutation(b, {
    ...expense(),
    action: "update",
    data: { ...expense().data, amount: 300000 },
  });
  assert.equal(buildTravelWallet(b).remaining, 700000);
  b = applyOptimisticMutation(b, {
    ...expense("r", 50000),
    data: { ...expense("r", 50000).data, kind: "refund", refund_of: "e" },
  });
  assert.equal(buildTravelWallet(b).net_actual, 250000);
  b = applyOptimisticMutation(b, { ...expense("r"), action: "delete" });
  b = applyOptimisticMutation(b, { ...expense(), action: "delete" });
  assert.equal(buildTravelWallet(b).net_actual, 0);
});
test("V2.4.1 pending overlay invalidates a fresh server report without duplicating a local create", () => {
  const b = source();
  b.finance_report = buildFinanceReport(b);
  const queue = [
    {
      operationId: "e",
      userId: "u",
      tripId: "t",
      mutation: expense(),
      state: "pending" as const,
      attempts: 0,
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
    },
  ];
  const visible = overlayQueuedMutations(b, queue);
  assert.equal(buildTravelWallet(visible).net_actual, 200000);
  assert.equal(overlayQueuedMutations(visible, queue).expenses.length, 1);
});
test("V2.4.1 offline budget changes invalidate aggregates too", () => {
  const b = source();
  b.finance_report = buildFinanceReport(b);
  const n = applyOptimisticMutation(b, {
    operationId: "budget",
    tripId: "t",
    id: "b",
    entity: "budget",
    action: "update",
    data: { quantity: 2, unit_price: 1000000 },
  });
  assert.equal(buildTravelWallet(n).current_budget, 2000000);
});
test("V2.4.1 overnight active and planned activities remain Current after local midnight", () => {
  const b = source();
  b.items = [night()];
  assert.equal(
    buildDailyCommandCenter(b, "2026-10-01T18:00:00Z").current?.id,
    "night",
  );
  b.items[0].status = "planned";
  assert.equal(
    buildDailyCommandCenter(b, "2026-10-01T18:00:00Z").current?.id,
    "night",
  );
  b.items[0].status = "active";
  assert.equal(
    buildDailyCommandCenter(b, "2026-10-03T18:00:00Z").current?.id,
    "night",
  );
});
test("V2.4.1 midnight is an exclusive endpoint; overnight budgets are counted only on start day", () => {
  const b = source();
  b.items = [night()];
  b.budgets[0].item_id = "night";
  assert.equal(
    buildDailyCommandCenter(b, "2026-10-01T16:00:00Z").today_budget,
    1000000,
  );
  assert.equal(
    buildDailyCommandCenter(b, "2026-10-01T18:00:00Z").today_budget,
    0,
  );
  const midnight = { ...night(), end_at: "2026-10-01T17:00:00Z" };
  assert.equal(itemOnDay(midnight, b.trip.timezone, "2026-10-02"), false);
});
test("V2.4.1 open-ended duration is shared by Home, Wallet, analytics and Planning, including end days", () => {
  const b = source();
  b.items = [{ ...night(), end_at: "2026-10-05T00:00:00Z" }];
  b.expenses = [
    {
      ...expense().data,
      id: "paid",
      spent_on: "2026-12-10",
      amount: 1,
      kind: "payment",
    },
  ] as Bundle["expenses"];
  assert.equal(tripPeriod(b.trip, b.items).days, 5);
  assert.equal(buildDailyCommandCenter(b, "2026-10-02T00:00:00Z").trip_days, 5);
  assert.equal(buildTravelWallet(b).days_total, 5);
  assert.equal(buildTripAnalytics(b).trip_days, 5);
  assert.deepEqual(planningDays(b.trip, b.items), [
    "2026-10-01",
    "2026-10-02",
    "2026-10-03",
    "2026-10-04",
    "2026-10-05",
  ]);
  b.trip.end_date = "2026-10-06";
  assert.equal(tripPeriod(b.trip, b.items).days, 6);
});
test("V2.4.1 segmented directions retain every stop once in order, sharing only adjacent endpoints", () => {
  for (const size of [0, 1, 2, 5, 6, 12, 29]) {
    const items = Array.from({ length: size }, (_, i) => ({
      ...night(),
      id: String(i),
      title: `Place ${i}`,
      location: `Place ${i}`,
    }));
    const segs = buildDirectionsSegments(items);
    const visited: string[] = [];
    for (const [i, s] of segs.entries()) {
      const url = new URL(s.url);
      const via = url.searchParams.get("waypoints")?.split("|") || [];
      assert.ok(via.length <= 3);
      const stops = [
        url.searchParams.get("origin")!,
        ...via,
        url.searchParams.get("destination")!,
      ];
      visited.push(...(i ? stops.slice(1) : stops));
    }
    assert.deepEqual(visited, size < 2 ? [] : items.map((i) => i.location));
    if (segs.length > 1) assert.equal(buildDirectionsUrl(items), "");
  }
});
test("V2.4.1 five special permissions fail closed for legacy members, independently of Editor/Viewer", () => {
  assert.ok(Object.values(tripPermissions({ role: "owner" })).every(Boolean));
  assert.ok(
    Object.values(tripPermissions({ role: "editor" })).every((v) => !v),
  );
  const p = tripPermissions({
    role: "viewer",
    permissions: {
      can_invite: false,
      can_change_roles: false,
      can_revoke_access: false,
      can_delete_trip: true,
      can_close_budget: false,
      can_close_settlement: false,
    },
  });
  assert.equal(p.can_delete_trip, true);
  assert.equal(p.can_close_budget, false);
});
