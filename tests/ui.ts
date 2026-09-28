/** Browser integration test: real app UI + PostgreSQL/PGlite; mock Supabase Auth and HTTP transport.
 * Not a replacement for live Supabase staging acceptance. See docs/TESTING.md. */
import { PGlite } from "@electric-sql/pglite";
import { chromium, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile, mkdir } from "node:fs/promises";
import { mutationSchema } from "../lib/validation";
async function main() {
  const db = new PGlite();
  const owner = randomUUID(),
    tid = randomUUID();
  await db.exec(
    `create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;insert into auth.users values('${owner}');`,
  );
  await db.exec(
    await readFile("supabase/migrations/202609250001_tripflow.sql", "utf8"),
  );
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
        app_version: "1.1.0",
        channel: "stable",
        database_version: "1.0.0",
        checked_at: new Date().toISOString(),
        ready: true,
        checks: [
          { key: "stable_marker", label: "Stable schema marker V1.0", ok: true },
          { key: "account_gate", label: "Account gate V0.2", ok: true },
          { key: "finance", label: "Finance integrity V0.3", ok: true },
          { key: "live_trip", label: "Live Trip history V0.4", ok: true },
          { key: "collaboration", label: "Collaboration V0.5", ok: true },
          { key: "backup_recovery", label: "Backup & Recovery V0.7", ok: true },
          { key: "idempotency", label: "Mutation idempotency", ok: true },
          { key: "single_active", label: "Single active itinerary guard", ok: true },
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
          role: "owner",
        };
        for (const [key, table] of Object.entries(tables)) {
          body[key] = (
            await db.query(
              `select * from ${table} where trip_id=$1 ${["items", "budgets", "expenses", "media", "participants"].includes(key) ? "and deleted_at is null" : ""} order by ${key === "audits" ? "created_at desc" : "id"}`,
              [tid],
            )
          ).rows;
        }
      } else
        body = {
          trips: (
            await db.query("select * from trips where deleted_at is null")
          ).rows,
        };
      await route.fulfill({ json: body });
    } catch (e) {
      await route.fulfill({
        status: 400,
        json: { error: (e as Error).message },
      });
    }
  });
  await mkdir("test-results", { recursive: true });
  try {
    await page.goto(process.env.UI_BASE_URL || "http://127.0.0.1:3000");
    await page.getByLabel("Email", { exact: true }).fill(user.email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill("testpassword");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Một chút Đà Lạt", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/mobile-home.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Ghi chi tiêu", exact: true })
      .click();
    await page.getByLabel("Số tiền VNĐ *", { exact: true }).fill("250000");
    await page.getByLabel("Nội dung chi *", { exact: true }).fill("Bữa trưa");
    await page
      .getByLabel("Thuộc khoản dự toán", { exact: true })
      .selectOption(food.id);
    await page.getByLabel("Người thanh toán", { exact: true }).fill("Huy");
    await page.screenshot({
      path: "test-results/mobile-expense.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Lưu thay đổi", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(
      Number(
        (await db.query<{ sum: string }>("select sum(amount) from expenses"))
          .rows[0].sum,
      ),
    ).toBe(370000);
    await page
      .locator(".bottom-nav")
      .getByRole("button", { name: "Lịch trình", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Tôi đã đến", exact: true })
      .last()
      .click();
    await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const active = (
      await db.query<{ title: string }>(
        "select title from itinerary_items where status='active'",
      )
    ).rows;
    expect(active).toEqual([{ title: "Nhận phòng homestay" }]);
    await page.screenshot({
      path: "test-results/mobile-route.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Sao chép hoạt động", exact: true })
      .last()
      .click();
    await expect(page.getByLabel("Hoạt động *", { exact: true })).toHaveValue(
      "Nhận phòng homestay (bản sao)",
    );
    await page
      .getByRole("button", { name: "Lưu thay đổi", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(
      Number(
        (
          await db.query<{ count: number }>(
            "select count(*) from itinerary_items",
          )
        ).rows[0].count,
      ),
    ).toBe(4);
    await page
      .locator(".bottom-nav")
      .getByRole("button", { name: "Media", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Gắn liên kết", exact: true })
      .first()
      .click();
    await page
      .getByLabel("Tên album hoặc tài liệu *", { exact: true })
      .fill("Đà Lạt qua ống kính");
    await page
      .getByLabel("Liên kết Google Drive hoặc HTTPS *", { exact: true })
      .fill("https://drive.google.com/drive/folders/tripflow-test");
    await page
      .getByRole("button", { name: "Lưu thay đổi", exact: true })
      .click();
    await expect(page.getByRole("link", { name: "Mở album" })).toBeVisible();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const tab of [
        "Tổng quan",
        "Lịch trình",
        "Chi phí",
        "Media",
        "Thêm",
      ]) {
        await page
          .locator(width <= 760 ? ".bottom-nav" : ".sidebar")
          .getByRole("button", { name: tab, exact: true })
          .click();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(overflow, `Horizontal overflow at ${width}/${tab}`).toBe(false);
      }
      await page
        .locator(width <= 760 ? ".bottom-nav" : ".sidebar")
        .getByRole("button", { name: "Tổng quan", exact: true })
        .click();
      if (width === 1440)
        await page.screenshot({
          path: "test-results/desktop-home.png",
          fullPage: true,
        });
    }
    expect(errors).toEqual([]);
    console.log(
      "PASS: login, record expense, atomic check-in, duplicate activity, Drive link, 20 responsive views, no browser exceptions.",
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
