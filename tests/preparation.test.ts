import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  checklistSchema,
  contactSchema,
  copyPackingTemplate,
  filterPreparation,
  preparationProgress,
} from "../lib/preparation";
import {
  applyOptimisticMutation,
  compactQueueRows,
  currentVersionForMutation,
  isCoreOfflineMutation,
} from "../lib/offline-reliability";
import { mutationSchema } from "../lib/validation";
import {
  DATABASE_VERSION,
  type Bundle,
  type ChecklistItem,
  type Mutation,
} from "../lib/types";
const entry = (patch = {}) =>
  checklistSchema.parse({
    title: "Thuốc",
    category: "Thuốc & vật dụng cá nhân",
    kind: "packing",
    scope: "shared",
    assignee_id: null,
    quantity: 1,
    due_on: "2026-10-30",
    note: "",
    status: "needed",
    excluded: false,
    ...patch,
  });
test("preparation progress, exclusion, ownership and independent template copies", () => {
  const person = randomUUID(),
    a = copyPackingTemplate("baby", person, "personal", null),
    b = copyPackingTemplate("baby", person, "personal", null);
  assert.equal(a.length, 11);
  assert.ok(a.every((x) => !b.some((y) => x.id === y.id)));
  a[0].title = "Changed";
  assert.notEqual(a[0].title, b[0].title);
  const rows = [
    entry(),
    entry({ status: "packed" }),
    entry({ kind: "task", status: "done" }),
    entry({ excluded: true }),
    entry({ assignee_id: person, status: "ready" }),
  ].map((x, i) => ({
    ...x,
    id: String(i),
    trip_id: randomUUID(),
    version: 1,
    created_at: "",
    updated_at: "",
  })) as ChecklistItem[];
  assert.deepEqual(preparationProgress(rows, "2026-11-01"), {
    total: 4,
    complete: 2,
    missing: 2,
    overdue: 2,
    unassigned: 1,
  });
  assert.equal(
    filterPreparation(rows, "mine", person, [{ id: person } as any]).length,
    1,
  );
  assert.equal(filterPreparation(rows, "mine", person, []).length, 0);
  assert.equal(filterPreparation(rows, "unfinished", "", []).length, 2);
  assert.throws(() => entry({ scope: "personal" }));
  assert.throws(() => entry({ kind: "task", status: "packed" }));
  assert.throws(() =>
    contactSchema.parse({
      name: "Driver",
      kind: "driver",
      phone: "javascript:alert(1)",
      address: "",
      map_url: "",
      note: "",
    }),
  );
  assert.throws(() =>
    contactSchema.parse({
      name: "Driver",
      kind: "driver",
      phone: "123",
      address: "",
      map_url: "http://unsafe.test",
      note: "",
    }),
  );
});
test("preparation offline batch, compaction and older cache compatibility", () => {
  const tid = randomUUID(),
    bundle = {
      trip: { id: tid },
      items: [],
      budgets: [],
      expenses: [],
      media: [],
      participants: [],
    } as unknown as Bundle;
  const m: Mutation = {
    entity: "checklist_batch",
    action: "create",
    tripId: tid,
    id: randomUUID(),
    operationId: randomUUID(),
    data: { entries: copyPackingTemplate("beach", null, "shared", null) },
  };
  assert.equal(isCoreOfflineMutation(m), true);
  mutationSchema.parse(m);
  const visible = applyOptimisticMutation(bundle, m);
  assert.equal(visible.checklist?.length, 8);
  assert.equal(bundle.checklist, undefined);
  assert.equal(applyOptimisticMutation(visible, m).checklist?.length, 8);
  const row = visible.checklist![0],
    update: Mutation = {
      entity: "checklist",
      action: "update",
      tripId: tid,
      id: row.id,
      version: 1,
      operationId: randomUUID(),
      data: { ...row, status: "packed" },
    };
  const edited = applyOptimisticMutation(visible, update);
  assert.equal(currentVersionForMutation(edited, update), 2);
  assert.equal(edited.checklist![0].status, "packed");
  assert.equal(visible.checklist![0].status, "needed");
  const q = compactQueueRows([], update, "user", new Date().toISOString()),
    compacted = compactQueueRows(
      q.rows,
      { ...update, data: { ...update.data, note: "Keep" } },
      "user",
      new Date().toISOString(),
    );
  assert.equal(compacted.rows.length, 1);
  assert.equal(compacted.rows[0].mutation.version, 1);
  assert.equal(compacted.rows[0].mutation.data?.note, "Keep");
  assert.equal(
    applyOptimisticMutation(edited, { ...update, action: "delete" }).checklist
      ?.length,
    7,
  );
});
test("V2.11 SQL atomic batch, replay, conflicts, RLS and backup participant remapping", async () => {
  const db = new PGlite(),
    owner = randomUUID(),
    viewer = randomUUID(),
    editor = randomUUID(),
    stranger = randomUUID(),
    tid = randomUUID(),
    otherTrip = randomUUID();
  const as = (id = owner) =>
    db.exec(
      `set role postgres;select set_config('request.jwt.claim.sub','${id}',false);select set_config('request.jwt.claims','${JSON.stringify({ sub: id, email: id + "@test.local" })}',false);set role authenticated;`,
    );
  const run = async (
    entity: string,
    data: object,
    action = "create",
    extra = {},
    tripId = tid,
    operationId = randomUUID(),
  ) =>
    (
      await db.query<any>("select tf_mutate($1::jsonb) r", [
        JSON.stringify({ entity, action, data, tripId, operationId, ...extra }),
      ])
    ).rows[0].r;
  const tripData = {
    name: "Packing",
    destination: "Biển",
    start_date: "2026-11-01",
    end_date: "2026-11-03",
    timezone: "Asia/Ho_Chi_Minh",
    people: 3,
    status: "planning",
    note: "",
  };
  try {
    await db.exec(
      `create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),last_sign_in_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;`,
    );
    for (const id of [owner, viewer, editor, stranger])
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        id,
        id + "@test.local",
      ]);
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(await readFile("supabase/migrations/" + f, "utf8"));
    await as();
    await run("trip", tripData);
    await run("trip", tripData, "create", {}, otherTrip);
    const person = await run("participant", {
      name: "Bé",
      note: "",
      age_group: "infant",
      family_group: "Nhà A",
      needs_note: "Mang bình sữa",
    });
    assert.equal(person.age_group, "infant");
    const legacyEdit = mutationSchema.parse({
      entity: "participant",
      action: "update",
      operationId: randomUUID(),
      tripId: tid,
      id: person.id,
      version: person.version,
      data: { name: "Bé", note: "Updated" },
    });
    assert.equal(Object.hasOwn(legacyEdit.data, "age_group"), false);
    const kept = await run("participant", legacyEdit.data, "update", {
      id: person.id,
      version: person.version,
    });
    assert.equal(kept.age_group, "infant");
    assert.equal(kept.needs_note, "Mang bình sữa");
    const otherPerson = await run(
      "participant",
      { name: "Other", note: "" },
      "create",
      {},
      otherTrip,
    );
    const id = randomUUID(),
      op = randomUUID(),
      data = entry({ scope: "personal", assignee_id: person.id }),
      row = await run("checklist", data, "create", { id }, tid, op);
    assert.deepEqual(
      await run("checklist", data, "create", { id }, tid, op),
      row,
    );
    await assert.rejects(
      run(
        "checklist",
        { ...data, title: "Changed" },
        "create",
        { id },
        tid,
        op,
      ),
      /OPERATION_REUSED/,
    );
    await assert.rejects(
      run("checklist", entry({ assignee_id: otherPerson.id }), "create", {
        id: randomUUID(),
      }),
      /INVALID_PARTICIPANT/,
    );
    const updated = await run(
      "checklist",
      { ...data, status: "packed" },
      "update",
      { id, version: row.version },
    );
    assert.equal(updated.version, 2);
    await assert.rejects(
      run("checklist", data, "update", { id, version: 1 }),
      /CONFLICT/,
    );
    await assert.rejects(
      run("participant", {}, "delete", {
        id: person.id,
        version: person.version,
      }),
      /PARTICIPANT_HAS_CHECKLIST/,
    );
    const batch = copyPackingTemplate("baby", person.id, "personal", null),
      batchOp = randomUUID(),
      res = await run(
        "checklist_batch",
        { entries: batch },
        "create",
        {},
        tid,
        batchOp,
      );
    assert.equal(res.entries.length, 11);
    assert.deepEqual(
      await run(
        "checklist_batch",
        { entries: batch },
        "create",
        {},
        tid,
        batchOp,
      ),
      res,
    );
    const bad = copyPackingTemplate("beach", null, "shared", null);
    bad[bad.length - 1].assignee_id = otherPerson.id;
    await assert.rejects(
      run("checklist_batch", { entries: bad }),
      /INVALID_PARTICIPANT/,
    );
    assert.equal(
      (
        await db.query<any>(
          "select count(*)::int n from trip_checklist_items where trip_id=$1",
          [tid],
        )
      ).rows[0].n,
      12,
    );
    await run(
      "contact",
      {
        name: "Tài xế",
        kind: "driver",
        phone: "+84 912 345 678",
        address: "Hồ Tràm",
        map_url: "https://maps.google.com/",
        note: "Gọi trước",
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
      (await db.query<any>("select count(*)::int n from trip_checklist_items"))
        .rows[0].n,
      12,
    );
    await assert.rejects(
      run("checklist", entry(), "create", { id: randomUUID() }),
      /READ_ONLY/,
    );
    await assert.rejects(
      db.query("update trip_checklist_items set title='Denied'"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select tf_mutate_v2101('{}')"),
      /permission denied/,
    );
    await as(stranger);
    assert.equal(
      (await db.query<any>("select count(*)::int n from trip_checklist_items"))
        .rows[0].n,
      0,
    );
    await assert.rejects(run("contact", { name: "x" }), /FORBIDDEN/);
    await as(editor);
    const task = await run("checklist", entry({ kind: "task" }), "create", {
      id: randomUUID(),
    });
    assert.equal(
      (
        await run(
          "checklist",
          { ...entry({ kind: "task" }), status: "done" },
          "update",
          { id: task.id, version: task.version },
        )
      ).status,
      "done",
    );
    await as();
    const backup = (
        await db.query<any>(
          "select tf_create_trip_backup($1,'Preparation backup') r",
          [tid],
        )
      ).rows[0].r,
      saved = (
        await db.query<any>("select payload from trip_backups where id=$1", [
          backup.id,
        ])
      ).rows[0].payload;
    assert.equal(saved.checklist.length, 13);
    assert.equal(saved.contacts.length, 1);
    assert.equal(saved.participants[0].needs_note, "Mang bình sữa");
    const restored = (
        await db.query<any>(
          "select tf_restore_trip_backup($1,'Packing restored') r",
          [backup.id],
        )
      ).rows[0].r,
      people = (
        await db.query<any>(
          "select * from trip_participants where trip_id=$1",
          [restored.trip_id],
        )
      ).rows,
      items = (
        await db.query<any>(
          "select * from trip_checklist_items where trip_id=$1",
          [restored.trip_id],
        )
      ).rows;
    assert.equal(people[0].age_group, "infant");
    assert.equal(items.length, 13);
    assert.equal(
      items.filter((x: any) => x.assignee_id === people[0].id).length,
      12,
    );
    assert.ok(items.every((x: any) => x.id !== id));
    assert.equal(
      items.find((x: any) => x.title === "Thuốc" && x.kind === "packing")
        .status,
      "packed",
    );
    assert.equal(
      (
        await db.query<any>(
          "select count(*)::int n from trip_contacts where trip_id=$1",
          [restored.trip_id],
        )
      ).rows[0].n,
      1,
    );
    await db.exec("set role postgres");
    await db.exec(
      await readFile(
        "supabase/migrations/202611010005_v2110_packing_checklist_family.sql",
        "utf8",
      ),
    );
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
    assert.equal(
      (await db.query<any>("select tf_preparation_ready() r")).rows[0].r,
      true,
    );
    await db.exec("set role postgres");
    await db.query(
      "insert into public.tf_user_accounts(user_id,status) values($1,'deactivated') on conflict(user_id) do update set status='deactivated'",
      [editor],
    );
    await as(editor);
    await assert.rejects(
      run("checklist", entry(), "create", { id: randomUUID() }),
      /ACCOUNT_DEACTIVATED/,
    );
  } finally {
    await db.close();
  }
});
