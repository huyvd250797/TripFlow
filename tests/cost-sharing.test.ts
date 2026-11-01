import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  allocateCost,
  costPayments,
  costSharingSchema,
} from "../lib/cost-sharing";
import { fundTotals, emptyFund } from "../lib/fund";
import type { Budget, Expense, Participant } from "../lib/types";

test("V2.10 integer allocation, explicit recipients, overlap and exact totals", () => {
  const people = ["A", "B", "C", "D", "Excluded"].map((name) => ({
    id: randomUUID(),
    name,
  }));
  const rule = {
    mode: "fixed_remainder" as const,
    fixed: [{ participant_id: people[0].id, amount: 7000000 }],
    participants: people.slice(1, 4).map((p) => p.id),
  };
  const rows = allocateCost(10740000, rule, people);
  assert.equal(rows.find((p) => p.name === "A")?.amount, 7000000);
  assert.deepEqual(
    rows
      .filter((p) => p.name !== "A")
      .map((p) => p.amount)
      .sort(),
    [1246666, 1246667, 1246667],
  );
  assert.equal(
    rows.reduce((s, p) => s + p.amount, 0),
    10740000,
  );
  assert.ok(!rows.some((p) => p.name === "Excluded"));
  assert.deepEqual(allocateCost(10740000, rule, [...people].reverse()), rows);
  assert.equal(allocateCost(10, { mode: "equal" }, people).length, 5);
  assert.equal(
    allocateCost(10, { mode: "equal" }, people).reduce(
      (s, p) => s + p.amount,
      0,
    ),
    10,
  );
  assert.equal(
    allocateCost(
      100,
      {
        mode: "fixed_remainder",
        fixed: [{ participant_id: people[0].id, amount: 40 }],
        participants: [people[0].id, people[1].id],
      },
      people,
    )[0].amount,
    70,
  );
  assert.throws(() => allocateCost(6, rule, people), /vượt/);
  assert.throws(() =>
    allocateCost(10740000, { ...rule, participants: [] }, people),
  );
  assert.throws(
    () =>
      allocateCost(
        10740000,
        { ...rule, participants: [people[1].id, people[1].id] },
        people,
      ),
    /trùng/,
  );
  assert.equal(
    costSharingSchema.safeParse({ mode: "count", count: 3 }).success,
    false,
  );
  const chosen = {
    mode: "selected_equal" as const,
    participants: people.slice(1, 4).map((p) => p.id),
  };
  const chosenRows = allocateCost(10740000, chosen, people);
  assert.equal(chosenRows.length, 3);
  assert.ok(
    chosenRows.every(
      (p) => p.amount === 3580000 && p.name !== "A" && p.name !== "Excluded",
    ),
  );
  assert.throws(() =>
    allocateCost(
      10740000,
      { mode: "selected_equal", participants: [] },
      people,
    ),
  );
  assert.throws(
    () =>
      allocateCost(
        10740000,
        { mode: "selected_equal", participants: [people[0].id, people[0].id] },
        people,
      ),
    /trùng/,
  );
  assert.equal(costSharingSchema.safeParse(chosen).success, true);
});

