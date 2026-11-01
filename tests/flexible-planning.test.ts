import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  previewShift,
  routeIssues,
  routeContext,
  routeBatchSchema,
  routeItemSchema,
  directionsUrl,
} from "../lib/flexible-planning";
import {
  applyOptimisticMutation,
  isCoreOfflineMutation,
} from "../lib/offline-reliability";
import {
  DATABASE_VERSION,
  type Bundle,
  type Item,
  type Mutation,
} from "../lib/types";
const zone = "Asia/Ho_Chi_Minh";
const row = (title: string, hour: number, extra: Partial<Item> = {}): Item => ({
  id: randomUUID(),
  trip_id: randomUUID(),
  version: 1,
  created_at: "",
  updated_at: "",
  title,
  location: title,
  start_at: `2026-11-08T${String(hour).padStart(2, "0")}:00:00.000Z`,
  end_at: `2026-11-08T${String(hour + 1).padStart(2, "0")}:00:00.000Z`,
  status: "planned",
  map_url: "",
  note: "",
  checked_in_at: null,
  completed_at: null,
  time_mode: "flexible",
  ...extra,
});
test("flex preview preserves anchors/history, propagates changed duration, blocks implicit next-day and bounds", () => {
  const a = row("Breakfast", 0),
    b = row("Visit", 2),
    fixed = row("Tour", 4, { time_mode: "fixed" }),
    later = row("Lunch", 6),
    done = row("History", 3, { status: "done" });
  const items = [a, b, done, fixed, later],
    plan = previewShift(items, a, a.start_at, 90, true, zone);
  assert.equal(plan.updates.length, 2);
  assert.equal(
    plan.items.find((x) => x.id === b.id)?.start_at,
    "2026-11-08T02:30:00.000Z",
  );
  assert.equal(
    plan.items.find((x) => x.id === fixed.id)?.start_at,
    fixed.start_at,
  );
  assert.equal(
    plan.items.find((x) => x.id === later.id)?.start_at,
    later.start_at,
  );
  assert.equal(
    plan.items.find((x) => x.id === done.id)?.start_at,
    done.start_at,
  );
  assert.equal(a.end_at, "2026-11-08T01:00:00.000Z");
  assert.throws(
    () => previewShift(items, a, "2026-11-09T00:00:00.000Z", 60, true, zone),
    /cùng ngày/,
  );
  assert.throws(
    () =>
      previewShift(
        [a, { ...b, latest_at: b.end_at }],
        a,
        a.start_at,
        120,
        true,
        zone,
      ),
    /giới hạn/,
  );
  const late = row("Late", 15),
    next = row("Near midnight", 16);
  assert.throws(
    () => previewShift([late, next], late, late.start_at, 180, true, zone),
    /ngày khác/,
  );
  assert.throws(() =>
    previewShift(
      [{ ...a, end_at: null }, b],
      { ...a, end_at: null },
      a.start_at,
      60,
      true,
      zone,
    ),
  );
  assert.equal(routeContext(items, [], zone).length, 5);
  assert.equal(
    routeItemSchema.safeParse({
      ...a,
      earliest_at: "2026-11-08T00:00:00+00:00",
    }).success,
    false,
  ); // API timestamps canonicalized to Z by forms.
});
test("route diagnostics distinguish unknown travel, stale leg, overlap and short transfer; URLs encoded", () => {
  const a = row("A", 0),
    b = row("B", 1, {
      start_at: "2026-11-08T01:20:00.000Z",
      travel_minutes: 30,
      buffer_minutes: 10,
      leg_from_id: a.id,
    });
  assert.ok(
    routeIssues([a, b], zone).some((x) => /thiếu 20 phút/.test(x.message)),
  );
  assert.ok(
    routeIssues([a, { ...b, leg_from_id: null }], zone).some((x) =>
      /xác nhận/.test(x.message),
    ),
  );
  assert.ok(
    routeIssues([a, { ...b, start_at: "2026-11-08T00:40:00Z" }], zone).some(
      (x) => /trùng 20 phút/.test(x.message),
    ),
  );
  const url = new URL(
    directionsUrl(
      { ...a, location: "A & B" },
      { ...b, location: "Điểm #2", travel_mode: "walk" },
    ),
  );
  assert.equal(url.searchParams.get("origin"), "A & B");
  assert.equal(url.searchParams.get("travelmode"), "walking");
  assert.equal(directionsUrl({ ...a, location: "" }, b), "");
});
test("offline route transaction changes the itinerary and wishes together without touching budget/booking data", () => {
  const a = row("Old", 0),
    wish = {
      id: randomUUID(),
      trip_id: a.trip_id,
      title: "Indoor",
      location: "Mall",
      duration_minutes: 60,
      map_url: "",
      note: "",
      backup_for_id: a.id,
      version: 1,
      created_at: "",
      updated_at: "",
    },
    candidate = row("Indoor", 0, { trip_id: a.trip_id });
  const bundle = {
    trip: { id: a.trip_id },
    items: [a],
    wishes: [wish],
    budgets: [],
    expenses: [],
    participants: [],
    media: [],
  } as unknown as Bundle;
  const m: Mutation = {
    operationId: randomUUID(),
    entity: "route_batch",
    action: "create",
    tripId: a.trip_id,
    data: routeBatchSchema.parse({
      days: ["2026-11-08"],
      trip_version: 1,
      context: routeContext([a], [], zone),
      updates: [],
      create_item: { id: candidate.id, data: routeItemSchema.parse(candidate) },
      consume_wish: { id: wish.id, version: 1 },
      replace_item: {
        id: a.id,
        version: 1,
        keep_old: true,
        wish_id: randomUUID(),
      },
    }),
  };
  assert.equal(isCoreOfflineMutation(m), true);
  const next = applyOptimisticMutation(bundle, m);
  assert.equal(next.items.find((x) => x.id === a.id)?.status, "skipped");
  assert.equal(next.items.length, 2);
  assert.equal(next.wishes?.length, 1);
  assert.equal(next.wishes?.[0].title, "Old");
  assert.equal(bundle.items[0].status, "planned");
  assert.deepEqual(next.budgets, bundle.budgets);
});
test("V2.12 database: atomic shifts, context races, replay, bounds, wishes, access and backup maps", async () => {
  const db = new PGlite(),
    owner = randomUUID(),
    editor = randomUUID(),
    viewer = randomUUID(),
    outside = randomUUID(),
    tid = randomUUID();
  const as = (id = owner) =>
    db.exec(
      `set role postgres;select set_config('request.jwt.claim.sub','${id}',false);select set_config('request.jwt.claims','${JSON.stringify({ sub: id, email: id + "@test.local" })}',false);set role authenticated;`,
    );
  const run = async (
    entity: string,
    data: object,
    action = "create",
    extra = {},
    operationId = randomUUID(),
  ) =>
    (
      await db.query<any>("select tf_mutate($1::jsonb) r", [
        JSON.stringify({
          operationId,
          tripId: tid,
          entity,
          action,
          data,
          ...extra,
        }),
      ])
    ).rows[0].r;
  const items = async () =>
    (
      await db.query<Item>(
        "select * from itinerary_items where trip_id=$1 and deleted_at is null order by start_at,id",
        [tid],
      )
    ).rows.map((x) => ({
      ...x,
      start_at: new Date(x.start_at).toISOString(),
      end_at: x.end_at ? new Date(x.end_at).toISOString() : null,
    }));
  try {
    await db.exec(
      `create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),last_sign_in_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;`,
    );
    for (const id of [owner, editor, viewer, outside])
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        id,
        id + "@test.local",
      ]);
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
    await as();
    await run("trip", {
      name: "Flexible",
      destination: "Hồ Tràm",
      start_date: "2026-11-08",
      end_date: "2026-11-10",
      timezone: zone,
      people: 3,
      status: "planning",
      note: "",
    });
    const a = await run(
        "item",
        routeItemSchema.parse(row("Breakfast", 0)),
        "create",
        { id: randomUUID() },
      ),
      b = await run("item", routeItemSchema.parse(row("Beach", 2)), "create", {
        id: randomUUID(),
      }),
      anchor = await run(
        "item",
        routeItemSchema.parse(
          row("Tour", 4, {
            time_mode: "fixed",
            earliest_at: "2026-11-08T04:00:00.000Z",
            latest_at: "2026-11-08T05:00:00.000Z",
          }),
        ),
        "create",
        { id: randomUUID() },
      );
    let list = await items();
    const plan = previewShift(
        list,
        list.find((x) => x.id === a.id)!,
        a.start_at,
        90,
        true,
        zone,
      ),
      data = {
        days: plan.days,
        trip_version: 1,
        context: routeContext(list, [], zone),
        updates: plan.updates,
      },
      op = randomUUID();
    const result = await run("route_batch", data, "create", {}, op);
    assert.equal(result.items.length, 2);
    assert.deepEqual(await run("route_batch", data, "create", {}, op), result);
    await assert.rejects(
      run("route_batch", { ...data, updates: [] }, "create", {}, op),
      /OPERATION_REUSED/,
    );
    assert.equal(
      (await items()).find((x) => x.id === anchor.id)?.start_at,
      new Date(anchor.start_at).toISOString(),
    );
    await assert.rejects(run("route_batch", data), /ROUTE_CONTEXT_CHANGED/);
    list = await items();
    const old = list.find((x) => x.id === a.id)!,
      fixed = list.find((x) => x.id === anchor.id)!;
    const invalid = {
      days: ["2026-11-08"],
      trip_version: 1,
      context: routeContext(list, [], zone),
      updates: [
        {
          id: old.id,
          version: old.version,
          start_at: "2026-11-08T00:05:00.000Z",
          end_at: old.end_at,
        },
        {
          id: fixed.id,
          version: fixed.version,
          start_at: fixed.start_at,
          end_at: "2026-11-08T05:30:00.000Z",
        },
      ],
    };
    await assert.rejects(run("route_batch", invalid), /TIME_BOUND_VIOLATION/);
    assert.equal(
      (await items()).find((x) => x.id === a.id)?.start_at,
      old.start_at,
    );
    const leg = await run(
      "item",
      {
        ...routeItemSchema.parse({
          ...list.find((x) => x.id === b.id)!,
          earliest_at: null,
          latest_at: null,
        }),
        leg_from_id: a.id,
        travel_mode: "car",
        travel_minutes: 25,
        buffer_minutes: 10,
      },
      "update",
      { id: b.id, version: list.find((x) => x.id === b.id)!.version },
    );
    assert.equal(leg.travel_minutes, 25);
    const w = await run(
      "wish",
      {
        title: "Indoor",
        location: "Mall",
        duration_minutes: 45,
        map_url: "https://maps.google.com/",
        note: "If rain",
        backup_for_id: b.id,
      },
      "create",
      { id: randomUUID() },
    );
    list = await items();
    const candidate = row("Indoor", 2),
      use = {
        days: ["2026-11-08"],
        trip_version: 1,
        context: routeContext(list, [], zone),
        updates: [],
        create_item: {
          id: candidate.id,
          data: routeItemSchema.parse(candidate),
        },
        consume_wish: { id: w.id, version: w.version },
        replace_item: {
          id: b.id,
          version: leg.version,
          keep_old: true,
          wish_id: randomUUID(),
        },
      };
    const before = list;
    await assert.rejects(
      run("route_batch", { ...use, consume_wish: { id: w.id, version: 999 } }),
      /CONFLICT/,
    );
    assert.equal((await items()).find((x) => x.id === b.id)?.status, "planned");
    assert.equal((await items()).length, before.length);
    await run("route_batch", use);
    assert.equal((await items()).find((x) => x.id === b.id)?.status, "skipped");
    const remaining = (
      await db.query<any>(
        "select * from trip_wishes where trip_id=$1 and deleted_at is null",
        [tid],
      )
    ).rows;
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].title, "Beach");
    await run(
      "wish",
      {
        title: "Plan B Tour",
        location: "Cafe",
        duration_minutes: 30,
        map_url: "",
        note: "",
        backup_for_id: anchor.id,
      },
      "create",
      { id: randomUUID() },
    );
    await db.exec("set role postgres");
    await db.query(
      "insert into trip_members(trip_id,user_id,email,role) values($1,$2,$3,'viewer'),($1,$4,$5,'editor')",
      [tid, viewer, viewer + "@test.local", editor, editor + "@test.local"],
    );
    await as(viewer);
    assert.equal(
      (
        await db.query<any>(
          "select count(*)::int n from trip_wishes where deleted_at is null",
        )
      ).rows[0].n,
      2,
    );
    await assert.rejects(
      run("wish", { title: "x" }, "create", { id: randomUUID() }),
      /READ_ONLY/,
    );
    await assert.rejects(
      db.exec("update trip_wishes set title='Denied'"),
      /permission denied/,
    );
    await assert.rejects(
      db.exec("select tf_mutate_v2110('{}')"),
      /permission denied/,
    );
    await as(outside);
    assert.equal(
      (await db.query<any>("select count(*)::int n from trip_wishes")).rows[0]
        .n,
      0,
    );
    await assert.rejects(run("route_batch", use), /FORBIDDEN/);
    await as(editor);
    const updated = await run(
      "wish",
      { ...remaining[0], title: "Beach later" },
      "update",
      { id: remaining[0].id, version: remaining[0].version },
    );
    assert.equal(updated.title, "Beach later");
    await as();
    const backup = (
        await db.query<any>(
          "select tf_create_trip_backup($1,'Flexible backup') r",
          [tid],
        )
      ).rows[0].r,
      restored = (
        await db.query<any>("select tf_restore_trip_backup($1,'Copy') r", [
          backup.id,
        ])
      ).rows[0].r;
    const copiedItems = (
        await db.query<any>("select * from itinerary_items where trip_id=$1", [
          restored.trip_id,
        ])
      ).rows,
      copiedWishes = (
        await db.query<any>("select * from trip_wishes where trip_id=$1", [
          restored.trip_id,
        ])
      ).rows;
    assert.equal(
      copiedItems.find((x: any) => x.title === "Tour").time_mode,
      "fixed",
    );
    assert.ok(copiedItems.find((x: any) => x.title === "Tour").latest_at);
    assert.equal(
      copiedItems.find((x: any) => x.title === "Beach").leg_from_id,
      copiedItems.find((x: any) => x.title === "Breakfast").id,
    );
    assert.equal(
      copiedWishes.find((x: any) => x.title === "Plan B Tour").backup_for_id,
      copiedItems.find((x: any) => x.title === "Tour").id,
    );
    const template = (
      await db.query<any>(
        "select to_jsonb(tf_save_trip_template($1,'Route template','')) r",
        [tid],
      )
    ).rows[0].r;
    const reused = (
      await db.query<any>(
        "select tf_create_trip_from_template($1,'Template copy','2026-12-01',null) r",
        [template.id],
      )
    ).rows[0].r;
    const reusedItems = (
      await db.query<any>("select * from itinerary_items where trip_id=$1", [
        reused.trip_id,
      ])
    ).rows;
    assert.equal(
      reusedItems.find((x: any) => x.title === "Tour").time_mode,
      "fixed",
    );
    assert.equal(
      new Date(
        reusedItems.find((x: any) => x.title === "Tour").earliest_at,
      ).toISOString(),
      "2026-12-01T04:00:00.000Z",
    );
    assert.equal(
      reusedItems.find((x: any) => x.title === "Beach").leg_from_id,
      reusedItems.find((x: any) => x.title === "Breakfast").id,
    );
    await db.exec("set role postgres");
    await db.exec(
      await readFile(
        "supabase/migrations/202611010006_v2120_flexible_itinerary.sql",
        "utf8",
      ),
    );
    await as();
    assert.equal(
      (await db.query<any>("select tf_release_readiness() r")).rows[0].r
        .database_version,
      DATABASE_VERSION,
    );
  } finally {
    await db.close();
  }
});
