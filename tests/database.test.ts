import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
const owner = randomUUID(),
  editor = randomUUID(),
  viewer = randomUUID(),
  stranger = randomUUID();
const db = new PGlite();
let tripId = randomUUID();
async function asUser(id: string, email = id + "@test.local") {
  await db.exec(
    `set role postgres; select set_config('request.jwt.claim.sub','${id}',false); select set_config('request.jwt.claims','${JSON.stringify({ sub: id, email })}',false);set role authenticated;`,
  );
}
async function mutation(
  entity: string,
  action: string,
  data: object = {},
  row?: Record<string, any>,
  tid = tripId,
  op = randomUUID(),
) {
  return (
    await db.query<{ result: Record<string, any> }>(
      "select public.tf_mutate($1::jsonb) as result",
      [
        JSON.stringify({
          entity,
          action,
          data,
          tripId: tid,
          operationId: op,
          ...row,
        }),
      ],
    )
  ).rows[0].result;
}
async function rows(table: string) {
  return (await db.query<Record<string, any>>("select * from public." + table))
    .rows;
}
test("PostgreSQL schema, RLS, CRUD, refunds, idempotency and atomic check-in", async () => {
  await db.exec(
    `create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),last_sign_in_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;insert into auth.users(id,email) values('${owner}','${owner}@test.local'),('${editor}','${editor}@test.local'),('${viewer}','${viewer}@test.local'),('${stranger}','${stranger}@test.local');`,
  );
  await db.exec(
    await readFile("supabase/migrations/202609250001_tripflow.sql", "utf8"),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/202609270001_v020_offline_master_admin.sql",
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/202609270002_v030_finance_reporting_integrity.sql",
      "utf8",
    ),
  );
  await asUser(owner);
  const trip = await mutation("trip", "create", {
    name: "Test cloud",
    destination: "Đà Lạt",
    start_date: "2026-09-25",
    end_date: "2026-09-27",
    timezone: "Asia/Ho_Chi_Minh",
    people: 2,
    status: "planning",
    note: "",
  });
  assert.equal(trip.name, "Test cloud");
  await assert.rejects(
    db.query(
      "insert into public.trips(name,owner_id,start_date,end_date) values('Bypass',$1,'2026-09-25','2026-09-27')",
      [owner],
    ),
    /permission denied/,
  );
  const item = await mutation("item", "create", {
    title: "Nhận phòng",
    location: "Khách sạn",
    start_at: "2026-09-25T07:00:00Z",
    end_at: "2026-09-25T08:00:00Z",
    note: "",
    map_url: "",
  });
  await assert.rejects(
    mutation("item", "create", {
      title: "Sai ngày",
      start_at: "2026-09-28T07:00:00Z",
      end_at: "2026-09-28T08:00:00Z",
    }),
    /ITEM_OUTSIDE_TRIP/,
  );
  const budget = await mutation("budget", "create", {
    title: "Khách sạn",
    category: "Lưu trú",
    quantity: 2,
    unit_price: 500000,
    item_id: item.id,
    note: "",
  });
  assert.equal(budget.amount, 1000000);
  const op = randomUUID(),
    cost = {
      title: "Đặt cọc",
      category: "Lưu trú",
      kind: "payment",
      amount: 300000,
      spent_on: "2026-09-25",
      budget_id: budget.id,
      payer: "Tôi",
      note: "",
      receipt_url: "",
    };
  const expense = await mutation(
    "expense",
    "create",
    cost,
    undefined,
    tripId,
    op,
  );
  const duplicate = await mutation(
    "expense",
    "create",
    cost,
    undefined,
    tripId,
    op,
  );
  assert.equal(expense.id, duplicate.id);
  assert.equal((await rows("expenses")).length, 1);
  await assert.rejects(
    mutation(
      "expense",
      "create",
      { ...cost, amount: 400000 },
      undefined,
      tripId,
      op,
    ),
    /OPERATION_REUSED/,
  );
  const second = await mutation("expense", "create", {
    ...cost,
    title: "Thanh toán",
    amount: 800000,
  });
  assert.equal(
    (await rows("expenses")).reduce((s, x) => s + Number(x.amount), 0),
    1100000,
  );
  await mutation("snapshot", "create", { title: "Dự toán trước chuyến đi" });
  const baseline = (await rows("budget_snapshots"))[0];
  assert.equal(baseline.data[0].amount, 1000000);
  assert.equal(baseline.snapshot_no, 1);
  assert.equal(baseline.snapshot_kind, "baseline");
  assert.equal(Number(baseline.total_amount), 1000000);
  await db.exec("set role postgres;");
  await assert.rejects(
    db.query("update public.budget_snapshots set title='Không được sửa' where id=$1", [baseline.id]),
    /SNAPSHOT_IMMUTABLE/,
  );
  await asUser(owner);
  const refund = await mutation("expense", "create", {
    ...cost,
    title: "Hoàn tiền",
    kind: "refund",
    refund_of: expense.id,
    amount: 100000,
  });
  assert.equal(refund.category, "Lưu trú");
  await assert.rejects(
    mutation("expense", "create", {
      ...cost,
      kind: "refund",
      refund_of: expense.id,
      amount: 200001,
    }),
    /REFUND_EXCEEDED/,
  );
  const financeReport = (
    await db.query<{ result: Record<string, any> }>(
      "select public.tf_finance_report($1) as result",
      [tripId],
    )
  ).rows[0].result;
  assert.equal(Number(financeReport.totals.original_budget), 1000000);
  assert.equal(Number(financeReport.totals.current_budget), 1000000);
  assert.equal(Number(financeReport.totals.gross_payments), 1100000);
  assert.equal(Number(financeReport.totals.refunds), 100000);
  assert.equal(Number(financeReport.totals.net_actual), 1000000);
  assert.equal(financeReport.integrity.status, "ok");

  await assert.rejects(
    mutation("expense", "delete", {}, expense),
    /HAS_REFUNDS/,
  );
  await mutation("expense", "update", { ...cost, amount: 700000 }, second);
  await assert.rejects(
    mutation("expense", "update", { ...cost, amount: 600000 }, second),
    /CONFLICT/,
  );
  const item2 = await mutation("item", "create", {
    title: "Ăn tối",
    start_at: "2026-09-25T10:00:00Z",
    end_at: "2026-09-25T11:00:00Z",
  });
  await mutation("item", "status", { status: "active" }, item);
  await assert.rejects(
    mutation("item", "status", { status: "active" }, item2),
    /ACTIVE_CHANGED/,
  );
  await mutation(
    "item",
    "status",
    { status: "active", previous_id: item.id },
    item2,
  );
  assert.equal(
    (await rows("itinerary_items")).filter((x) => x.status === "active").length,
    1,
  );
  assert.equal(
    (await rows("itinerary_items")).find((x) => x.id === item.id)?.status,
    "done",
  );
  const media = await mutation("media", "create", {
    title: "Album",
    url: "https://drive.google.com/drive/my-drive",
    kind: "album",
    item_id: item.id,
  });
  assert.ok(media.id);
  const inv = await mutation("invitation", "create", {
    email: editor + "@test.local",
    role: "editor",
  });
  await asUser(stranger);
  assert.equal((await rows("trips")).length, 0);
  assert.equal((await rows("expenses")).length, 0);
  await assert.rejects(mutation("expense", "create", cost), /FORBIDDEN/);
  await assert.rejects(
    mutation("invitation", "accept", { token: inv.token }),
    /INVITE_EMAIL_MISMATCH/,
  );
  await asUser(editor);
  await mutation("invitation", "accept", { token: inv.token });
  assert.equal((await rows("trips")).length, 1);
  await mutation("participant", "create", { name: "Bé Bún", note: "" });
  await assert.rejects(
    mutation("invitation", "create", { email: "a@test.local", role: "viewer" }),
    /OWNER_ONLY/,
  );
  await asUser(owner);
  const inv2 = await mutation("invitation", "create", {
    email: viewer + "@test.local",
    role: "viewer",
  });
  await asUser(viewer);
  await mutation("invitation", "accept", { token: inv2.token });
  assert.equal((await rows("expenses")).length, 3);
  await assert.rejects(
    mutation("budget", "create", {
      title: "No",
      category: "Khác",
      quantity: 1,
      unit_price: 1,
    }),
    /READ_ONLY/,
  );
  await asUser(owner);
  await mutation("budget", "delete", {}, budget);
  assert.equal(
    (await rows("expenses")).every((x) => x.budget_id === null),
    true,
  );
  assert.equal((await rows("expenses")).length, 3);
  const updated = (await rows("itinerary_items")).find(
    (x) => x.id === item.id,
  )!;
  await mutation("item", "delete", {}, updated);
  assert.equal((await rows("media_links"))[0].item_id, null);
  const otherId = randomUUID();
  await mutation(
    "trip",
    "create",
    {
      name: "Chuyến khác",
      destination: "",
      start_date: "2026-09-25",
      end_date: "2026-09-27",
      timezone: "Asia/Ho_Chi_Minh",
      people: 1,
      status: "planning",
      note: "",
    },
    undefined,
    otherId,
  );
  await assert.rejects(
    mutation(
      "budget",
      "create",
      {
        title: "Liên kết sai",
        category: "Khác",
        quantity: 1,
        unit_price: 1,
        item_id: item2.id,
      },
      undefined,
      otherId,
    ),
    /INVALID_LINK/,
  );
  const member = (await rows("trip_members")).find(
    (m) => m.user_id === editor,
  )!;
  await mutation("member", "delete", {}, member);
  await asUser(editor);
  assert.equal((await rows("trips")).length, 0);
  await assert.rejects(
    mutation("participant", "create", { name: "Không được phép" }),
    /FORBIDDEN/,
  );
  await asUser(owner);
  assert.ok((await rows("audit_logs")).length > 10);

  // V0.2.0 master administration and account gate. Master is provisioned only
  // from trusted SQL/admin tooling, never from the client.
  await db.exec(
    `set role postgres;insert into public.tf_user_accounts(user_id,role,status) values('${owner}','master','active');set role authenticated;`,
  );
  await asUser(owner);
  const adminOverview = (
    await db.query<{ result: Record<string, any> }>(
      "select public.tf_admin_overview('') as result",
    )
  ).rows[0].result;
  assert.equal(adminOverview.stats.total, 4);
  await db.query("select public.tf_admin_set_user_status($1,'deactivated')", [
    viewer,
  ]);
  await asUser(viewer);
  const account = (
    await db.query<{ result: Record<string, any> }>(
      "select public.tf_account_state() as result",
    )
  ).rows[0].result;
  assert.equal(account.status, "deactivated");
  assert.equal((await rows("trips")).length, 0);
  await assert.rejects(
    mutation("participant", "create", { name: "Blocked" }),
    /ACCOUNT_DEACTIVATED/,
  );
  await asUser(owner);
  await db.query("select public.tf_admin_set_user_status($1,'active')", [viewer]);

  await db.close();
});
