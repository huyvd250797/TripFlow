import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fundTotals, fundMutation, type FundData } from "../lib/fund";
import type { Expense } from "../lib/types";
import { DATABASE_VERSION } from "../lib/types";
test("V2.9 fund transactions preserve cash, permissions, expense accounting and replay safety", async (t) => {
  const db = new PGlite(),
    owner = randomUUID(),
    editor = randomUUID(),
    viewer = randomUUID(),
    outsider = randomUUID(),
    tid = randomUUID();
  const as = async (id = owner) =>
    db.exec(
      `set role postgres;select set_config('request.jwt.claim.sub','${id}',false);select set_config('request.jwt.claims','${JSON.stringify({ sub: id, email: id + "@test.local" })}',false);set role authenticated;`,
    );
  const core = async (
    entity: string,
    action: string,
    data: object = {},
    row: object = {},
  ) =>
    (
      await db.query<any>("select tf_mutate($1::jsonb) r", [
        JSON.stringify({
          tripId: tid,
          operationId: randomUUID(),
          entity,
          action,
          data,
          ...row,
        }),
      ])
    ).rows[0].r;
  const run = async (p: object) =>
    (
      await db.query<any>("select tf_fund_mutate($1::jsonb) r", [
        JSON.stringify({ tripId: tid, operationId: randomUUID(), ...p }),
      ])
    ).rows[0].r;
  const entry = async (kind: string, amount: number, extra: object = {}) =>
    run({
      action: "entry",
      data: { kind, amount, occurred_on: "2026-11-01", ...extra },
    });
  const balance = async () =>
    Number(
      (
        await db.query<any>(
          `select coalesce(sum(case when kind='contribution' then amount else -amount end),0) n from fund_entries e where trip_id=$1 and kind<>'reversal' and not exists(select 1 from fund_entries r where r.reverses_id=e.id)`,
          [tid],
        )
      ).rows[0].n,
    ) -
    Number(
      (
        await db.query<any>(
          `select coalesce(sum(case when kind='refund' then -amount else amount end),0) n from expenses where trip_id=$1 and deleted_at is null and payment_source='fund'`,
          [tid],
        )
      ).rows[0].n,
    );
  const exp = (source = "personal", amount = 300) => ({
    title: "Bữa trưa",
    category: "Ăn uống",
    kind: "payment",
    amount,
    payment_source: source,
    spent_on: "2026-11-01",
    payer: "Mai",
    note: "",
    receipt_url: "",
  });
  try {
    await db.exec(
      `create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),last_sign_in_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;`,
    );
    for (const id of [owner, editor, viewer, outsider])
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        id,
        id + "@test.local",
      ]);
    for (const name of (await readdir("supabase/migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort())
      await db.exec(await readFile("supabase/migrations/" + name, "utf8"));
    await as();
    await core("trip", "create", {
      name: "Quỹ",
      destination: "Hồ Tràm",
      start_date: "2026-11-01",
      end_date: "2026-11-03",
      timezone: "Asia/Ho_Chi_Minh",
      people: 2,
      status: "planning",
      note: "",
    });
    await db.exec(
      `set role postgres;insert into trip_members(trip_id,user_id,email,role) values('${tid}','${editor}','e@test.local','editor'),('${tid}','${viewer}','v@test.local','viewer');`,
    );
    await as();
    const person = await core("participant", "create", {
      name: "Mai",
      note: "",
    });
    await t.test(
      "setup, targets, contribution retries and stale edits",
      async () => {
        const setup = await run({
          action: "setup",
          data: { keeper: "Mai", note: "Quỹ chung" },
        });
        assert.equal(setup.version, 1);
        await assert.rejects(
          run({ action: "setup", version: 0, data: { keeper: "Khác" } }),
          /STALE_VERSION/,
        );
        await run({
          action: "target",
          data: {
            participant_id: person.id,
            amount: 1000,
            due_on: "2026-11-01",
          },
        });
        const p = {
          action: "entry",
          operationId: randomUUID(),
          data: {
            kind: "contribution",
            participant_id: person.id,
            amount: 1000,
            occurred_on: "2026-11-01",
          },
        };
        const a = await run(p);
        assert.deepEqual(await run(p), a);
        await assert.rejects(
          run({ ...p, data: { ...p.data, amount: 999 } }),
          /OPERATION_REUSED/,
        );
        assert.equal(await balance(), 1000);
      },
    );
    let fundExpense: any, personal: any, reimbursement: any;
    await t.test(
      "fund and personal payments, refunds and reimbursements count expense once",
      async () => {
        fundExpense = await core("expense", "create", exp("fund", 400), {
          id: randomUUID(),
        });
        assert.equal(fundExpense.payment_source, "fund");
        assert.equal(await balance(), 600);
        personal = await core("expense", "create", exp("personal", 300), {
          id: randomUUID(),
        });
        assert.equal(await balance(), 600);
        reimbursement = await entry("reimbursement", 200, {
          expense_id: personal.id,
        });
        assert.equal(await balance(), 400);
        const net = (
          await db.query<any>(
            "select sum(case when kind='refund' then -amount else amount end)::int n from expenses where deleted_at is null",
          )
        ).rows[0].n;
        assert.equal(net, 700);
        const refund = await core(
          "expense",
          "create",
          {
            ...exp("personal", 100),
            kind: "refund",
            refund_of: fundExpense.id,
          },
          { id: randomUUID() },
        );
        assert.equal(refund.payment_source, "fund");
        assert.equal(await balance(), 500);
        await assert.rejects(
          entry("reimbursement", 101, { expense_id: personal.id }),
          /REIMBURSEMENT_EXCEEDS_ADVANCE/,
        );
        await assert.rejects(
          core("expense", "create", exp("fund", 501), { id: randomUUID() }),
          /FUND_INSUFFICIENT/,
        );
        assert.equal(await balance(), 500);
      },
    );
    await t.test(
      "changes cannot invalidate previous reimbursements or funded cash",
      async () => {
        for (const [action, data] of [
          ["delete", {}],
          ["update", exp("personal", 199)],
          ["update", exp("fund", 300)],
        ] as const)
          await assert.rejects(
            core("expense", action, data, {
              id: personal.id,
              version: personal.version,
            }),
            /REIMBURSEMENT_EXCEEDS_ADVANCE/,
          );
        await assert.rejects(
          core(
            "expense",
            "create",
            { ...exp("personal", 101), kind: "refund", refund_of: personal.id },
            { id: randomUUID() },
          ),
          /REIMBURSEMENT_EXCEEDS_ADVANCE/,
        );
        const contribution = (
          await db.query<any>(
            "select * from fund_entries where kind='contribution'",
          )
        ).rows[0];
        await assert.rejects(
          entry("reversal", 1, { reverses_id: contribution.id }),
          /FUND_INSUFFICIENT/,
        );
        const { payment_source, ...legacy } = exp("fund", 300);
        const updated = await core("expense", "update", legacy, {
          id: personal.id,
          version: personal.version,
        });
        assert.equal(updated.payment_source, "personal");
        personal = updated;
      },
    );
    await t.test("returns, immutable ledger and reversal limits", async () => {
      const returned = await entry("return", 100, {
        participant_id: person.id,
      });
      assert.equal(await balance(), 400);
      const reversed = await entry("reversal", 1, { reverses_id: returned.id });
      assert.equal(reversed.amount, 100);
      assert.equal(await balance(), 500);
      await assert.rejects(
        entry("reversal", 1, { reverses_id: returned.id }),
        /unique|duplicate/,
      );
      await assert.rejects(
        entry("return", 1001, { participant_id: person.id }),
        /FUND_INSUFFICIENT|RETURN_EXCEEDS_CONTRIBUTION/,
      );
      await assert.rejects(
        db.query("update fund_entries set amount=1"),
        /permission denied/,
      );
      await entry("reversal", 1, { reverses_id: reimbursement.id });
      assert.equal(await balance(), 700);
      await core(
        "expense",
        "delete",
        {},
        { id: personal.id, version: personal.version },
      );
    });
    await t.test(
      "RLS, editor/viewer boundaries, deactivation and old RPC bypass",
      async () => {
        await as(editor);
        await entry("contribution", 1, { participant_id: person.id });
        for (const id of [viewer, outsider]) {
          await as(id);
          await assert.rejects(
            entry("contribution", 1, { participant_id: person.id }),
            /READ_ONLY|FORBIDDEN/,
          );
          assert.equal(
            (await db.query<any>("select count(*)::int n from trip_funds"))
              .rows[0].n,
            id === viewer ? 1 : 0,
          );
          await assert.rejects(
            db.query("select tf_mutate_v280('{}')"),
            /permission denied/,
          );
        }
        await db.exec(
          `set role postgres;insert into tf_user_accounts(user_id,status) values('${editor}','deactivated') on conflict(user_id) do update set status='deactivated';`,
        );
        await as(editor);
        await assert.rejects(
          entry("contribution", 1, { participant_id: person.id }),
          /FORBIDDEN|ACCOUNT_DEACTIVATED/,
        );
        assert.equal(
          (await db.query<any>("select count(*)::int n from fund_entries"))
            .rows[0].n,
          0,
        );
        await as();
      },
    );
    await t.test(
      "recovery rejects insufficient cash and backup restores full cashbook with remapped references",
      async () => {
        const e = await core("expense", "create", exp("fund", 100), {
          id: randomUUID(),
        });
        await core("expense", "delete", {}, { id: e.id, version: e.version });
        const cash = await balance();
        const ret = await entry("return", cash, { participant_id: person.id });
        await assert.rejects(
          db.query("select tf_restore_deleted($1,$2,$3)", [
            tid,
            "expense",
            e.id,
          ]),
          /FUND_INSUFFICIENT/,
        );
        await entry("reversal", 1, { reverses_id: ret.id });
        await db.query("select tf_restore_deleted($1,$2,$3)", [
          tid,
          "expense",
          e.id,
        ]);
        assert.equal(await balance(), cash - 100);
        const backup = (
          await db.query<any>(
            "select tf_create_trip_backup($1,'Fund backup') r",
            [tid],
          )
        ).rows[0].r;
        const restored = (
          await db.query<any>(
            "select tf_restore_trip_backup($1,'Restored fund') r",
            [backup.id],
          )
        ).rows[0].r;
        const read = async (table: string, id: string) =>
          (await db.query<any>(`select * from ${table} where trip_id=$1`, [id]))
            .rows;
        const originalEntries = await read("fund_entries", tid),
          copyEntries = await read("fund_entries", restored.trip_id);
        assert.equal(copyEntries.length, originalEntries.length);
        assert.ok(
          copyEntries.every((e) => !originalEntries.some((o) => o.id === e.id)),
        );
        const fund = (await read("trip_funds", restored.trip_id))[0];
        assert.equal(fund.keeper, "Mai");
        const copyData = {
          fund,
          entries: copyEntries,
          targets: await read("fund_targets", restored.trip_id),
        };
        const copyExpenses = (await read("expenses", restored.trip_id)).filter(
          (e) => !e.deleted_at,
        );
        assert.equal(
          fundTotals(copyData, copyExpenses).balance,
          await balance(),
        );
        assert.equal(
          copyExpenses.filter((e) => e.payment_source === "fund").length,
          3,
        );
        const target = copyData.targets[0];
        assert.ok(
          (await read("trip_participants", restored.trip_id)).some(
            (p) => p.id === target.participant_id,
          ),
        );
      },
    );
    await t.test("migration rerun preserves ledger and readiness", async () => {
      const count = (
        await db.query<any>("select count(*)::int n from fund_entries")
      ).rows[0].n;
      await db.exec("set role postgres");
      await db.exec(
        await readFile(
          "supabase/migrations/202611010002_v290_trip_fund.sql",
          "utf8",
        ),
      );
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
      await as();
      const r = (await db.query<any>("select tf_release_readiness() r")).rows[0]
        .r;
      assert.equal(r.ready, true);
      assert.equal(r.database_version, DATABASE_VERSION);
      assert.equal(
        (await db.query<any>("select count(*)::int n from fund_entries"))
          .rows[0].n,
        count,
      );
    });
  } finally {
    await db.close();
  }
});
test("V2.9 client totals separate fund cash from personal advances", () => {
  const data: FundData = {
    fund: null,
    targets: [],
    entries: [
      { id: "c", kind: "contribution", amount: 1000, participant_id: "p" },
      { id: "r", kind: "reimbursement", amount: 100, expense_id: "e" },
      { id: "x", kind: "return", amount: 50, participant_id: "p" },
    ] as any,
  };
  const expenses = [
    { id: "e", kind: "payment", payment_source: "personal", amount: 300 },
    { id: "f", kind: "payment", payment_source: "fund", amount: 200 },
    {
      id: "h",
      kind: "refund",
      payment_source: "fund",
      refund_of: "f",
      amount: 50,
    },
  ] as Expense[];
  const totals = fundTotals(data, expenses);
  assert.equal(totals.balance, 700);
  assert.equal(totals.outstanding, 200);
  assert.equal(totals.fundSpent, 150);
  assert.equal(
    fundMutation.safeParse({
      action: "entry",
      tripId: randomUUID(),
      operationId: randomUUID(),
      data: { kind: "contribution", amount: -1, occurred_on: "2026-11-01" },
    }).success,
    false,
  );
});
