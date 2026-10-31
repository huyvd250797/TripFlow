/** Browser integration test: real app UI + PostgreSQL/PGlite; mock Supabase Auth and HTTP transport.
 * Not a replacement for live Supabase staging acceptance. See docs/TESTING.md. */
import { PGlite } from "@electric-sql/pglite";
import { chromium, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile, mkdir, readdir } from "node:fs/promises";
import { mutationSchema } from "../lib/validation";
async function main() {
  const db = new PGlite();
  const owner = randomUUID(),
    tid = randomUUID();
  await db.exec(
    `create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),last_sign_in_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;insert into auth.users values('${owner}');`,
  );
  await db.exec(
    await readFile("supabase/migrations/202609250001_tripflow.sql", "utf8"),
  );
  for (const name of (await readdir("supabase/migrations"))
    .filter((n) => n.endsWith(".sql") && n !== "202609250001_tripflow.sql")
    .sort())
    await db.exec(await readFile("supabase/migrations/" + name, "utf8"));
  await db.exec(
    `select set_config('request.jwt.claim.sub','${owner}',false);select set_config('request.jwt.claims','${JSON.stringify({ sub: owner, email: "huy@example.com" })}',false);set role authenticated;`,
  );
  async function mutate(
    entity: string,
    data: object,
    action = "create",
    row: Record<string, unknown> = {},
  ) {
    return (
      await db.query<{ result: Record<string, any> }>(
        "select tf_mutate($1::jsonb) result",
        [
          JSON.stringify({
            operationId: randomUUID(),
            tripId: tid,
            entity,
            action,
            ...row,
            data,
          }),
        ],
      )
    ).rows[0].result;
  }
  await mutate("trip", {
    name: "Một chút Đà Lạt",
    destination: "Đà Lạt, Lâm Đồng",
    start_date: "2026-09-25",
    end_date: "2026-09-27",
    timezone: "Asia/Ho_Chi_Minh",
    people: 2,
    status: "traveling",
    note: "Ba ngày chậm lại, đi cùng những người thương.",
  });
  const coffee = await mutate("item", {
    title: "Cà phê sáng ở Đà Lạt",
    location: "Tiệm cà phê bên đồi",
    start_at: "2026-09-25T01:00:00Z",
    end_at: "2026-09-25T02:00:00Z",
    note: "Thử cà phê sữa và ngắm thành phố.",
    map_url: "",
  });
  await mutate("item", { status: "done" }, "status", coffee);
  const lake = await mutate("item", {
    title: "Dạo quanh hồ Xuân Hương",
    location: "Hồ Xuân Hương",
    start_at: "2026-09-25T03:00:00Z",
    end_at: "2026-09-25T04:30:00Z",
    note: "Đi bộ và chụp ảnh.",
    map_url: "https://maps.google.com/",
  });
  await mutate("item", { status: "active" }, "status", lake);
  await mutate("item", {
    title: "Nhận phòng homestay",
    location: "Một góc bình yên",
    start_at: "2026-09-25T07:00:00Z",
    end_at: "2026-09-25T08:00:00Z",
    note: "Gọi trước 30 phút.",
    map_url: "",
  });
  const food = await mutate("budget", {
    title: "Ăn uống cả chuyến",
    category: "Ăn uống",
    quantity: 2,
    unit_price: 400000,
    note: "",
  });
  for (const [title, category, amount] of [
    ["Xe đi và về", "Di chuyển", 1200000],
    ["Homestay", "Lưu trú", 900000],
    ["Vé tham quan", "Tham quan", 300000],
  ] as const)
    await mutate("budget", {
      title,
      category,
      quantity: 1,
      unit_price: amount,
      note: "",
    });
  await mutate("expense", {
    title: "Cà phê buổi sáng",
    category: "Ăn uống",
    kind: "payment",
    amount: 120000,
    spent_on: "2026-09-25",
    budget_id: food.id,
    payer: "Huy",
    note: "",
    receipt_url: "",
  });
  const memberUser = randomUUID();
  await db.exec(
    `set role postgres; insert into auth.users(id,email) values('${memberUser}','friend@example.com');insert into public.trip_members(trip_id,user_id,email,role) values('${tid}','${memberUser}','friend@example.com','viewer');set role authenticated;`,
  );
  let viewRole: "owner" | "viewer" = "owner";
  let viewerCanDelete = false;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    bypassCSP: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  const user = {
    id: owner,
    aud: "authenticated",
    role: "authenticated",
    email: "huy@example.com",
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const token =
    [
      { alg: "HS256", typ: "JWT" },
      {
        sub: owner,
        email: user.email,
        role: "authenticated",
        aud: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    ]
      .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
      .join(".") + ".test";
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const req = route.request();
    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS,PUT",
      },
      contentType: "application/json",
      body: JSON.stringify(
        req.method() === "OPTIONS"
          ? {}
          : req.url().includes("/token")
            ? {
                access_token: token,
                token_type: "bearer",
                refresh_token: "test-refresh",
                expires_in: 3600,
                user,
              }
            : user,
      ),
    });
  });
  const tables = {
    items: "itinerary_items",
    budgets: "budget_items",
    expenses: "expenses",
    media: "media_links",
    participants: "trip_participants",
    members: "trip_members",
    snapshots: "budget_snapshots",
    invitations: "trip_invitations",
    audits: "audit_logs",
  };
  await page.route("**/api/release", async (route) => {
    await route.fulfill({
      json: {
        app_version: "2.4.1",
        channel: "stable",
        database_version: "2.4.1",
        checked_at: new Date().toISOString(),
        ready: true,
        checks: [
          { key: "schema_marker", label: "Schema marker V1.3.0", ok: true },
          {
            key: "storytelling",
            label: "Media storytelling metadata V1.3",
            ok: true,
          },
          { key: "account_gate", label: "Account gate V0.2", ok: true },
          { key: "finance", label: "Finance integrity V0.3", ok: true },
          { key: "live_trip", label: "Live Trip history V0.4", ok: true },
          { key: "collaboration", label: "Collaboration V0.5", ok: true },
          { key: "backup_recovery", label: "Backup & Recovery V0.7", ok: true },
          { key: "idempotency", label: "Mutation idempotency", ok: true },
          {
            key: "single_active",
            label: "Single active itinerary guard",
            ok: true,
          },
          { key: "rls", label: "RLS on protected tables", ok: true },
        ],
      },
    });
  });
  await page.route("**/api/tripflow*", async (route) => {
    try {
      let body: Record<string, unknown>;
      if (route.request().method() === "POST") {
        const req = mutationSchema.parse(route.request().postDataJSON());
        body = {
          result: (
            await db.query<{ result: Record<string, unknown> }>(
              "select tf_mutate($1::jsonb) result",
              [JSON.stringify(req)],
            )
          ).rows[0].result,
        };
      } else if (new URL(route.request().url()).searchParams.has("trip")) {
        body = {
          trip: (await db.query("select * from trips where id=$1", [tid]))
            .rows[0],
          role: viewRole,
          permissions: {
            can_invite: viewRole === "owner",
            can_change_roles: viewRole === "owner",
            can_revoke_access: viewRole === "owner",
            can_delete_trip: viewRole === "owner" || viewerCanDelete,
            can_close_budget: viewRole === "owner",
          },
        };
        for (const [key, table] of Object.entries(tables)) {
          body[key] = (
            await db.query(
              `select * from ${table} where trip_id=$1 ${["items", "budgets", "expenses", "media", "participants"].includes(key) ? "and deleted_at is null" : ""} order by ${key === "audits" ? "created_at desc" : "id"}`,
              [tid],
            )
          ).rows;
        }
        body.finance_report = (
          await db.query<{ r: unknown }>(
            "select public.tf_finance_report($1) r",
            [tid],
          )
        ).rows[0].r;
      } else
        body = {
          trips: (
            await db.query("select * from trips where deleted_at is null")
          ).rows,
        };
      const normalized = JSON.parse(JSON.stringify(body), (key, value) =>
        ["start_date", "end_date", "spent_on", "taken_on"].includes(key) &&
        typeof value === "string"
          ? value.slice(0, 10)
          : value,
      );
      await route.fulfill({ json: normalized });
    } catch (e) {
      await route.fulfill({
        status: 400,
        json: { error: (e as Error).message },
      });
    }
  });
  await page.route("**/api/templates", (route) =>
    route.fulfill({ json: { templates: [] } }),
  );
  await page.route("**/api/recovery*", (route) =>
    route.fulfill({
      json: {
        policy: { recovery_days: 30, backup_days: 90 },
        deleted_trips: [],
        backups: [],
        tombstones: [],
        health: {
          last_backup_at: null,
          backup_count: 0,
          tombstone_count: 0,
          eligible_for_purge: 0,
          audit_count: 0,
          receipt_count: 0,
          note: "",
        },
      },
    }),
  );
  await mkdir("test-results", { recursive: true });
  try {
    await page.goto(process.env.UI_BASE_URL || "http://127.0.0.1:3000");
    await page.getByRole("button", { name: "Tối", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByLabel("Email", { exact: true }).fill(user.email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill("testpassword");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page.locator(".topbar")).toBeVisible();
    const nav = (label: string) =>
      page
        .locator(
          (page.viewportSize()?.width || 390) <= 760
            ? ".bottom-nav"
            : ".sidebar",
        )
        .getByRole("button", { name: label, exact: true })
        .click();
    await expect(page.locator(".daily-focus-card.current")).toContainText(
      "Dạo quanh hồ Xuân Hương",
    );
    await page.screenshot({
      path: "test-results/v241-dark-mobile-home.png",
      fullPage: true,
    });
    await nav("Thêm");
    await page.locator("#module-trip > summary").click();
    await expect(
      page
        .locator("#module-trip")
        .getByRole("button", { name: "Xóa chuyến đi", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".permission-grants .pill")).toHaveCount(5);
    await page.getByRole("button", { name: "Sửa quyền", exact: true }).click();
    for (const label of [
      "Mời thành viên",
      "Đổi quyền thành viên",
      "Thu hồi quyền truy cập",
      "Xóa chuyến đi",
      "Chốt dự toán",
    ])
      await expect(
        page.getByRole("dialog").getByLabel(label, { exact: true }),
      ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByLabel("Xóa chuyến đi", { exact: true })
      .check();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Lưu thay đổi", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(
      (
        await db.query<{ can_delete_trip: boolean }>(
          "select can_delete_trip from public.trip_members where user_id=$1",
          [memberUser],
        )
      ).rows[0].can_delete_trip,
    ).toBe(true);
    await page.screenshot({
      path: "test-results/v241-dark-mobile-permissions.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Sáng", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.reload();
    await expect(page.locator(".topbar")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await nav("Chi phí");
    await context.setOffline(true);
    await page
      .getByRole("button", { name: "Ghi chi tiêu", exact: true })
      .first()
      .click();
    await page.getByLabel("Số tiền VNĐ *", { exact: true }).fill("250000");
    await page
      .getByLabel("Nội dung chi *", { exact: true })
      .fill("Chi offline V241");
    await page
      .getByRole("button", { name: "Lưu thay đổi", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".money-banner")).toContainText("370.000");
    await page.screenshot({
      path: "test-results/v241-light-mobile-offline-wallet.png",
      fullPage: true,
    });
    await context.setOffline(false);
    await expect
      .poll(async () =>
        Number(
          (
            await db.query<{ sum: string }>(
              "select sum(amount) from public.expenses",
            )
          ).rows[0].sum,
        ),
      )
      .toBe(370000);
    viewRole = "viewer";
    await page
      .getByRole("button", { name: "Tải lại dữ liệu", exact: true })
      .click();
    await nav("Thêm");
    await page.locator("#module-trip").evaluate((el) => {
      (el as HTMLDetailsElement).open = true;
    });
    await expect(
      page.getByRole("button", { name: "Xóa chuyến đi", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Mời thành viên", exact: true }),
    ).toHaveCount(0);
    viewerCanDelete = true;
    await page
      .getByRole("button", { name: "Tải lại dữ liệu", exact: true })
      .click();
    await expect(
      page
        .locator("#module-trip")
        .getByRole("button", { name: "Xóa chuyến đi", exact: true }),
    ).toBeVisible();
    viewRole = "owner";
    viewerCanDelete = false;
    await page
      .getByRole("button", { name: "Tải lại dữ liệu", exact: true })
      .click();
    for (const theme of ["light", "dark"]) {
      await nav("Thêm");
      await page
        .getByRole("button", {
          name: theme === "light" ? "Sáng" : "Tối",
          exact: true,
        })
        .click();
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const tab of [
          "Tổng quan",
          "Lịch trình",
          "Chi phí",
          "Media",
          "Thêm",
        ]) {
          await nav(tab);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth > window.innerWidth,
            ),
            `Overflow ${theme}/${width}/${tab}`,
          ).toBe(false);
        }
        if (width === 1440) {
          await nav("Chi phí");
          await page.screenshot({
            path: `test-results/v241-${theme}-desktop-finance.png`,
            fullPage: true,
          });
        }
      }
    }
    await nav("Thêm");
    await page.getByRole("button", { name: "Thiết bị", exact: true }).click();
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await nav("Thêm");
    await page.locator("#module-trip").evaluate((el) => {
      (el as HTMLDetailsElement).open = true;
    });
    await page
      .locator("#module-trip")
      .getByRole("button", { name: "Xóa chuyến đi", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Xác nhận", exact: true })
      .click();
    await expect(page.locator(".trip-select")).toContainText("Các chuyến đi");
    await expect(page.locator(".error")).toHaveCount(0);
    expect(errors).toEqual([]);
    console.log(
      "PASS V2.4.1: five permission fields, owner grant persisted, viewer action visibility, offline Wallet+sync, theme persistence/system switching, 40 responsive views, delete-trip navigation/cache cleanup, no JS errors.",
    );
  } finally {
    await context.close();
    await browser.close();
    await db.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
