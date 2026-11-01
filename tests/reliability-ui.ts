/** Browser integration test: real app UI + PostgreSQL/PGlite; mock Supabase Auth and HTTP transport.
 * Not a replacement for live Supabase staging acceptance. See docs/TESTING.md. */
import { PGlite } from "@electric-sql/pglite";
import { chromium, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile, mkdir, readdir } from "node:fs/promises";
import { VERSION } from "../lib/types";
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
  if (process.env.TRIPFLOW_FUND_TEST || process.env.TRIPFLOW_BOOKINGS_TEST)
    await mutate("participant", { name: "Mai Phụng", note: "" });
  if (process.env.TRIPFLOW_FUND_TEST)
    for (let i = 1; i <= 8; i++)
      await mutate("participant", { name: `Thành viên ${i}`, note: "" });
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
    viewport: {
      width:
        process.env.TRIPFLOW_FUND_TEST ||
        process.env.TRIPFLOW_BOOKINGS_TEST ||
        process.env.TRIPFLOW_MOBILE_TEST ||
        process.env.TRIPFLOW_POLISH_TEST
          ? 390
          : 1280,
      height: 844,
    },
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
        app_version: VERSION,
        channel: "stable",
        database_version: VERSION,
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
  let postDelay = 0,
    failNextPost = false;
  let reads = { list: 0, bundle: 0 };
  await page.route("**/api/tripflow*", async (route) => {
    if (process.env.TRIPFLOW_PERF_TEST) {
      if (route.request().method() === "GET") {
        if (new URL(route.request().url()).searchParams.has("trip"))
          reads.bundle++;
        else reads.list++;
      }
      await new Promise((r) => setTimeout(r, 120));
    }
    try {
      let body: Record<string, unknown>;
      if (route.request().method() === "POST") {
        if (postDelay)
          await new Promise((resolve) => setTimeout(resolve, postDelay));
        if (failNextPost) {
          failNextPost = false;
          throw new Error(
            "Không lưu được khoản chi thử nghiệm. Vui lòng thử lại.",
          );
        }
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
  await page.route("**/api/fund*", async (route) => {
    try {
      if (route.request().method() === "POST") {
        const r = (
          await db.query<any>("select tf_fund_mutate($1::jsonb) r", [
            JSON.stringify(route.request().postDataJSON()),
          ])
        ).rows[0].r;
        await route.fulfill({ json: { result: r } });
      } else {
        const tables = await Promise.all(
          ["trip_funds", "fund_targets", "fund_entries"].map((table) =>
            db.query<any>(
              `select * from ${table} where trip_id=$1 order by id`,
              [tid],
            ),
          ),
        );
        const json = JSON.parse(
          JSON.stringify({
            fund: tables[0].rows[0] || null,
            targets: tables[1].rows,
            entries: tables[2].rows,
          }),
          (key, value) =>
            ["due_on", "occurred_on"].includes(key) && typeof value === "string"
              ? value.slice(0, 10)
              : value,
        );
        await route.fulfill({ json });
      }
    } catch (e) {
      await route.fulfill({
        status: 400,
        json: { error: (e as Error).message },
      });
    }
  });
  await page.route("**/api/bookings*", async (route) => {
    try {
      if (route.request().method() === "POST") {
        const result = (
          await db.query<any>("select tf_booking_mutate($1::jsonb) r", [
            JSON.stringify(route.request().postDataJSON()),
          ])
        ).rows[0].r;
        await route.fulfill({ json: { booking: result } });
      } else
        await route.fulfill({
          json: {
            bookings: (
              await db.query(
                "select * from travel_bookings where trip_id=$1 and deleted_at is null",
                [tid],
              )
            ).rows,
          },
        });
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
    const nav = async (label: string) => {
      await page.waitForTimeout(150);
      const picker = page.locator(".module-picker");
      if (await picker.isVisible())
        await picker.getByRole("button", { name: "Đóng", exact: true }).click();
      await page
        .locator(
          (page.viewportSize()?.width || 390) <= 760
            ? ".bottom-nav"
            : ".sidebar",
        )
        .getByRole("button", { name: label, exact: true })
        .click();
    };
    await expect(page.locator(".daily-focus-card.current")).toContainText(
      "Dạo quanh hồ Xuân Hương",
    );
    if (process.env.TRIPFLOW_FUND_TEST) {
      await nav("Chi phí");
      await expect(
        page.locator(".finance-toolbar .segments button"),
      ).toHaveCount(5);
      await expect(page.locator(".money-banner")).toHaveCount(1);
      const dock = page.locator(".tf-command-dock");
      const zap = page.getByRole("button", {
        name: "Mở TripFlow Command Center",
        exact: true,
      });
      const origin = await zap.boundingBox();
      await page.mouse.move(origin!.x + 24, origin!.y + 24);
      await page.mouse.down();
      await page.mouse.move(30, 300, { steps: 12 });
      await page.mouse.up();
      await expect(dock).toHaveAttribute("data-side", "left");
      expect((await dock.boundingBox())!.x).toBeLessThan(10);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page
        .getByRole("button", { name: "Ẩn nút Quick", exact: true })
        .click();
      const reveal = page.getByRole("button", {
        name: "Hiện nút Quick",
        exact: true,
      });
      expect((await reveal.boundingBox())!.width).toBeLessThanOrEqual(28);
      await page.waitForTimeout(400);
      const small = await reveal.boundingBox();
      await page.mouse.move(small!.x + 12, small!.y + 15);
      await page.mouse.down();
      await page.mouse.move(360, 330, { steps: 12 });
      await page.mouse.up();
      await expect(dock).toHaveAttribute("data-side", "right");
      await page.waitForTimeout(400);
      await reveal.click();
      await zap.click();
      const command = page.getByRole("dialog");
      await expect(command).toBeVisible();
      expect((await command.boundingBox())!.height).toBeGreaterThanOrEqual(840);
      await expect(page.locator(".bottom-nav")).toBeHidden();
      await command.getByRole("button", { name: "Đóng", exact: true }).click();
      const cells = page.locator(".money-banner > div");
      expect(
        Math.abs(
          (await cells.nth(2).boundingBox())!.y -
            (await cells.nth(3).boundingBox())!.y,
        ),
      ).toBeLessThan(2);
      const kpis = page.locator(".wallet-kpi");
      expect(
        Math.abs(
          (await kpis.nth(0).boundingBox())!.y -
            (await kpis.nth(1).boundingBox())!.y,
        ),
      ).toBeLessThan(2);

      await expect(page.locator(".money-banner")).toContainText(
        "Chưa thiết lập",
      );
      for (const label of [
        "Dự toán",
        "Đối chiếu",
        "Thực chi",
        "Báo cáo",
        "Tổng quan",
      ]) {
        await page
          .locator(".finance-toolbar")
          .getByRole("button", { name: label, exact: true })
          .click();
        await expect(page.locator(".money-banner")).toBeVisible();
        await expect(page.locator(".money-banner > div")).toHaveCount(4);
      }
      await expect(page.locator(".travel-wallet-panel")).not.toContainText(
        "Còn trong ngân sách",
      );
      await page
        .getByRole("button", { name: "Quản lý quỹ", exact: true })
        .click();
      const dialog = page.locator(".fund-dialog");
      await expect(dialog.locator(".fund-list")).toBeVisible();
      expect(
        await dialog
          .locator(".fund-list")
          .evaluate((el) => getComputedStyle(el).overflowY),
      ).toBe("visible");
      await page.screenshot({
        path: "test-results/v292-management.png",
        fullPage: true,
      });
      await dialog
        .getByRole("button", { name: "Người giữ quỹ", exact: true })
        .click();
      await dialog
        .getByLabel("Người giữ quỹ", { exact: true })
        .selectOption({ label: "Mai Phụng" });
      await dialog
        .getByRole("button", { name: "Lưu quỹ", exact: true })
        .click();
      await expect(dialog.locator(".fund-form")).toHaveCount(0);
      const member = dialog.locator(".fund-list article").first();
      const firstName = await member.locator("b").first().innerText();
      await dialog
        .getByLabel("Tìm thành viên", { exact: true })
        .fill(firstName);
      await expect(dialog.locator(".fund-member-row")).toHaveCount(1);
      await member
        .getByRole("button", { name: "Mức đóng", exact: true })
        .click();
      await dialog
        .getByLabel("Mục tiêu đóng (VNĐ)", { exact: true })
        .fill("1000000");
      await dialog.getByLabel("Hạn đóng", { exact: true }).fill("2026-11-05");
      for (const width of [320, 390, 430]) {
        await page.setViewportSize({ width, height: 844 });
        const box = await dialog.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(840);
        expect(box!.x).toBe(0);
        expect(
          await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        ).toBe(true);
        for (const input of await dialog.locator("input,select").all()) {
          if (!(await input.isVisible())) continue;
          const r = await input.boundingBox();
          expect(r!.x).toBeGreaterThanOrEqual(0);
          expect(r!.x + r!.width).toBeLessThanOrEqual(width + 1);
        }
        const cancel = await dialog
            .getByRole("button", { name: "Hủy nhập", exact: true })
            .boundingBox(),
          save = await dialog
            .getByRole("button", { name: "Lưu quỹ", exact: true })
            .boundingBox();
        expect(cancel!.x).toBeLessThan(save!.x);
        await page.screenshot({ path: `test-results/v293-form-${width}.png` });
      }
      await page.setViewportSize({ width: 390, height: 844 });

      await expect(dialog.locator(".fund-management")).toHaveCount(0);
      const footer = await dialog.locator(".fund-form-footer").boundingBox();
      expect(footer!.y + footer!.height).toBeGreaterThan(700);
      await expect(
        dialog.getByRole("button", { name: "Lưu quỹ", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: "test-results/v292-target-form.png",
        fullPage: true,
      });
      await dialog
        .getByRole("button", { name: "Lưu quỹ", exact: true })
        .click();
      await expect(member).toContainText("1.000.000");
      await expect(dialog.locator(".fund-form")).toHaveCount(0);
      await member
        .getByRole("button", { name: "Ghi đóng quỹ", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Lưu quỹ", exact: true })
        .click();
      await expect(dialog.locator(".fund-cash-hero")).toContainText(
        "1.000.000",
      );
      await dialog
        .getByRole("button", { name: "Hoàn / trả", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Hoàn ứng", exact: true })
        .first()
        .click();
      await dialog
        .getByRole("button", { name: "Lưu quỹ", exact: true })
        .click();
      await expect(dialog.locator(".fund-form")).toHaveCount(0);
      await dialog
        .getByRole("button", { name: "Trả quỹ", exact: true })
        .first()
        .click();
      await dialog.getByLabel("Số tiền (VNĐ)", { exact: true }).fill("50000");
      await dialog
        .getByRole("button", { name: "Lưu quỹ", exact: true })
        .click();
      await expect(dialog.locator(".fund-form")).toHaveCount(0);
      await dialog.getByRole("button", { name: "Sổ quỹ", exact: true }).click();
      await expect(dialog.locator(".fund-list article")).toHaveCount(3);
      await page.screenshot({
        path: "test-results/v290-fund-mobile-dark.png",
        fullPage: true,
      });
      for (const width of [320, 390, 430, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        expect(
          await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        ).toBe(true);
        await page.screenshot({
          path: `test-results/v290-fund-${width}.png`,
          fullPage: true,
        });
      }
      await context.setOffline(true);
      await dialog
        .getByRole("button", { name: "Tải lại quỹ", exact: true })
        .click();
      await expect(dialog).toContainText("Bản đã lưu: chỉ xem");
      await expect(
        dialog.getByRole("button", { name: "Người giữ quỹ", exact: true }),
      ).toBeDisabled();
      await context.setOffline(false);
      await dialog
        .getByRole("button", { name: "Tải lại quỹ", exact: true })
        .click();
      await expect(
        dialog.getByRole("button", { name: "Người giữ quỹ", exact: true }),
      ).toBeEnabled();
      await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await page.getByRole("button", { name: "Thực chi", exact: true }).click();
      await page
        .getByRole("button", { name: "Ghi chi tiêu", exact: true })
        .first()
        .click();
      await page.getByLabel("Số tiền VNĐ *", { exact: true }).fill("150000");
      await page
        .getByLabel("Nội dung chi *", { exact: true })
        .fill("Taxi chi từ quỹ");
      await page.getByLabel("Nguồn tiền", { exact: true }).selectOption("fund");
      await expect(page.locator(".smart-default-banner")).toHaveCount(0);
      await page.locator(".smart-form-toggle").click();
      const expenseDialog = page.getByRole("dialog");
      const noOverflow = await expenseDialog.evaluate((el) => {
        const bounds = el.getBoundingClientRect();
        return Array.from(
          el.querySelectorAll("input:not([type=hidden]),select,textarea"),
        )
          .filter((n) => (n as HTMLElement).offsetParent !== null)
          .every((n) => {
            const r = n.getBoundingClientRect();
            return r.left >= bounds.left && r.right <= bounds.right + 1;
          });
      });
      expect(noOverflow).toBe(true);
      const cancelRect = await expenseDialog
          .getByRole("button", { name: "Hủy", exact: true })
          .boundingBox(),
        saveRect = await expenseDialog
          .getByRole("button", { name: "Lưu thay đổi", exact: true })
          .boundingBox();
      expect(cancelRect!.x).toBeLessThan(saveRect!.x);
      await page.screenshot({ path: "test-results/v293-expense-modal.png" });

      await page
        .getByRole("button", { name: "Lưu thay đổi", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.locator(".ledger-row").filter({ hasText: "Taxi chi từ quỹ" }),
      ).toContainText("Quỹ chuyến đi");
      await page
        .locator(".finance-toolbar")
        .getByRole("button", { name: "Tổng quan", exact: true })
        .click();
      await expect(page.locator(".money-banner")).toContainText("680.000");
      for (const width of [320, 390, 430, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        await page.evaluate(() => window.scrollTo(0, 0));
        expect(
          await page
            .locator(".money-banner")
            .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        ).toBe(true);
        await page.screenshot({
          path: `test-results/v292-summary-${width}.png`,
        });
      }

      await page.locator(".theme-compact").click();
      await page.locator(".theme-compact").click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      await page.screenshot({
        path: "test-results/v290-fund-light.png",
        fullPage: true,
      });
      expect(errors).toEqual([]);
      console.log(
        "PASS V2.9 fund UI: three finance tabs, setup, per-member targets, contribution, reimbursement, return, responsive 320/390/430/1280, cached offline read and write guards.",
      );
      return;
    }
    if (process.env.TRIPFLOW_BOOKINGS_TEST) {
      await expect(page.locator(".connection-dot.ready")).toBeVisible();
      await page.route("**/api/version", (route) =>
        route.fulfill({ status: 503, json: { error: "test" } }),
      );
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(page.locator(".connection-dot.checking")).toBeVisible();
      await page.unroute("**/api/version");
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(page.locator(".connection-dot.ready")).toBeVisible();
      await nav("Thêm");
      const picker = page.getByRole("dialog", {
        name: "Thêm chức năng",
        exact: true,
      });
      await expect(picker.locator(".module-tile")).toHaveCount(14);
      await page.screenshot({
        path: "test-results/v280-module-grid.png",
        fullPage: true,
      });
      await picker
        .getByRole("button", {
          name: "Đặt chỗ & tài liệu Mở quản lý",
          exact: true,
        })
        .click();
      await expect(picker).toHaveCount(0);
      await page
        .getByRole("button", { name: "Thêm đặt chỗ / tài liệu", exact: true })
        .click();
      await page
        .getByLabel("Tên đặt chỗ / tài liệu *", { exact: true })
        .fill("La Vague booking");
      await page.getByLabel("Mã xác nhận", { exact: true }).fill("LV12345");
      await page
        .getByText("Thông tin bổ sung & liên kết", { exact: true })
        .click();
      await page
        .getByLabel("Người đứng tên", { exact: true })
        .selectOption({ label: "Mai Phụng" });
      await page
        .getByLabel("Địa điểm", { exact: true })
        .fill("Villa Melia Hồ Tràm");
      await page
        .getByLabel("Bắt đầu / nhận phòng", { exact: true })
        .fill("2026-11-01T14:00");
      await page
        .getByLabel("Kết thúc / trả phòng", { exact: true })
        .fill("2026-11-02T12:00");
      await page
        .getByRole("button", { name: "Lưu đặt chỗ", exact: true })
        .click();
      await expect(page.locator(".booking-card")).toContainText(
        "La Vague booking",
      );
      await expect(page.locator(".booking-card")).toContainText("LV12345");
      for (const width of [320, 390, 430, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        const card = page.locator(".booking-card").first();
        await expect(card).toBeVisible();
        if ((await card.locator("details").getAttribute("open")) === null)
          await card.locator("summary").click();
        await expect(card.locator("dt").first()).toBeVisible();
        expect(
          await card.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        ).toBe(true);
        expect(
          await card
            .locator("dt")
            .first()
            .evaluate((el) => el.getBoundingClientRect().width),
        ).toBeGreaterThan(100);
        await page.screenshot({
          path: `test-results/v290-booking-details-${width}.png`,
          fullPage: true,
        });
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await db.exec("set role postgres");
      await db.query(
        "update travel_bookings set payload=jsonb_set(payload,'{holder}','\"Khách cũ\"'::jsonb) where trip_id=$1",
        [tid],
      );
      await db.exec("set role authenticated");
      await page
        .getByRole("button", { name: "Tải lại đặt chỗ", exact: true })
        .click();
      await expect(page.locator(".booking-card")).toContainText("Khách cũ");
      await page
        .locator(".booking-card")
        .getByRole("button", { name: "Sửa", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Lưu đặt chỗ", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(
        (
          await db.query<any>(
            "select payload->>'holder' holder from travel_bookings where trip_id=$1",
            [tid],
          )
        ).rows[0].holder,
      ).toBe("Khách cũ");
      await page
        .getByRole("button", { name: "Thêm đặt chỗ / tài liệu", exact: true })
        .click();
      await page
        .getByLabel("Tên đặt chỗ / tài liệu *", { exact: true })
        .fill("Voucher khách sạn");
      await page.getByLabel("Loại", { exact: true }).selectOption("document");
      await page
        .getByLabel("Link vé / tài liệu HTTPS", { exact: true })
        .fill("https://example.com/voucher");
      await page
        .getByRole("button", { name: "Lưu đặt chỗ", exact: true })
        .click();
      await page.getByRole("button", { name: "Tài liệu", exact: true }).click();
      await expect(page.locator(".booking-card")).toContainText(
        "Voucher khách sạn",
      );
      await page.screenshot({
        path: "test-results/v280-bookings.png",
        fullPage: true,
      });
      await page.getByRole("button", { name: "Sửa", exact: true }).click();
      await page
        .getByLabel("Tên đặt chỗ / tài liệu *", { exact: true })
        .fill("Voucher đã sửa");
      await page
        .getByRole("button", { name: "Lưu đặt chỗ", exact: true })
        .click();
      await expect(page.locator(".booking-card")).toContainText(
        "Voucher đã sửa",
      );
      await page.getByRole("button", { name: "Xóa", exact: true }).click();
      await expect(page.locator(".booking-card")).toHaveCount(0);
      await context.setOffline(true);
      await expect(page.locator(".connection-dot.offline")).toBeVisible();
      await page
        .getByRole("button", { name: "Tải lại đặt chỗ", exact: true })
        .click();
      await page.getByRole("button", { name: "Tất cả", exact: true }).click();
      await expect(page.locator(".booking-card")).toContainText("LV12345");
      await expect(
        page.getByRole("button", {
          name: "Thêm đặt chỗ / tài liệu",
          exact: true,
        }),
      ).toBeDisabled();
      await context.setOffline(false);
      expect(errors).toEqual([]);
      console.log(
        "PASS V2.8: module grid, management screen, booking overnight create, document create/edit/delete, cached offline read, write disabled offline, green/red connection indicators, no JS errors.",
      );
      return;
    }
    if (process.env.TRIPFLOW_MOBILE_TEST) {
      await nav("Thêm");
      await page.locator("#module-trip > summary").click();
      const sheet = page.getByRole("dialog");
      await expect(sheet.locator(".more-section-menu")).toBeVisible();
      await sheet
        .getByRole("button", { name: "Chia sẻ & phân quyền", exact: true })
        .click();
      await expect(sheet.locator(".permission-grants .pill")).toHaveCount(5);
      await sheet
        .getByRole("button", { name: "Các mục quản lý", exact: true })
        .click();
      await sheet
        .getByRole("button", { name: "Người tham gia", exact: true })
        .click();
      await expect(
        sheet
          .getByRole("heading", { name: "Người tham gia", exact: true })
          .last(),
      ).toBeVisible();
      await page.screenshot({
        path: "test-results/v270-mobile-members.png",
        fullPage: true,
      });
      await page.goBack();
      await expect(sheet).toHaveCount(0);
      await page.screenshot({
        path: "test-results/v270-mobile-more.png",
        fullPage: true,
      });
      await nav("Lịch trình");
      const row = page.locator(".timeline-row").first();
      await expect(row).toBeVisible();
      const card = await row.locator(".stop-panel").boundingBox();
      expect(card!.width).toBeGreaterThan(300);
      await row.dispatchEvent("pointerdown", {
        pointerType: "touch",
        clientX: 260,
        clientY: 200,
      });
      await row.dispatchEvent("pointermove", {
        pointerType: "touch",
        clientX: 255,
        clientY: 260,
      });
      await expect(row.locator(".swipe-actions")).toHaveCount(0);
      await row.dispatchEvent("pointerdown", {
        pointerType: "touch",
        clientX: 260,
        clientY: 200,
      });
      await row.dispatchEvent("pointermove", {
        pointerType: "touch",
        clientX: 160,
        clientY: 202,
      });
      await expect(row.locator(".swipe-actions")).toBeVisible();
      await row
        .locator(".swipe-actions")
        .getByRole("button", { name: "Sửa", exact: true })
        .click();
      await expect(sheet).toBeVisible();
      await page.goBack();
      await expect(sheet).toHaveCount(0);
      await expect(
        page.locator('.screen-content[data-screen="route"]'),
      ).toBeVisible();
      await page.screenshot({
        path: "test-results/v270-mobile-timeline.png",
        fullPage: true,
      });
      await nav("Chi phí");
      await page.goBack();
      await expect(
        page.locator('.screen-content[data-screen="route"]'),
      ).toBeVisible();
      expect(errors).toEqual([]);
      console.log(
        "PASS V2.7 mobile: More drill-down sheet, permissions, back closes sheet/editor first, tab history, wide compact timeline, vertical gesture safe, swipe edit, no JS errors.",
      );
      return;
    }
    if (process.env.TRIPFLOW_PERF_TEST) {
      await nav("Chi phí");
      await page
        .getByRole("button", { name: "Ghi chi tiêu", exact: true })
        .first()
        .click();
      await page.getByLabel("Số tiền VNĐ *", { exact: true }).fill("250000");
      await page
        .getByLabel("Nội dung chi *", { exact: true })
        .fill("Performance fixture");
      reads = { list: 0, bundle: 0 };
      const start = performance.now();
      await page
        .getByRole("button", { name: "Lưu thay đổi", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const elapsed = performance.now() - start;
      await new Promise((r) => setTimeout(r, 700));
      console.log(
        "PERFORMANCE " +
          JSON.stringify({
            saveToDialogClosedMs: Math.round(elapsed),
            listReads: reads.list,
            bundleReads: reads.bundle,
            fixtureLatencyPerApiMs: 120,
          }),
      );
      return;
    }
    if (process.env.TRIPFLOW_POLISH_TEST) {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await nav("Chi phí");
      await expect(
        page.locator('.screen-content[data-screen="money"]'),
      ).toBeVisible();
      await expect(
        page.locator('.bottom-nav [aria-current="page"]'),
      ).toHaveText("Chi phí");
      const openExpense = page
        .getByRole("button", { name: "Ghi chi tiêu", exact: true })
        .first();
      await openExpense.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      expect(
        await dialog.evaluate((el) => getComputedStyle(el).animationName),
      ).toBe("tf-dialog-enter");
      await page.getByLabel("Số tiền VNĐ *", { exact: true }).fill("75000");
      await page
        .getByLabel("Nội dung chi *", { exact: true })
        .fill("Motion pending fixture");
      await page.screenshot({
        path: "test-results/v260-dark-mobile-editor.png",
        fullPage: true,
      });
      failNextPost = true;
      postDelay = 700;
      await dialog
        .getByRole("button", { name: "Lưu thay đổi", exact: true })
        .click();
      await expect(dialog).toHaveAttribute("aria-busy", "true");
      await expect(
        dialog.getByRole("button", { name: "Đóng", exact: true }),
      ).toBeDisabled();
      await expect(dialog.locator(".tf-busy-icon")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("alert")).toContainText(
        "Không lưu được khoản chi thử nghiệm",
      );
      await expect(
        page.getByLabel("Nội dung chi *", { exact: true }),
      ).toHaveValue("Motion pending fixture");
      postDelay = 0;
      await dialog
        .getByRole("button", { name: "Lưu thay đổi", exact: true })
        .click();
      await expect(dialog).toHaveCount(0);
      await expect(openExpense).toBeFocused();
      await expect(page.locator(".tf-toast.success")).toContainText(
        "Đã lưu trên hệ thống",
      );
      await page.locator(".tf-toast").hover();
      await new Promise((resolve) => setTimeout(resolve, 6200));
      await expect(page.locator(".tf-toast")).toBeVisible();
      await page
        .getByRole("button", { name: "Đóng thông báo", exact: true })
        .click();
      await expect(page.locator(".tf-toast")).toHaveCount(0);
      await page
        .getByRole("button", { name: "Tải lại dữ liệu", exact: true })
        .click();
      await expect(page.locator(".tf-toast.info")).toContainText(
        "Đang cập nhật dữ liệu",
      );
      await page
        .getByRole("button", { name: "Đóng thông báo", exact: true })
        .click();
      await page.evaluate(() => {
        document.documentElement.dataset.pwa = "standalone";
      });
      const quick = page.getByRole("button", {
        name: "Mở TripFlow Command Center",
        exact: true,
      });
      await quick.click();
      await expect(dialog).toHaveClass(/dialog-sheet/);
      await expect
        .poll(async () => {
          const box = await dialog.boundingBox();
          return box ? Math.round(box.y + box.height) : 0;
        })
        .toBe(844);
      expect(
        await dialog.evaluate((el) => getComputedStyle(el).animationName),
      ).toBe("tf-sheet-enter");
      await page.screenshot({
        path: "test-results/v260-dark-mobile-sheet.png",
        fullPage: true,
      });
      await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
      await expect(quick).toBeFocused();
      await page.emulateMedia({ reducedMotion: "reduce" });
      await quick.click();
      expect(
        await dialog.evaluate((el) => getComputedStyle(el).animationName),
      ).toBe("none");
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.evaluate(() => {
        delete document.documentElement.dataset.pwa;
      });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await quick.click();
      await expect
        .poll(async () => {
          const box = await dialog.boundingBox();
          return box ? Math.round(box.x + box.width / 2) : 0;
        })
        .toBe(720);
      await expect
        .poll(async () => {
          const box = await dialog.boundingBox();
          return box ? Math.round(box.y + box.height / 2) : 0;
        })
        .toBe(500);
      await page.screenshot({
        path: "test-results/v260-dark-desktop-dialog.png",
        fullPage: true,
      });
      await page.keyboard.press("Escape");
      await nav("Thêm");
      await page.getByRole("button", { name: "Sáng", exact: true }).click();
      await nav("Tổng quan");
      await page.screenshot({
        path: "test-results/v260-light-desktop-home.png",
        fullPage: true,
      });
      await nav("Chi phí");
      await openExpense.click();
      const contrast = await dialog
        .getByRole("button", { name: "Lưu thay đổi", exact: true })
        .evaluate((el) => {
          const style = getComputedStyle(el);
          const [a, b] = [style.color, style.backgroundColor].map((color) => {
            const rgb = color
              .match(/[\d.]+/g)!
              .slice(0, 3)
              .map(Number)
              .map((n) => n / 255)
              .map((n) =>
                n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4,
              );
            return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
          });
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        });
      expect(contrast).toBeGreaterThanOrEqual(4.5);
      await page.keyboard.press("Escape");
      expect(errors).toEqual([]);
      console.log(
        "PASS V2.6 polish: normal/reduced motion, mobile PWA sheet, centered desktop dialog, pending close guard, inline error+retry preserves draft, keyboard focus return, success/info toast+pause+dismiss, primary contrast, no JS errors.",
      );
      return;
    }
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
    await expect(page.locator(".money-banner")).toContainText("2.830.000");
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
      "PASS V2.7.0 regression: five permission fields, owner grant persisted, viewer action visibility, offline Wallet+sync, theme persistence/system switching, 40 responsive views, delete-trip navigation/cache cleanup, no JS errors.",
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
