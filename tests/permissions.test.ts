import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

test("V2.4.1 migration, independent permissions and server enforcement", async (t) => {
  const db = new PGlite();
  const owner = randomUUID(),
    other = randomUUID(),
    trip = randomUUID();
  async function as(id: string = owner) {
    await db.exec(
      `set role postgres;select set_config('request.jwt.claim.sub','${id}',false);select set_config('request.jwt.claims','${JSON.stringify({ sub: id, email: id + "@test.local" })}',false);set role authenticated;`,
    );
  }
  async function mutate(
    entity: string,
    action: string,
    data: object = {},
    row: Record<string, any> = {},
    tid = trip,
    op = randomUUID(),
  ) {
    return (
      await db.query<{ result: Record<string, any> }>(
        "select public.tf_mutate($1::jsonb) result",
        [
          JSON.stringify({
            operationId: op,
            tripId: tid,
            entity,
            action,
            data,
            ...row,
          }),
        ],
      )
    ).rows[0].result;
  }
  async function permissions(tid = trip) {
    return (
      await db.query<{ p: Record<string, boolean> }>(
        "select public.tf_trip_permissions($1) p",
        [tid],
      )
    ).rows[0].p;
  }
  const allMigrations = (await readdir("supabase/migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort();
  try {
    await db.exec(
      `create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),last_sign_in_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;insert into auth.users(id,email) values('${owner}','${owner}@test.local'),('${other}','${other}@test.local');`,
    );
    for (const name of allMigrations.filter((n) => !n.includes("v241")))
      await db.exec(await readFile("supabase/migrations/" + name, "utf8"));
    await as();
    await mutate("trip", "create", {
      name: "Permissions",
      destination: "Nha Trang",
      start_date: "2026-10-01",
      end_date: "2026-10-03",
      timezone: "Asia/Ho_Chi_Minh",
      people: 2,
      status: "planning",
      note: "",
    });
    await db.exec(
      `set role postgres;insert into public.trip_members(trip_id,user_id,email,role) values('${trip}','${other}','${other}@test.local','viewer');`,
    );
    await db.exec(
      await readFile(
        "supabase/migrations/" + allMigrations.find((n) => n.includes("v241"))!,
        "utf8",
      ),
    );
    await t.test(
      "legacy migration keeps role and denies all five special grants",
      async () => {
        await as(other);
        const p = await permissions();
        assert.equal(Object.keys(p).length, 5);
        assert.ok(Object.values(p).every((v) => !v));
        await assert.rejects(
          mutate("snapshot", "create", { title: "No" }),
          /PERMISSION_DENIED/,
        );
      },
    );
    const legacy = (
      await db.query<any>(
        "select * from public.trip_members where trip_id=$1",
        [trip],
      )
    ).rows[0];
    await t.test(
      "only the owner grants independent flags; flag-only changes emit access events",
      async () => {
        await as();
        assert.ok(Object.values(await permissions()).every(Boolean));
        await as(other);
        const before = (
          await db.query<any>(
            "select count(*)::int n from public.trip_access_events",
          )
        ).rows[0].n;
        await as();
        await mutate(
          "member",
          "update",
          { role: "viewer", can_invite: true },
          legacy,
        );
        await as(other);
        assert.equal(
          (
            await db.query<any>(
              "select count(*)::int n from public.trip_access_events",
            )
          ).rows[0].n,
          before + 1,
        );
        await as(other);
        const p = await permissions();
        assert.equal(p.can_invite, true);
        assert.equal(p.can_close_budget, false);
      },
    );
    let invitation: Record<string, any>;
    await t.test(
      "invite grant allows inviting but not revoke, role changes, delete or budget lock",
      async () => {
        await as(other);
        invitation = await mutate("invitation", "create", {
          email: "invitee@test.local",
          role: "viewer",
        });
        await assert.rejects(
          mutate("invitation", "delete", {}, invitation),
          /PERMISSION_DENIED/,
        );
        await assert.rejects(
          mutate("snapshot", "create", { title: "No" }),
          /PERMISSION_DENIED/,
        );
        await assert.rejects(
          mutate("trip", "delete", {}, { id: trip, version: 1 }),
          /PERMISSION_DENIED/,
        );
        await assert.rejects(
          mutate("member", "update", { role: "editor" }, legacy),
          /PERMISSION_DENIED/,
        );
        await assert.rejects(
          mutate("invitation", "create", {
            email: "escalate@test.local",
            role: "viewer",
            can_delete_trip: true,
          }),
          /PERMISSION_GRANT_OWNER_ONLY/,
        );
      },
    );
    const users: Record<string, { user: string; member: Record<string, any> }> =
      {};
    async function add(key: string, flags: Record<string, boolean> = {}) {
      const id = randomUUID();
      await db.exec(
        `set role postgres;insert into auth.users(id,email) values('${id}','${id}@test.local');`,
      );
      await as();
      const inv = await mutate("invitation", "create", {
        email: id + "@test.local",
        role: "viewer",
        ...flags,
      });
      await as(id);
      await mutate("invitation", "accept", { token: inv.token });
      const member = (
        await db.query<any>(
          "select * from public.trip_members where trip_id=$1 and user_id=$2",
          [trip, id],
        )
      ).rows[0];
      return { user: id, member };
    }
    await t.test(
      "accepted invitation transfers exactly the owner-assigned grants",
      async () => {
        users.roles = await add("roles", { can_change_roles: true });
        assert.deepEqual(await permissions(), {
          can_invite: false,
          can_change_roles: true,
          can_revoke_access: false,
          can_delete_trip: false,
          can_close_budget: false,
        });
        users.plain = await add("plain");
      },
    );
    await t.test(
      "role manager can change another role but cannot delegate special grants or promote self",
      async () => {
        await as(users.roles.user);
        const member = await mutate(
          "member",
          "update",
          { role: "editor" },
          users.plain.member,
        );
        assert.equal(member.role, "editor");
        users.plain.member = member;
        await assert.rejects(
          mutate(
            "member",
            "update",
            { role: "editor", can_delete_trip: true },
            member,
          ),
          /PERMISSION_GRANT_OWNER_ONLY/,
        );
        await assert.rejects(
          mutate("member", "update", { role: "editor" }, users.roles.member),
          /SELF_PERMISSION_CHANGE/,
        );
        await assert.rejects(
          mutate("member", "delete", {}, member),
          /PERMISSION_DENIED/,
        );
      },
    );
    await t.test(
      "budget-lock viewer can close baseline/revision but cannot edit budgets; retry is idempotent",
      async () => {
        users.budget = await add("budget", { can_close_budget: true });
        await as(users.budget.user);
        const op = randomUUID();
        const first = await mutate(
          "snapshot",
          "create",
          { title: "Baseline" },
          {},
          trip,
          op,
        );
        assert.equal(first.snapshot_kind, "baseline");
        const again = await mutate(
          "snapshot",
          "create",
          { title: "Baseline" },
          {},
          trip,
          op,
        );
        assert.equal(again.id, first.id);
        await assert.rejects(
          mutate("budget", "create", {
            title: "No",
            category: "Khác",
            quantity: 1,
            unit_price: 100,
          }),
          /READ_ONLY/,
        );
      },
    );
    await t.test(
      "revoke grant independently revokes invitation and member; stale versions cannot win",
      async () => {
        users.revoke = await add("revoke", { can_revoke_access: true });
        await as(users.revoke.user);
        await assert.rejects(
          mutate(
            "member",
            "delete",
            {},
            { ...users.plain.member, version: 999 },
          ),
          /CONFLICT/,
        );
        await mutate("invitation", "delete", {}, invitation);
        await mutate("member", "delete", {}, users.plain.member);
        await as(users.plain.user);
        await assert.rejects(permissions(), /FORBIDDEN/);
      },
    );
    await t.test(
      "revoking a special grant takes effect on the next server request",
      async () => {
        await as();
        const m = (
          await db.query<any>("select * from public.trip_members where id=$1", [
            users.budget.member.id,
          ])
        ).rows[0];
        await mutate(
          "member",
          "update",
          { role: "viewer", can_close_budget: false },
          m,
        );
        await as(users.budget.user);
        await assert.rejects(
          mutate("snapshot", "create", { title: "Denied" }),
          /PERMISSION_DENIED/,
        );
      },
    );
    await t.test(
      "delete grant soft-deletes a trip and the owner can recover it",
      async () => {
        await as();
        const tid = randomUUID();
        await mutate(
          "trip",
          "create",
          {
            name: "Delete test",
            destination: "Nha Trang",
            start_date: "2026-10-01",
            end_date: "2026-10-03",
            timezone: "Asia/Ho_Chi_Minh",
            people: 2,
            status: "planning",
            note: "",
          },
          {},
          tid,
        );
        const inv = await mutate(
          "invitation",
          "create",
          {
            email: other + "@test.local",
            role: "viewer",
            can_delete_trip: true,
          },
          {},
          tid,
        );
        await as(other);
        await mutate("invitation", "accept", { token: inv.token }, {}, tid);
        await mutate("trip", "delete", {}, { id: tid, version: 1 }, tid);
        assert.equal(
          (
            await db.query<any>(
              "select count(*)::int n from public.trips where id=$1",
              [tid],
            )
          ).rows[0].n,
          0,
        );
        await as();
        await db.query("select public.tf_restore_deleted($1,$2,$3)", [
          tid,
          "trip",
          tid,
        ]);
        assert.equal(
          (
            await db.query<any>(
              "select count(*)::int n from public.trips where id=$1",
              [tid],
            )
          ).rows[0].n,
          1,
        );
      },
    );
    await t.test(
      "direct writes and old RPC bypasses stay denied; migration is repeatable",
      async () => {
        await as(other);
        await assert.rejects(
          db.query(
            "update public.trip_members set can_delete_trip=true where user_id=$1",
            [other],
          ),
          /permission denied/,
        );
        await assert.rejects(
          db.query("select public.tf_mutate_v010('{}'::jsonb)"),
          /permission denied/,
        );
        await db.exec("set role postgres;");
        await db.exec(
          await readFile(
            "supabase/migrations/" +
              allMigrations.find((n) => n.includes("v241"))!,
            "utf8",
          ),
        );
        await as();
        const ready = (
          await db.query<any>("select public.tf_release_readiness() r")
        ).rows[0].r;
        assert.equal(ready.database_version, "2.4.1");
        assert.equal(ready.ready, true);
      },
    );
  } finally {
    await db.close();
  }
});