test("V2.10 SQL shares, deposit, identity, replay, permission and backup preservation", async () => {
  const db = new PGlite(),
    owner = randomUUID(),
    outsider = randomUUID(),
    tripId = randomUUID();
  const mutation = (
    entity: string,
    data: object,
    action = "create",
    row: Record<string, unknown> = {},
  ) => ({ entity, data, action, tripId, operationId: randomUUID(), ...row });
  const run = async (request: object) =>
    (
      await db.query<any>("select tf_mutate($1::jsonb) r", [
        JSON.stringify(request),
      ])
    ).rows[0].r;
  const fund = async (action: string, data: object) =>
    (
      await db.query<any>("select tf_fund_mutate($1::jsonb) r", [
        JSON.stringify({ tripId, operationId: randomUUID(), action, data }),
      ])
    ).rows[0].r;
  try {
    await db.exec(
      `create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),last_sign_in_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;insert into auth.users(id,email) values('${owner}','owner@test.local'),('${outsider}','other@test.local');`,
    );
    for (const file of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
    const as = (id: string) =>
      db.exec(
        `set role postgres;select set_config('request.jwt.claim.sub','${id}',false);select set_config('request.jwt.claims','${JSON.stringify({ sub: id, email: "owner@test.local" })}',false);set role authenticated;`,
      );
    await as(owner);
    await run(
      mutation("trip", {
        name: "Custom shares",
        destination: "Hồ Tràm",
        start_date: "2026-11-01",
        end_date: "2026-11-02",
        timezone: "Asia/Ho_Chi_Minh",
        people: 5,
        status: "planning",
        note: "",
      }),
    );
    const people: Participant[] = [];
    for (const name of ["A", "B", "C", "D", "Excluded"])
      people.push(await run(mutation("participant", { name, note: "" })));
    const rule = {
      mode: "fixed_remainder" as const,
      fixed: [{ participant_id: people[0].id, amount: 7000000 }],
      participants: people.slice(1, 4).map((p) => p.id),
    };
    const data = {
      title: "Tiền phòng",
      category: "Lưu trú",
      quantity: 1,
      unit_price: 10740000,
      note: "",
      cost_sharing: rule,
    };
    const request = mutation("budget", data),
      budget: Budget = await run(request);
    assert.deepEqual(budget.cost_sharing, rule);
    const selectedRule = {
      mode: "selected_equal" as const,
      participants: people.slice(2, 5).map((p) => p.id),
    };
    await run(
      mutation("budget", {
        ...data,
        title: "Chia được chọn",
        cost_sharing: selectedRule,
      }),
    );
    assert.deepEqual(
      allocateCost(10740000, selectedRule, people).map((p) => p.amount),
      [3580000, 3580000, 3580000],
    );
    await assert.rejects(
      run(mutation("participant", {}, "delete", people[4])),
      /PARTICIPANT_HAS_COST_SHARES/,
    );
    await assert.rejects(
      run(
        mutation("budget", {
          ...data,
          cost_sharing: { mode: "selected_equal", participants: [] },
        }),
      ),
      /INVALID_COST_SHARING/,
    );
    await assert.rejects(
      run(
        mutation("budget", {
          ...data,
          cost_sharing: {
            mode: "selected_equal",
            participants: [people[1].id, people[1].id],
          },
        }),
      ),
      /INVALID_COST_SHARING/,
    );
    await assert.rejects(
      run(
        mutation("budget", {
          ...data,
          cost_sharing: {
            mode: "selected_equal",
            participants: [randomUUID()],
          },
        }),
      ),
      /INVALID_PARTICIPANT/,
    );

    assert.deepEqual(await run(request), budget);
    await assert.rejects(
      run({ ...request, data: { ...data, title: "Changed" } }),
      /OPERATION_REUSED/,
    );
    await assert.rejects(
      run(mutation("budget", { ...data, unit_price: 1 }, "update", budget)),
      /COST_SHARING_EXCEEDS_TOTAL/,
    );
    await assert.rejects(
      run(
        mutation("budget", {
          ...data,
          cost_sharing: { ...rule, participants: [randomUUID()] },
        }),
      ),
      /INVALID_PARTICIPANT/,
    );
    await assert.rejects(
      run(mutation("participant", {}, "delete", people[0])),
      /PARTICIPANT_HAS_COST_SHARES/,
    );
    const deposit: Expense = await run(
      mutation("expense", {
        title: "Cọc 50%",
        category: "Lưu trú",
        kind: "payment",
        amount: 5370000,
        spent_on: "2026-11-01",
        budget_id: budget.id,
        payer: "WRONG NAME",
        payer_participant_id: people[0].id,
        payment_source: "personal",
        settlement_type: "direct",
        note: "",
        receipt_url: "",
      }),
    );
    assert.equal(deposit.payer, "A");
    assert.equal(deposit.settlement_type, "direct");
    const pay = costPayments(budget, [deposit], people);
    assert.equal(pay.paid.get(people[0].id), 5370000);
    assert.equal(7000000 - pay.paid.get(people[0].id)!, 1630000);
    assert.equal(pay.total, 5370000);
    assert.equal(fundTotals(emptyFund, [deposit]).outstanding, 0);
    assert.equal(
      (await db.query<any>("select count(*) n from fund_entries")).rows[0].n,
      0,
    );
    await fund("setup", { keeper: "A", note: "" });
    await fund("entry", {
      kind: "contribution",
      participant_id: people[0].id,
      amount: 1000000,
      occurred_on: "2026-11-01",
      note: "",
      method: "",
      receipt_url: "",
    });
    await assert.rejects(
      fund("entry", {
        kind: "reimbursement",
        expense_id: deposit.id,
        amount: 1,
        occurred_on: "2026-11-01",
        note: "",
        method: "",
        receipt_url: "",
      }),
      /REIMBURSEMENT_EXCEEDS_ADVANCE/,
    );
    const cash: Expense = await run(
      mutation("expense", {
        title: "Từ quỹ",
        category: "Lưu trú",
        kind: "payment",
        amount: 1,
        spent_on: "2026-11-01",
        budget_id: budget.id,
        payer: "A",
        payer_participant_id: people[0].id,
        payment_source: "fund",
        note: "",
        receipt_url: "",
      }),
    );
    assert.equal(cash.payer, "");
    assert.equal(cash.payer_participant_id, null);
    assert.equal(cash.settlement_type, "direct");
    const backup = (
      await db.query<any>("select tf_create_trip_backup($1,'v210') r", [tripId])
    ).rows[0].r;
    const copied = (
      await db.query<any>("select tf_restore_trip_backup($1,'Copy v210') r", [
        backup.id,
      ])
    ).rows[0].r;
    const copiedBudget = (
      await db.query<any>(
        "select * from budget_items where trip_id=$1 and title='Tiền phòng'",
        [copied.trip_id],
      )
    ).rows[0];
    const copiedPeople = (
      await db.query<any>("select * from trip_participants where trip_id=$1", [
        copied.trip_id,
      ])
    ).rows;
    assert.equal(
      allocateCost(10740000, copiedBudget.cost_sharing, copiedPeople).find(
        (p) => p.name === "A",
      )?.amount,
      7000000,
    );
    const copiedDeposit = (
      await db.query<any>(
        "select * from expenses where trip_id=$1 and amount=5370000",
        [copied.trip_id],
      )
    ).rows[0];
    assert.equal(
      copiedPeople.find((p: any) => p.id === copiedDeposit.payer_participant_id)
        .name,
      "A",
    );
    assert.equal(copiedDeposit.settlement_type, "direct");
    const copiedSelected = (
      await db.query<any>(
        "select * from budget_items where trip_id=$1 and title=$2",
        [copied.trip_id, "Chia được chọn"],
      )
    ).rows[0];
    const restoredShares = allocateCost(
      10740000,
      copiedSelected.cost_sharing,
      copiedPeople,
    );
    assert.equal(restoredShares.length, 3);
    assert.ok(
      restoredShares.every((p) => ["C", "D", "Excluded"].includes(p.name)),
    );

    await as(outsider);
    await assert.rejects(run(mutation("budget", data)), /FORBIDDEN/);
    await as(owner);
    await db.exec("set role postgres");
    await db.exec(
      await readFile(
        "supabase/migrations/202611010003_v2100_custom_cost_sharing.sql",
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        "supabase/migrations/202611010004_v2101_selected_cost_sharing.sql",
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        "supabase/migrations/202611010005_v2110_packing_checklist_family.sql",
        "utf8",
      ),
    );
    await as(owner);
    assert.equal(
      (await db.query<any>("select tf_release_readiness() r")).rows[0].r
        .database_version,
      "2.11.0",
    );
    assert.equal(
      (
        await db.query<any>(
          "select cost_sharing from budget_items where id=$1",
          [budget.id],
        )
      ).rows[0].cost_sharing.fixed[0].amount,
      7000000,
    );
  } finally {
    await db.close();
  }
});
