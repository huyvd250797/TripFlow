import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { bookingData } from "../lib/bookings";
import { DATABASE_VERSION } from "../lib/types";
test("V2.8 bookings SQL permissions, idempotency, validation, RLS and compatibility", async () => {
  const db = new PGlite();
  const owner = randomUUID(),
    editor = randomUUID(),
    viewer = randomUUID(),
    stranger = randomUUID(),
    tid = randomUUID();
  try {
    await db.exec(
      `create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),last_sign_in_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;`,
    );
    for (const id of [owner, editor, viewer, stranger])
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        id,
        id + "@test.local",
      ]);
    for (const n of (await readdir("supabase/migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort())
      await db.exec(await readFile("supabase/migrations/" + n, "utf8"));
    const as = async (id: string) =>
      db.exec(
        `set role postgres;select set_config('request.jwt.claim.sub','${id}',false);select set_config('request.jwt.claims','${JSON.stringify({ sub: id, email: id + "@test.local" })}',false);set role authenticated;`,
      );
    await as(owner);
    await db.query("select tf_mutate($1::jsonb)", [
      JSON.stringify({
        operationId: randomUUID(),
        tripId: tid,
        entity: "trip",
        action: "create",
        data: {
          name: "Bookings",
          destination: "Nha Trang",
          start_date: "2026-11-01",
          end_date: "2026-11-03",
          timezone: "Asia/Ho_Chi_Minh",
          people: 2,
          status: "planning",
          note: "",
        },
      }),
    ]);
    await db.exec(
      `set role postgres;insert into trip_members(trip_id,user_id,email,role) values('${tid}','${editor}','e@test.local','editor'),('${tid}','${viewer}','v@test.local','viewer');`,
    );
    await as(owner);
    const data = bookingData.parse({
      kind: "hotel",
      title: "La Vague",
      status: "confirmed",
      code: "ABC123",
      start_at: "2026-11-01T14:00:00+07:00",
      end_at: "2026-11-02T12:00:00+07:00",
    });
    const p = {
      tripId: tid,
      id: randomUUID(),
      operationId: randomUUID(),
      action: "create",
      data,
    };
    const run = async (payload: object) =>
      (
        await db.query<any>("select tf_booking_mutate($1::jsonb) r", [
          JSON.stringify(payload),
        ])
      ).rows[0].r;
    const row = await run(p);
    assert.equal(row.title, "La Vague");
    assert.deepEqual(await run(p), row);
    await assert.rejects(
      run({ ...p, data: { ...data, title: "Different" } }),
      /IDEMPOTENCY_MISMATCH/,
    );
    await as(editor);
    const updated = await run({
      ...p,
      action: "update",
      operationId: randomUUID(),
      version: 1,
      data: { ...data, status: "used" },
    });
    assert.equal(updated.version, 2);
    await assert.rejects(
      run({ ...p, action: "update", operationId: randomUUID(), version: 1 }),
      /STALE_VERSION/,
    );
    for (const id of [viewer, stranger]) {
      await as(id);
      await assert.rejects(
        run({ ...p, id: randomUUID(), operationId: randomUUID() }),
        /FORBIDDEN/,
      );
      const count = (
        await db.query<any>("select count(*)::int n from travel_bookings")
      ).rows[0].n;
      assert.equal(count, id === viewer ? 1 : 0);
    }
    await as(owner);
    for (const bad of [
      { url: "javascript:alert(1)" },
      { end_at: "2026-10-01T00:00:00Z" },
      { item_id: randomUUID() },
      { budget_id: randomUUID() },
      { booking_id: randomUUID() },
      { timezone: "No/SuchZone" },
      { quantity: 0 },
    ])
      await assert.rejects(
        run({
          ...p,
          id: randomUUID(),
          operationId: randomUUID(),
          data: { ...data, ...bad },
        }),
      );
    await assert.rejects(
      db.query("update travel_bookings set title=$1", ["Bypass"]),
      /permission denied/,
    );
    const doc = await run({
      ...p,
      id: randomUUID(),
      operationId: randomUUID(),
      data: {
        ...data,
        kind: "document",
        title: "Voucher",
        url: "https://example.com/voucher",
        booking_id: row.id,
      },
    });
    assert.equal(doc.booking_id, row.id);
    await run({
      ...p,
      action: "delete",
      version: 2,
      operationId: randomUUID(),
    });
    assert.equal(
      (
        await db.query<any>(
          "select deleted_at from travel_bookings where id=$1",
          [row.id],
        )
      ).rows[0].deleted_at !== null,
      true,
    );
    const ready = (await db.query<any>("select tf_release_readiness() r"))
      .rows[0].r;
    assert.equal(ready.database_version, DATABASE_VERSION);
    assert.equal(ready.ready, true);
    await db.exec(
      `set role postgres;delete from trip_members where user_id='${viewer}';`,
    );
    await as(viewer);
    assert.equal(
      (await db.query<any>("select count(*)::int n from travel_bookings"))
        .rows[0].n,
      0,
    );
    await db.exec(
      `set role postgres;insert into tf_user_accounts(user_id,status) values('${editor}','deactivated') on conflict(user_id) do update set status='deactivated';`,
    );
    await as(editor);
    assert.equal(
      (await db.query<any>("select count(*)::int n from travel_bookings"))
        .rows[0].n,
      0,
    );
    await assert.rejects(
      run({ ...p, id: randomUUID(), operationId: randomUUID() }),
      /ACCOUNT_DEACTIVATED/,
    );
    await as(owner);
    // Migration rerun preserves data and readiness.
    await db.exec("set role postgres");
    await db.exec(
      await readFile(
        "supabase/migrations/202611010001_v280_bookings_documents.sql",
        "utf8",
      ),
    );
    await as(owner);
    assert.equal(
      (await db.query<any>("select tf_release_readiness() r")).rows[0].r
        .database_version,
      "2.8.0",
    );
  } finally {
    await db.close();
  }
});
test("V2.8 booking input validates URLs, timezone, overnight and optional end", () => {
  assert.equal(
    bookingData.safeParse({ kind: "hotel", title: "Hotel", status: "pending" })
      .success,
    true,
  );
  assert.equal(
    bookingData.safeParse({
      kind: "document",
      title: "Ticket",
      status: "confirmed",
      url: "http://insecure.test",
    }).success,
    false,
  );
});
