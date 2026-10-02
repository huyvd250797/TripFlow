import test from "node:test";
import assert from "node:assert/strict";
import {
  applyOptimisticMutation,
  compactQueueRows,
  isCoreOfflineMutation,
  overlayQueuedMutations,
  retryDelayMs,
} from "../lib/offline-reliability";
import type { Bundle, Mutation, QueuedMutation } from "../lib/types";

const tripId = "11111111-1111-4111-8111-111111111111";
const expenseId = "22222222-2222-4222-8222-222222222222";
const budgetId = "33333333-3333-4333-8333-333333333333";
const op1 = "44444444-4444-4444-8444-444444444444";
const op2 = "55555555-5555-4555-8555-555555555555";
const stamp = "2026-10-02T10:00:00.000Z";

function sourceBundle(): Bundle {
  return {
    trip: {
      id: tripId,
      owner_id: "u1",
      name: "Nha Trang",
      destination: "Nha Trang",
      start_date: "2026-10-01",
      end_date: "2026-10-03",
      timezone: "Asia/Ho_Chi_Minh",
      people: 2,
      status: "traveling",
      note: "",
      version: 1,
      created_at: stamp,
      updated_at: stamp,
    },
    role: "owner",
    items: [],
    budgets: [
      {
        id: budgetId,
        title: "Ăn uống",
        category: "Ăn uống",
        quantity: 1,
        unit_price: 500000,
        amount: 500000,
        item_id: null,
        note: "",
        version: 1,
        created_at: stamp,
        updated_at: stamp,
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

function expenseCreate(operationId = op1): Mutation {
  return {
    operationId,
    tripId,
    entity: "expense",
    action: "create",
    id: expenseId,
    data: {
      title: "Ăn trưa",
      category: "Ăn uống",
      amount: 150000,
      kind: "payment",
      budget_id: budgetId,
      refund_of: "",
      spent_on: "2026-10-02",
      payer: "HuyVo",
      note: "",
      receipt_url: "",
    },
  };
}

test("V2.4 queues all core travel data but keeps collaboration online-only", () => {
  assert.equal(isCoreOfflineMutation(expenseCreate()), true);
  assert.equal(
    isCoreOfflineMutation({
      operationId: op1,
      tripId,
      entity: "budget",
      action: "delete",
      id: budgetId,
      version: 1,
    }),
    true,
  );
  assert.equal(
    isCoreOfflineMutation({
      operationId: op1,
      tripId,
      entity: "invitation",
      action: "create",
      id: budgetId,
      data: {},
    }),
    false,
  );
});

test("V2.4 compacts create then update into one idempotent create", () => {
  const first = compactQueueRows([], expenseCreate(), "u1", stamp);
  const update: Mutation = {
    operationId: op2,
    tripId,
    entity: "expense",
    action: "update",
    id: expenseId,
    version: 1,
    data: { ...expenseCreate().data, amount: 180000 },
  };
  const compacted = compactQueueRows(
    first.rows,
    update,
    "u1",
    "2026-10-02T10:01:00.000Z",
  );
  assert.equal(compacted.rows.length, 1);
  assert.equal(compacted.compacted, true);
  assert.equal(compacted.rows[0].mutation.action, "create");
  assert.equal(compacted.rows[0].mutation.operationId, op1);
  assert.equal(compacted.rows[0].mutation.data?.amount, 180000);
});

test("V2.4 cancels a local create followed by delete before sync", () => {
  const first = compactQueueRows([], expenseCreate(), "u1", stamp);
  const removed = compactQueueRows(
    first.rows,
    {
      operationId: op2,
      tripId,
      entity: "expense",
      action: "delete",
      id: expenseId,
      version: 1,
    },
    "u1",
    "2026-10-02T10:02:00.000Z",
  );
  assert.equal(removed.rows.length, 0);
  assert.equal(removed.cancelled, true);
  assert.equal(removed.queued, null);
});

test("V2.4 optimistic cache shows offline expense immediately and preserves relations", () => {
  const withExpense = applyOptimisticMutation(sourceBundle(), expenseCreate(), stamp);
  assert.equal(withExpense.expenses.length, 1);
  assert.equal(withExpense.expenses[0].amount, 150000);
  assert.equal(withExpense.expenses[0].budget_id, budgetId);

  const withoutBudget = applyOptimisticMutation(
    withExpense,
    {
      operationId: op2,
      tripId,
      entity: "budget",
      action: "delete",
      id: budgetId,
      version: 1,
    },
    "2026-10-02T10:03:00.000Z",
  );
  assert.equal(withoutBudget.budgets.length, 0);
  assert.equal(withoutBudget.expenses[0].budget_id, null);
});

test("V2.4 queue overlay applies pending operations but not conflict rows", () => {
  const pending: QueuedMutation = {
    operationId: op1,
    userId: "u1",
    tripId,
    mutation: expenseCreate(),
    state: "pending",
    attempts: 0,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const conflict: QueuedMutation = {
    ...pending,
    operationId: op2,
    mutation: { ...expenseCreate(op2), id: "66666666-6666-4666-8666-666666666666" },
    state: "conflict",
  };
  const visible = overlayQueuedMutations(sourceBundle(), [pending, conflict], stamp);
  assert.equal(visible.expenses.length, 1);
  assert.equal(visible.expenses[0].id, expenseId);
});

test("V2.4 retry uses bounded exponential backoff", () => {
  assert.equal(retryDelayMs(1), 2000);
  assert.equal(retryDelayMs(3), 15000);
  assert.equal(retryDelayMs(99), 300000);
});

test("V2.4 never rewrites an operationId after a request may have reached server", () => {
  const uncertain = compactQueueRows(
    [],
    expenseCreate(),
    "u1",
    stamp,
    { allowCompaction: false, attempted: true },
  );
  assert.equal(uncertain.rows[0].attempts, 1);
  assert.equal(Boolean(uncertain.rows[0].lastAttemptAt), true);
  assert.equal(Boolean(uncertain.rows[0].nextAttemptAt), true);

  const update: Mutation = {
    operationId: op2,
    tripId,
    entity: "expense",
    action: "update",
    id: expenseId,
    version: 1,
    data: { ...expenseCreate().data, amount: 190000 },
  };
  const next = compactQueueRows(
    uncertain.rows,
    update,
    "u1",
    "2026-10-02T10:02:00.000Z",
  );
  assert.equal(next.rows.length, 2);
  assert.equal(next.rows[0].mutation.operationId, op1);
  assert.equal(next.rows[1].mutation.operationId, op2);
});
