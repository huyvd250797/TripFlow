import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  transferSuggestions,
  settlementMutation,
  type SettlementData,
} from "../lib/settlement";
test("V2.13 settlement validation rejects self-transfer, decimal and missing reversal reason", () => {
  const base = { tripId: randomUUID(), operationId: randomUUID(), revision: 1 };
  const id = randomUUID();
  assert.equal(
    settlementMutation.safeParse({
      ...base,
      action: "transfer",
      data: { from_id: id, to_id: id, amount: 1, occurred_on: "2026-11-02" },
    }).success,
    false,
  );
  assert.equal(
    settlementMutation.safeParse({
      ...base,
      action: "transfer",
      data: {
        from_id: id,
        to_id: randomUUID(),
        amount: 1.1,
        occurred_on: "2026-11-02",
      },
    }).success,
    false,
  );
  assert.equal(
    settlementMutation.safeParse({
      ...base,
      action: "reversal",
      data: { reverses_id: id, note: " " },
    }).success,
    false,
  );
});
test("V2.13 SQL balances, partial transfers, replay, reversal, fund reconciliation, closure, permissions and recovery", async () => {
  const db = new PGlite(),
    owner = randomUUID(),
    viewer = randomUUID(),
    editor = randomUUID(),
    outsider = randomUUID(),
    tripId = randomUUID();
  try {
    await db.exec(
      `create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),last_sign_in_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;insert into auth.users(id,email) values('${owner}','owner@test.local'),('${viewer}','viewer@test.local'),('${editor}','editor@test.local'),('${outsider}','outsider@test.local');`,
    );
    for (const f of (await readdir("supabase/migrations"))
      .filter((x) => x.endsWith(".sql"))
      .sort())
      await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
    const actor = async (id: string) =>
      db.exec(
        `reset role;select set_config('request.jwt.claim.sub','${id}',false);select set_config('request.jwt.claims','{"sub":"${id}","email":"${id === owner ? "owner" : id === editor ? "editor" : id === viewer ? "viewer" : "outsider"}@test.local"}',false);set role authenticated;`,
      );
    await actor(owner);
    const rpc = async (name: string, args: unknown[]) =>
      (
        await db.query<any>(
          `select ${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) r`,
          args,
        )
      ).rows[0].r;
    const mutate = async (
      entity: string,
      data: object,
      action = "create",
      row = {},
    ) =>
      rpc("tf_mutate", [
        JSON.stringify({
          tripId,
          operationId: randomUUID(),
          entity,
          action,
          data,
          ...row,
        }),
      ]);
    const snapshot = async () =>
      (await rpc("tf_settlement_snapshot", [tripId])) as SettlementData;
    const settle = async (action: string, data: object, more = {}) =>
      rpc("tf_settlement_mutate", [
        JSON.stringify({
          tripId,
          operationId: randomUUID(),
          revision: (await snapshot()).revision,
          action,
          data,
          ...more,
        }),
      ]);
    const fund = async (data: object) =>
      rpc("tf_fund_mutate", [
        JSON.stringify({
          tripId,
          operationId: randomUUID(),
          action: "entry",
          data: {
            occurred_on: "2026-11-02",
            note: "",
            method: "",
            receipt_url: "",
            participant_id: "",
            expense_id: "",
            reverses_id: "",
            ...data,
          },
        }),
      ]);
    await mutate("trip", {
      name: "Quyết toán",
      destination: "Hồ Tràm",
      start_date: "2026-11-02",
      end_date: "2026-11-03",
      timezone: "Asia/Ho_Chi_Minh",
      people: 3,
      status: "planning",
      note: "",
    });
    const people: any[] = [];
    for (const name of ["A", "B", "C"])
      people.push(await mutate("participant", { name, note: "" }));
    const [a, b, c] = people;
    const budget = await mutate("budget", {
      title: "Ăn uống",
      category: "Ăn uống",
      quantity: 1,
      unit_price: 900000,
      item_id: "",
      note: "",
      cost_sharing: { mode: "equal" },
    });
    const expense = await mutate("expense", {
      title: "Bữa tối",
      category: "Ăn uống",
      amount: 900000,
      kind: "payment",
      spent_on: "2026-11-02",
      budget_id: budget.id,
      refund_of: "",
      payment_source: "personal",
      payer: "A",
      payer_participant_id: a.id,
      settlement_type: "direct",
      note: "",
      receipt_url: "",
    });
    let s = await snapshot();
    assert.deepEqual(s.issues, []);
    assert.equal(s.actual, 900000);
    assert.equal(s.rows.find((x) => x.id === a.id)?.balance, 600000);
    assert.equal(s.rows.find((x) => x.id === b.id)?.balance, -300000);
    const suggestions = transferSuggestions(s.rows);
    assert.equal(
      suggestions.reduce((n, x) => n + x.amount, 0),
      600000,
    );
    const payload = {
      tripId,
      operationId: randomUUID(),
      revision: s.revision,
      action: "transfer",
      data: {
        from_id: b.id,
        to_id: a.id,
        amount: 200000,
        occurred_on: "2026-11-02",
        note: "Đợt 1",
        receipt_url: "",
      },
    };
    const first = await rpc("tf_settlement_mutate", [JSON.stringify(payload)]);
    assert.deepEqual(
      await rpc("tf_settlement_mutate", [JSON.stringify(payload)]),
      first,
    );
    await assert.rejects(
      () =>
        rpc("tf_settlement_mutate", [
          JSON.stringify({ ...payload, data: { ...payload.data, amount: 1 } }),
        ]),
      /OPERATION_REUSED/,
    );
    s = await snapshot();
    assert.equal(s.actual, 900000);
    assert.equal(s.rows.find((x) => x.id === b.id)?.balance, -100000);
    await assert.rejects(
      () => settle("transfer", { ...payload.data, amount: 100001 }),
      /TRANSFER_EXCEEDS_BALANCE/,
    );
    await assert.rejects(
      () => settle("transfer", { ...payload.data, amount: 1 }, { revision: 0 }),
      /STALE_VERSION/,
    );
    await settle("reversal", {
      reverses_id: s.history.find((x) => x.kind === "transfer")!.id,
      note: "Nhập nhầm",
    });
    s = await snapshot();
    assert.equal(s.rows.find((x) => x.id === b.id)?.balance, -300000);
    // Owner grants new permission; viewer cannot mutate and editor cannot self-grant.
    await db.exec(
      `reset role;insert into public.trip_members(trip_id,user_id,role,email) values('${tripId}','${viewer}','viewer','viewer@test.local'),('${tripId}','${editor}','editor','editor@test.local');set role authenticated;`,
    );
    await actor(viewer);
    await assert.rejects(() => settle("transfer", payload.data), /READ_ONLY/);
    await actor(outsider);
    await assert.rejects(snapshot, /FORBIDDEN/);
    const hidden = await db.query("select * from settlement_entries");
    assert.equal(hidden.rows.length, 0);
    await actor(editor);
    await assert.rejects(() => settle("close", {}), /PERMISSION_DENIED/);
    await actor(owner);
    // Expense closed against participant transfers; no extra real expenses.
    await settle("transfer", { ...payload.data, amount: 300000 });
    await settle("transfer", {
      ...payload.data,
      from_id: c.id,
      amount: 300000,
    });
    s = await settle("close", { note: "Đã đối chiếu" });
    assert.ok(s.closed_at);
    await assert.rejects(
      () =>
        mutate("expense", {
          title: "Khác",
          category: "Khác",
          amount: 1,
          kind: "payment",
          spent_on: "2026-11-02",
          budget_id: "",
          refund_of: "",
          payer: "A",
          note: "",
          receipt_url: "",
        }),
      /SETTLEMENT_CLOSED/,
    );
    await assert.rejects(
      () =>
        rpc("tf_fund_mutate", [
          JSON.stringify({
            tripId,
            operationId: randomUUID(),
            action: "setup",
            data: { keeper: "A", note: "" },
          }),
        ]),
      /SETTLEMENT_CLOSED/,
    );
    // Backup of closed ledger restores remapped participants and transactions.
    const backup = await rpc("tf_create_trip_backup", [tripId, "Closed"]);
    const restored = await rpc("tf_restore_trip_backup", [
      backup.id,
      "Bản sao",
    ]);
    const rs = (await rpc("tf_settlement_snapshot", [
      restored.trip_id,
    ])) as SettlementData;
    assert.ok(rs.closed_at);
    assert.equal(rs.history.length, s.history.length);
    assert.ok(rs.rows.every((x) => x.balance === 0));
    assert.ok(rs.rows.every((x) => !people.some((p) => p.id === x.id)));
    await settle("reopen", { note: "Bổ sung chi phí" });
    // Shared fund return uses the existing fund ledger exactly once.
    await rpc("tf_fund_mutate", [
      JSON.stringify({
        tripId,
        operationId: randomUUID(),
        action: "setup",
        data: { keeper: "A", note: "" },
      }),
    ]);
    await fund({ kind: "contribution", participant_id: a.id, amount: 60000 });
    s = await snapshot();
    assert.equal(s.fund_balance, 60000);
    assert.equal(s.rows.find((x) => x.id === a.id)?.balance, 60000);
    await settle("fund_return", {
      participant_id: a.id,
      amount: 60000,
      occurred_on: "2026-11-02",
      note: "Trả dư",
      receipt_url: "",
    });
    s = await snapshot();
    assert.equal(s.fund_balance, 0);
    assert.equal(s.actual, 900000);
    assert.ok(s.rows.every((x) => x.balance === 0));
    // Mixed fund + personal advance: partial reimbursement and transfers balance exactly.
    const t2 = randomUUID();
    const m2 = (entity: string, data: object) =>
      rpc("tf_mutate", [
        JSON.stringify({
          tripId: t2,
          operationId: randomUUID(),
          entity,
          action: "create",
          data,
        }),
      ]);
    await m2("trip", {
      name: "Quỹ hỗn hợp",
      destination: "Hồ Tràm",
      start_date: "2026-11-02",
      end_date: "2026-11-03",
      timezone: "Asia/Ho_Chi_Minh",
      people: 3,
      status: "planning",
      note: "",
    });
    const aa = await m2("participant", { name: "A", note: "" }),
      bb = await m2("participant", { name: "B", note: "" }),
      cc = await m2("participant", { name: "C", note: "" });
    const bu = await m2("budget", {
      title: "Ăn",
      category: "Ăn uống",
      quantity: 1,
      unit_price: 600000,
      note: "",
      cost_sharing: { mode: "equal" },
    });
    await m2("expense", {
      title: "B ứng",
      category: "Ăn uống",
      amount: 600000,
      kind: "payment",
      spent_on: "2026-11-02",
      budget_id: bu.id,
      payer: "B",
      payer_participant_id: bb.id,
      settlement_type: "advance",
      note: "",
      receipt_url: "",
    });
    await rpc("tf_fund_mutate", [
      JSON.stringify({
        tripId: t2,
        operationId: randomUUID(),
        action: "setup",
        data: { keeper: "A", note: "" },
      }),
    ]);
    await rpc("tf_fund_mutate", [
      JSON.stringify({
        tripId: t2,
        operationId: randomUUID(),
        action: "entry",
        data: {
          kind: "contribution",
          participant_id: aa.id,
          amount: 900000,
          occurred_on: "2026-11-02",
          note: "",
          receipt_url: "",
        },
      }),
    ]);
    const snap2 = async () =>
      rpc("tf_settlement_snapshot", [t2]) as Promise<SettlementData>;
    const set2 = async (action: string, data: object) =>
      rpc("tf_settlement_mutate", [
        JSON.stringify({
          tripId: t2,
          operationId: randomUUID(),
          revision: (await snap2()).revision,
          action,
          data,
        }),
      ]);
    let mix = await snap2();
    assert.equal(mix.rows.find((x) => x.id === bb.id)?.balance, 400000);
    mix = await set2("reimbursement", {
      expense_id: (
        await db.query<any>("select id from expenses where trip_id=$1", [t2])
      ).rows[0].id,
      amount: 400000,
      occurred_on: "2026-11-02",
      note: "Hoàn phần dư",
      receipt_url: "",
    });
    assert.equal(mix.fund_balance, 500000);
    assert.equal(mix.actual, 600000);
    assert.equal(mix.rows.find((x) => x.id === bb.id)?.balance, 0);
    await set2("transfer", {
      from_id: cc.id,
      to_id: aa.id,
      amount: 200000,
      occurred_on: "2026-11-02",
      note: "",
      receipt_url: "",
    });
    await set2("fund_return", {
      participant_id: aa.id,
      amount: 500000,
      occurred_on: "2026-11-02",
      note: "",
      receipt_url: "",
    });
    mix = await snap2();
    assert.equal(mix.fund_balance, 0);
    assert.ok(mix.rows.every((x) => x.balance === 0));
    assert.equal(mix.actual, 600000);
    await set2("close", {});
    // Grants are independent of budget closing and cannot be self-elevated.
    const member = (
      await db.query<any>(
        "select * from trip_members where trip_id=$1 and user_id=$2",
        [tripId, editor],
      )
    ).rows[0];
    await actor(editor);
    await assert.rejects(
      () =>
        mutate(
          "member",
          { role: "editor", can_close_settlement: true },
          "update",
          { id: member.id, version: member.version },
        ),
      /PERMISSION_GRANT_OWNER_ONLY/,
    );
    await actor(owner);
    const granted = await mutate(
      "member",
      { role: "editor", can_close_settlement: true },
      "update",
      { id: member.id, version: member.version },
    );
    await actor(editor);
    const perms = await rpc("tf_trip_permissions", [tripId]);
    assert.equal(perms.can_close_settlement, true);
    assert.equal(perms.can_close_budget, false);
    await actor(owner);
    const invitation = await mutate("invitation", {
      email: "outsider@test.local",
      role: "editor",
      can_close_settlement: true,
    });
    await actor(outsider);
    await mutate("invitation", { token: invitation.token }, "accept");
    assert.equal(
      (await rpc("tf_trip_permissions", [tripId])).can_close_settlement,
      true,
    );
    await actor(owner);
    await assert.rejects(
      () =>
        db.query(
          "update settlement_entries set note='bypass' where trip_id=$1",
          [tripId],
        ),
      /permission denied/,
    );
    // Re-running the new migration keeps all entries and the closed state.
    await db.exec("reset role");
    await db.exec(
      await readFile(
        "supabase/migrations/202611020001_v2130_group_settlement.sql",
        "utf8",
      ),
    );
    await actor(owner);
    assert.ok((await snap2()).closed_at);
    assert.equal((await snap2()).actual, 600000);
    // Full fixed share and 50% deposit preserve the agreed 7m / remainder split.
    const fixed = await mutate("budget", {
      title: "Phòng",
      category: "Lưu trú",
      quantity: 1,
      unit_price: 10740000,
      item_id: "",
      note: "",
      cost_sharing: {
        mode: "fixed_remainder",
        fixed: [{ participant_id: a.id, amount: 7000000 }],
        participants: [b.id, c.id],
      },
    });
    const deposit = await mutate("expense", {
      title: "Cọc",
      category: "Lưu trú",
      amount: 5370000,
      kind: "payment",
      spent_on: "2026-11-02",
      budget_id: fixed.id,
      refund_of: "",
      payment_source: "personal",
      payer: "A",
      payer_participant_id: a.id,
      settlement_type: "direct",
      note: "",
      receipt_url: "",
    });
    s = await snapshot();
    assert.equal(
      s.details.find(
        (x) =>
          x.kind === "share" && x.id === fixed.id && x.participant_id === a.id,
      )?.amount,
      3500000,
    );
    assert.equal(s.unpaid, 5370000);
    await assert.rejects(() => settle("close", {}), /SETTLEMENT_NOT_READY/);
    // Refund changes actual, never adds fund/transfer cash as another expense.
    await mutate("expense", {
      title: "Hoàn cọc",
      category: "Lưu trú",
      amount: 5370000,
      kind: "refund",
      spent_on: "2026-11-02",
      budget_id: fixed.id,
      refund_of: deposit.id,
      payer: "A",
      note: "",
      receipt_url: "",
    });
    s = await snapshot();
    assert.equal(s.actual, 900000);
    // Missing sharing is visible and blocks action, not silently divided.
    await mutate("expense", {
      title: "Chưa liên kết",
      category: "Khác",
      amount: 10,
      kind: "payment",
      spent_on: "2026-11-02",
      budget_id: "",
      refund_of: "",
      payer: "A",
      payer_participant_id: a.id,
      note: "",
      receipt_url: "",
    });
    s = await snapshot();
    assert.ok(s.issues.some((x) => x.code === "UNLINKED_EXPENSE"));
    await assert.rejects(
      () => settle("transfer", { ...payload.data, amount: 1 }),
      /SETTLEMENT_INCOMPLETE/,
    );
  } finally {
    await db.close();
  }
});
