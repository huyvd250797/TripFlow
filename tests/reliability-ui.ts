/** Browser integration test: real app UI + PostgreSQL/PGlite; mock Supabase Auth and HTTP transport.
 * Not a replacement for live Supabase staging acceptance. See docs/TESTING.md. */
import { PGlite } from "@electric-sql/pglite";
import { chromium, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile, mkdir, readdir } from "node:fs/promises";
import { VERSION, DATABASE_VERSION } from "../lib/types";
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
  if (process.env.TRIPFLOW_COST_TEST)
    for (const name of ["A", "B", "C", "D", "Không chia"])
      await mutate("participant", { name, note: "" });
  if (process.env.TRIPFLOW_PREPARATION_TEST)
    for (const [name, age_group] of [
      ["Mai Phụng", "adult"],
      ["Bé Bún", "infant"],
      ["Anh Hai", "child"],
    ])
      await mutate("participant", {
        name,
        note: "",
        age_group,
        family_group: "Gia đình",
        needs_note: age_group === "infant" ? "Mang bình sữa" : "",
      });
  if (process.env.TRIPFLOW_ROUTE_TEST) {
    for (const [title, hour, mode] of [
      ["Ăn sáng linh hoạt", 0, "flexible"],
      ["Tham quan linh hoạt", 2, "flexible"],
      ["Tour cố định", 4, "fixed"],
    ] as const)
      await mutate("item", {
        title,
        location: title + ", Đà Lạt",
        start_at: `2026-09-26T${String(hour).padStart(2, "0")}:00:00Z`,
        end_at: `2026-09-26T${String(hour + 1).padStart(2, "0")}:00:00Z`,
        time_mode: mode,
        earliest_at: mode === "fixed" ? "2026-09-26T04:00:00Z" : null,
        latest_at: mode === "fixed" ? "2026-09-26T05:00:00Z" : null,
        map_url: "",
        note: "",
      });
  }
  if (process.env.TRIPFLOW_LAYOUT_TEST) {
    for (let i = 0; i < 12; i++)
      await mutate("participant", {
        name: `Thành viên ${i + 1} có tên dài kiểm tra giao diện`,
        note: "",
      });
    for (let i = 0; i < 14; i++)
      await mutate("budget", {
        title: `Khoản dự toán ${i + 1} có tên dài kiểm tra bố cục`,
        category: "Khác",
        quantity: 1,
        unit_price: 150000,
        note: "",
      });
  }
  if (process.env.TRIPFLOW_LAYOUT_TEST)
    await db.exec(
      `set role postgres;update budget_items set cost_sharing='{"mode":"equal"}'::jsonb;set role authenticated;`,
    );
  if (process.env.TRIPFLOW_SETTLEMENT_TEST) {
    const huy = await mutate("participant", { name: "Huy", note: "" });
    for (const name of ["Mai Phụng", "Anh Hai"])
      await mutate("participant", { name, note: "" });
    await db.exec("set role postgres");
    await db.query(
      'update budget_items set cost_sharing=\'{"mode":"equal"}\'::jsonb,quantity=1,unit_price=900000 where id=$1',
      [food.id],
    );
    await db.query(
      "update budget_items set deleted_at=now() where trip_id=$1 and id<>$2",
      [tid, food.id],
    );
    await db.query(
      "update expenses set amount=900000,payer_participant_id=$1,settlement_type='direct' where trip_id=$2",
      [huy.id, tid],
    );
    await db.exec("set role authenticated");
  }
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
        process.env.TRIPFLOW_PALETTE_TEST ||
        process.env.TRIPFLOW_LAYOUT_TEST ||
        process.env.TRIPFLOW_ROUTE_TEST ||
        process.env.TRIPFLOW_PREPARATION_TEST ||
        process.env.TRIPFLOW_COST_TEST ||
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
    wishes: "trip_wishes",
    checklist: "trip_checklist_items",
    contacts: "trip_contacts",
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
        database_version: DATABASE_VERSION,
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
  let refreshDelay = 0,
    refreshFailure = false;
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
      if (route.request().method() === "GET" && refreshDelay)
        await new Promise((resolve) => setTimeout(resolve, refreshDelay));
      if (route.request().method() === "GET" && refreshFailure)
        throw new Error("Lỗi tải dữ liệu mô phỏng");
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
            can_close_settlement: viewRole === "owner",
          },
        };
        for (const [key, table] of Object.entries(tables)) {
          body[key] = (
            await db.query(
              `select * from ${table} where trip_id=$1 ${["items", "budgets", "expenses", "media", "participants", "checklist", "contacts", "wishes"].includes(key) ? "and deleted_at is null" : ""} order by ${key === "audits" ? "created_at desc" : "id"}`,
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
        ["start_date", "end_date", "spent_on", "taken_on", "due_on"].includes(
          key,
        ) && typeof value === "string"
          ? value.slice(0, 10)
          : value,
      );
      await route.fulfill({ json: normalized });
    } catch (e) {
      await route.fulfill({
        status: /CONFLICT|ROUTE_CONTEXT_CHANGED/.test((e as Error).message)
          ? 409
          : 400,
        json: { error: (e as Error).message },
      });
    }
  });
  await page.route("**/api/settlement*", async (route) => {
    try {
      if (route.request().method() === "POST" && viewRole === "viewer") {
        await route.fulfill({
          status: 403,
          json: { error: "Bạn chỉ có quyền xem quyết toán." },
        });
        return;
      }
      const post = route.request().method() === "POST";
      const result = (
        await db.query<any>(
          post
            ? "select tf_settlement_mutate($1::jsonb) r"
            : "select tf_settlement_snapshot($1) r",
          [post ? JSON.stringify(route.request().postDataJSON()) : tid],
        )
      ).rows[0].r;
      if (viewRole === "viewer") result.can_close = false;
      await route.fulfill({ json: result });
    } catch (e) {
      const error = (e as Error).message;
      await route.fulfill({
        status: error.includes("STALE_VERSION") ? 409 : 400,
        json: { error },
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
    if (process.env.TRIPFLOW_ROUTE_TEST) {
      for (const width of [320, 390, 430, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        for (const theme of ["Sáng", "Tối"]) {
          await page.getByRole("button", { name: theme, exact: true }).click();
          const auth = page.locator(".auth-card");
          await expect(auth).toBeVisible();
          expect(
            await auth.evaluate((el) => getComputedStyle(el).borderTopWidth),
          ).toBe("0px");
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
          ).toBe(true);
          expect(
            await auth.locator("input").evaluateAll((inputs) =>
              inputs.every((el) => {
                const r = el.getBoundingClientRect();
                return r.left >= 0 && r.right <= innerWidth + 1;
              }),
            ),
          ).toBe(true);
          await page.screenshot({
            path: `test-results/v212-auth-${width}-${theme === "Tối" ? "dark" : "light"}.png`,
          });
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
    }
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
    if (process.env.TRIPFLOW_SETTLEMENT_TEST) {
      await nav("Chi phí");
      await page
        .locator(".finance-toolbar")
        .getByRole("button", { name: "Báo cáo", exact: true })
        .click();
      const panel = page.locator(".settlement-panel");
      await expect(panel).toContainText("600.000");
      await panel
        .getByRole("button", { name: "Quyết toán", exact: true })
        .click();
      const dialog = page.locator(".settlement-dialog");
      await expect(dialog).toBeVisible();
      for (const mode of ["light", "dark"]) {
        await page.evaluate((mode) => {
          document.documentElement.dataset.theme = mode;
        }, mode);
        for (const width of [320, 390, 768, 1280]) {
          await page.setViewportSize({ width, height: 844 });
          for (const label of ["Theo người", "Chuyển tiền", "Lịch sử"]) {
            await dialog
              .getByRole("button", { name: label, exact: true })
              .click();
            const leak = await dialog.evaluate((el) =>
              Array.from(el.querySelectorAll("button,input,select,article"))
                .filter((x) => x.getClientRects().length)
                .some((x) => {
                  const r = x.getBoundingClientRect();
                  return r.left < 0 || r.right > innerWidth + 1;
                }),
            );
            expect(leak, mode + width + label).toBe(false);
          }
          if (width === 390) {
            await dialog
              .getByRole("button", { name: "Theo người", exact: true })
              .click();
            await page.screenshot({
              path: `test-results/v2130-people-${mode}.png`,
            });
          }
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await dialog
        .getByRole("button", { name: "Chuyển tiền", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Ghi nhận", exact: true })
        .first()
        .click();
      await dialog.getByLabel("Số tiền đã chuyển (VNĐ)").fill("100000");
      await dialog.getByLabel("Ghi chú quyết toán").fill("Thanh toán một phần");
      await dialog
        .getByRole("button", { name: "Xác nhận", exact: true })
        .click();
      await expect(dialog).toContainText("Đã ghi nhận.");
      await expect(dialog.locator(".settlement-body")).toHaveAttribute(
        "aria-busy",
        "false",
      );
      await dialog
        .getByRole("button", { name: "Lịch sử", exact: true })
        .click();
      await expect(dialog).toContainText("Thanh toán một phần");
      await dialog
        .getByRole("button", { name: "Hủy giao dịch", exact: true })
        .click();
      await dialog.getByLabel("Ghi chú quyết toán").fill("Sửa thông tin");
      await dialog
        .getByRole("button", { name: "Xác nhận", exact: true })
        .click();
      await expect(dialog).toContainText("Đã hủy");
      await expect(dialog.locator(".settlement-body")).toHaveAttribute(
        "aria-busy",
        "false",
      );
      // An intervening write invalidates the captured form revision.
      await dialog
        .getByRole("button", { name: "Chuyển tiền", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Ghi nhận", exact: true })
        .first()
        .click();
      await db.exec("set role postgres");
      await db.query(
        "update budget_items set note='Đã thay đổi trên thiết bị khác' where id=$1",
        [food.id],
      );
      await db.exec("set role authenticated");
      await dialog
        .getByRole("button", { name: "Xác nhận", exact: true })
        .click();
      await expect(dialog).toContainText("STALE_VERSION");
      await expect(dialog.locator(".settlement-body")).toHaveAttribute(
        "aria-busy",
        "false",
      );
      // Complete all currently suggested transfers, then close/reopen.
      for (let i = 0; i < 3; i++) {
        const record = dialog.getByRole("button", {
          name: "Ghi nhận",
          exact: true,
        });
        if (!(await record.count())) break;
        await record.first().click();
        await dialog
          .getByRole("button", { name: "Xác nhận", exact: true })
          .click();
        await expect(dialog).toContainText("Đã ghi nhận.");
        await expect(dialog.locator(".settlement-body")).toHaveAttribute(
          "aria-busy",
          "false",
        );
      }
      await expect(
        dialog.getByRole("button", { name: "Chốt quyết toán", exact: true }),
      ).toBeEnabled();
      await dialog
        .getByRole("button", { name: "Chốt quyết toán", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Xác nhận", exact: true })
        .click();
      await expect(
        dialog.getByRole("button", { name: "Mở lại quyết toán", exact: true }),
      ).toBeVisible();
      await dialog
        .getByRole("button", { name: "Mở lại quyết toán", exact: true })
        .click();
      await dialog.getByLabel("Ghi chú quyết toán").fill("Bổ sung");
      await dialog
        .getByRole("button", { name: "Xác nhận", exact: true })
        .click();
      await expect(
        dialog.getByRole("button", { name: "Chốt quyết toán", exact: true }),
      ).toBeVisible();
      await context.setOffline(true);
      await dialog
        .getByRole("button", { name: "Đóng", exact: true })
        .last()
        .click();
      await panel
        .getByRole("button", { name: "Quyết toán", exact: true })
        .click();
      await expect(dialog).toContainText("Đang xem bản đã tải");
      await expect(
        dialog.getByRole("button", { name: "Chốt quyết toán", exact: true }),
      ).toBeDisabled();
      await context.setOffline(false);
      await dialog
        .getByRole("button", { name: "Đóng", exact: true })
        .last()
        .click();
      viewRole = "viewer";
      await page.reload();
      await expect(page.locator(".topbar")).toBeVisible();
      await nav("Chi phí");
      await page
        .locator(".finance-toolbar")
        .getByRole("button", { name: "Báo cáo", exact: true })
        .click();
      await page
        .locator(".settlement-panel")
        .getByRole("button", { name: "Quyết toán", exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Chuyển tiền", exact: true })
        .click();
      await expect(
        dialog.getByRole("button", { name: "Chốt quyết toán", exact: true }),
      ).toHaveCount(0);
      expect(errors).toEqual([]);
      console.log(
        "PASS V2.13: responsive light/dark settlement, partial transfer, reversal, stale revision, close/reopen, offline cached read and Viewer.",
      );
      return;
    }
    if (process.env.TRIPFLOW_PALETTE_TEST) {
      await nav("Thêm");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /Giao diện/ })
        .click();
      const palette = page.locator(".palette-control");
      await expect(palette).toBeVisible();
      const original = await page
        .locator(".btn.primary")
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundImage);
      for (const name of [
        "Đại dương",
        "Tím hoàng hôn",
        "Hồng san hô",
        "Rừng xanh",
        "Nắng ấm",
      ]) {
        await palette.getByRole("button", { name, exact: true }).click();
        await expect(
          palette.getByRole("button", { name, exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        for (const mode of ["Sáng", "Tối"]) {
          await page.getByRole("button", { name: mode, exact: true }).click();
          for (const width of [320, 390, 768, 1280]) {
            await page.setViewportSize({ width, height: 844 });
            expect(
              await palette.evaluate((el) => {
                const box = el.getBoundingClientRect();
                return {
                  fits: box.left >= 0 && box.right <= innerWidth + 1,
                  box: { left: box.left, right: box.right, width: innerWidth },
                  leaks: Array.from(el.querySelectorAll("button,input"))
                    .filter((x) => x.getClientRects().length)
                    .map((x) => {
                      const r = x.getBoundingClientRect();
                      return {
                        text: x.textContent || x.getAttribute("aria-label"),
                        left: r.left,
                        right: r.right,
                      };
                    })
                    .filter(
                      (r) => r.left < box.left - 1 || r.right > box.right + 1,
                    ),
                };
              }),
              `palette ${name} ${mode} ${width}`,
            ).toMatchObject({ fits: true, leaks: [] });
          }
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await palette.locator("summary").click();
      await palette
        .getByLabel("Màu bắt đầu · mã HEX", { exact: true })
        .fill("#FFFFFF");
      await palette
        .getByLabel("Màu kết thúc · mã HEX", { exact: true })
        .fill("bad");
      await expect(
        palette.getByRole("button", { name: "Lưu màu", exact: true }),
      ).toBeDisabled();
      await palette
        .getByLabel("Màu kết thúc · mã HEX", { exact: true })
        .fill("#CC55EE");
      await palette
        .getByRole("button", { name: "Lưu màu", exact: true })
        .click();
      await expect(page.locator("html")).toHaveAttribute(
        "data-palette",
        "custom",
      );
      const saved = await page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--palette-end"),
      );
      await palette
        .getByLabel("Màu bắt đầu · mã HEX", { exact: true })
        .fill("#112233");
      await palette.getByRole("button", { name: "Hủy", exact: true }).click();
      await expect(
        palette.getByLabel("Màu bắt đầu · mã HEX", { exact: true }),
      ).toHaveValue("#FFFFFF");
      await page.screenshot({
        path: "test-results/v2122-palette-dark-mobile.png",
      });
      await page.reload();
      await expect(page.locator(".topbar")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute(
        "data-palette",
        "custom",
      );
      expect(
        await page.evaluate(() =>
          document.documentElement.style.getPropertyValue("--palette-end"),
        ),
      ).toBe(saved);
      await nav("Thêm");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /Giao diện/ })
        .click();
      await palette
        .getByRole("button", { name: "Mặc định", exact: true })
        .click();
      await expect(page.locator("html")).not.toHaveAttribute("data-palette");
      expect(
        await page.evaluate(() => localStorage.getItem("tripflow:palette")),
      ).toBe(null);
      expect(
        await page
          .locator(".btn.primary")
          .first()
          .evaluate((el) => getComputedStyle(el).backgroundImage),
      ).toBe(original);
      await expect(
        page.locator('svg.brand-mark:visible image[href="/icon.svg"]').first(),
      ).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: "test-results/v2122-default-logo-mobile.png",
      });
      await palette
        .getByRole("button", { name: "Đại dương", exact: true })
        .click();
      await nav("Tổng quan");
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: "test-results/v2122-ocean-home-dark.png" });
      await nav("Chi phí");
      const banner = page.locator(".finance-quick-summary");
      await expect(banner).toBeVisible();
      expect(
        await banner.evaluate((el) => {
          const hex = document.documentElement.style
            .getPropertyValue("--palette-start")
            .trim();
          const rgb = [1, 3, 5]
            .map((i) => parseInt(hex.slice(i, i + 2), 16))
            .join(", ");
          return getComputedStyle(el).backgroundImage.includes(`rgb(${rgb})`);
        }),
      ).toBe(true);
      await page.screenshot({
        path: "test-results/v2122-ocean-finance-dark.png",
      });
      const checkBrandFill = async (selector: string) => {
        const el = page.locator(selector).first();
        await expect(el).toBeVisible();
        expect(
          await el.evaluate((el) => {
            const root = document.documentElement;
            const hex = root.style.getPropertyValue("--palette-start").trim();
            const rgb = [1, 3, 5]
              .map((i) => parseInt(hex.slice(i, i + 2), 16))
              .join(", ");
            return getComputedStyle(el).backgroundImage.includes(`rgb(${rgb})`);
          }),
          selector,
        ).toBe(true);
      };
      const checkContainment = async (label: string) => {
        expect(
          await page.evaluate(() => {
            const leaks: string[] = [];
            for (const el of Array.from(
              document.querySelectorAll<HTMLElement>(
                "main .btn,.dialog-content .btn,.module-tile",
              ),
            )) {
              if (
                !el.getClientRects().length ||
                el.closest('.table-scroll,.planning-board,[aria-hidden="true"]')
              )
                continue;
              const r = el.getBoundingClientRect();
              if (r.left < -1 || r.right > innerWidth + 1)
                leaks.push(el.textContent?.trim() || el.className);
            }
            return {
              fits: document.documentElement.scrollWidth <= innerWidth + 1,
              leaks,
            };
          }),
          label,
        ).toEqual({ fits: true, leaks: [] });
      };
      const checkSemanticColors = async () => {
        expect(
          await page.evaluate(() => {
            const root = document.documentElement,
              id = root.dataset.palette;
            const probe = document.createElement("div");
            probe.innerHTML =
              '<div class="dialog-danger"><footer class="dialog-footer"><button class="btn primary">Xóa</button></footer></div><div class="notice warning">Warning</div><span class="connection-dot ready"></span><span class="connection-dot offline"></span><div class="spending-pace over"><div class="spending-pace-copy">Over</div></div><div class="command-preview invalid"><span class="command-preview-icon">Invalid</span></div>';
            document.body.append(probe);
            const samples: string[][][] = [];
            for (let i = 0; i < 2; i++) {
              if (i === 1) delete root.dataset.palette;
              samples.push(
                Array.from(
                  probe.querySelectorAll(
                    "button,.notice,.connection-dot,.spending-pace,.spending-pace-copy,.command-preview-icon",
                  ),
                ).map((el) => {
                  const style = getComputedStyle(el);
                  return [style.backgroundColor, style.color];
                }),
              );
            }
            const [custom, original] = samples;
            if (id) root.dataset.palette = id;
            probe.remove();
            return JSON.stringify(custom) === JSON.stringify(original);
          }),
        ).toBe(true);
      };
      for (const variant of ["Tím hoàng hôn", "custom"]) {
        await page.setViewportSize({ width: 390, height: 844 });
        await nav("Thêm");
        await page
          .getByRole("dialog")
          .getByRole("button", { name: /Giao diện/ })
          .click();
        if (variant === "custom") {
          const details = palette.locator("details");
          if ((await details.getAttribute("open")) === null)
            await details.locator("summary").click();
          await palette
            .getByLabel("Màu bắt đầu · mã HEX", { exact: true })
            .fill("#643489");
          await palette
            .getByLabel("Màu kết thúc · mã HEX", { exact: true })
            .fill("#DDAADD");
          await palette
            .getByRole("button", { name: "Lưu màu", exact: true })
            .click();
        } else
          await palette
            .getByRole("button", { name: variant, exact: true })
            .click();
        await checkSemanticColors();
        for (const mode of ["Sáng", "Tối"]) {
          await page.getByRole("button", { name: mode, exact: true }).click();
          for (const width of [320, 390, 1280]) {
            await page.setViewportSize({ width, height: 844 });
            for (const screen of [
              "Tổng quan",
              "Lịch trình",
              "Chi phí",
              "Media",
            ]) {
              await nav(screen);
              await checkContainment(`${variant} ${mode} ${width} ${screen}`);
              if (screen === "Chi phí") {
                await checkBrandFill(".expense-add-action");
                expect(
                  await page
                    .locator(".expense-add-action")
                    .evaluate((el) => getComputedStyle(el).backgroundImage),
                ).toBe(
                  await page
                    .locator(".page-heading .btn.primary")
                    .evaluate((el) => getComputedStyle(el).backgroundImage),
                );
                await checkBrandFill(".finance-quick-summary");
                await page.locator(".expense-add-action").click();
                await expect(page.getByRole("dialog")).toBeVisible();
                await checkContainment("expense sheet " + mode + width);
                await page
                  .getByRole("dialog")
                  .getByRole("button", { name: "Hủy", exact: true })
                  .click();
              }
              if (screen === "Media")
                await checkBrandFill(".story-hero-visual");
              if (width === 390 && variant !== "custom")
                await page.screenshot({
                  path: `test-results/v2123-${screen}-${mode}.png`,
                });
            }
          }
          await page.setViewportSize({ width: 390, height: 844 });
          await nav("Thêm");
          const titles = await page
            .locator(".module-picker .module-tile strong")
            .allTextContents();
          for (const title of titles) {
            const picker = page.locator(".module-picker");
            if (!(await picker.isVisible()))
              await page
                .getByRole("button", { name: "Tất cả module", exact: true })
                .click();
            await picker
              .locator(".module-tile")
              .filter({ has: page.getByText(title, { exact: true }) })
              .click();
            await expect(page.locator(".module-management")).toBeVisible();
            await checkContainment("module " + title + " " + mode);
          }
          await nav("Thêm");
          await page
            .getByRole("dialog")
            .getByRole("button", { name: /Giao diện/ })
            .click();
        }
      }
      expect(errors).toEqual([]);
      console.log(
        "PASS V2.12.3: shared expense buttons and Memories gradients, all main screens/modules, expense sheets, violet/custom colors, light/dark, 320/390/1280, semantic status preservation.",
      );
      expect(errors).toEqual([]);
      console.log(
        "PASS V2.12.2: presets, custom HEX validation, cancel/save/reset, exact original restoration, persistence, light/dark and containment 320–1280, icon branding, no JS errors.",
      );
      return;
    }
    if (process.env.TRIPFLOW_LAYOUT_TEST) {
      const checkLayout = async (label: string) => {
        const leaks = await page.evaluate(() => {
          const result: string[] = [];
          for (const el of Array.from(
            document.querySelectorAll<HTMLElement>(
              ".panel .btn,.panel select,.panel input,.preparation-module h2,.planning-view-switch button,.planning-heading-actions>.icon-btn",
            ),
          )) {
            if (
              !el.getClientRects().length ||
              el.closest('[aria-hidden="true"],.dialog-exit-layer')
            )
              continue;
            if (el.closest(".table-scroll,.planning-board")) continue;
            const r = el.getBoundingClientRect(),
              parent = el.closest(".panel")?.getBoundingClientRect();
            if (
              r.width > innerWidth + 1 ||
              r.left < -1 ||
              r.right > innerWidth + 1 ||
              (parent &&
                (r.left < parent.left - 1 || r.right > parent.right + 1))
            )
              result.push(
                el.tagName +
                  ":" +
                  (el.getAttribute("aria-label") || el.textContent || "")
                    .trim()
                    .slice(0, 70),
              );
          }
          for (const el of Array.from(
            document.querySelectorAll<HTMLElement>(
              ".panel h2,.panel h3,.route-map-head h3",
            ),
          )) {
            if (!el.getClientRects().length) continue;
            const parent = el.closest(".panel,.route-map-shell");
            if (!parent) continue;
            const range = document.createRange();
            range.selectNodeContents(el);
            const r = range.getBoundingClientRect(),
              box = parent.getBoundingClientRect();
            if (r.right > box.right + 1 || r.left < box.left - 1)
              result.push("heading text:" + el.textContent);
          }
          return result;
        });
        expect(leaks, `${label}: controls must fit their panels`).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          label,
        ).toBe(true);
      };
      refreshDelay = 500;
      await page
        .getByRole("button", { name: "Tải lại dữ liệu", exact: true })
        .click();
      await expect(page.locator(".tf-toast.info")).toContainText(
        "Đang cập nhật",
      );
      const pendingToast = await page.locator(".tf-toast").elementHandle();
      await expect(page.locator(".tf-toast.success")).toContainText(
        "Đã cập nhật dữ liệu",
      );
      expect(
        await pendingToast!.evaluate(
          (el) => el === document.querySelector(".tf-toast"),
        ),
      ).toBe(true);
      await expect(page.locator(".tf-toast.success>svg")).toHaveCount(1);
      await expect(page.locator(".tf-toast")).toHaveCount(0, { timeout: 6000 });
      refreshDelay = 0;
      await nav("Lịch trình");
      await expect(page.locator(".route-planner")).toHaveCount(0);
      for (const width of [320, 390, 430, 768, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        for (const theme of ["light", "dark"]) {
          await page.evaluate((t) => {
            document.documentElement.dataset.theme = t;
            document.documentElement.style.colorScheme = t;
          }, theme);
          for (const mode of ["Timeline", "Board", "Bản đồ"]) {
            await page
              .locator(".planning-view-switch")
              .getByRole("button", { name: mode, exact: true })
              .click();
            for (const button of await page
              .locator(".planning-view-switch button")
              .all())
              await expect(button).toBeVisible();
            await checkLayout(`route ${mode} ${width} ${theme}`);
          }
          await page.screenshot({
            path: `test-results/v2121-route-${width}-${theme}.png`,
          });
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page
        .getByRole("button", { name: "Điều phối lịch trình", exact: true })
        .click();
      await expect(
        page
          .getByRole("dialog")
          .getByRole("heading", { name: "Điều phối lịch trình", exact: true }),
      ).toBeVisible();
      await expect(
        page
          .getByRole("dialog")
          .getByLabel("Hoạt động cần điều chỉnh", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Đóng", exact: true })
        .first()
        .click();
      await nav("Chi phí");
      await page
        .locator(".finance-toolbar")
        .getByRole("button", { name: "Báo cáo", exact: true })
        .click();
      await expect(page.locator(".cost-sharing-report")).toHaveCount(0);
      const launcher = page.getByRole("button", {
        name: "Phân chia chi phí",
        exact: true,
      });
      await expect(launcher.locator("..")).toContainText(
        "Báo cáo theo hoạt động",
      );
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await launcher.click();
      let sheet = page.getByRole("dialog");
      const body = sheet.locator(".dialog-body");
      await expect(sheet.locator(".sheet-scroll-indicator")).toBeVisible();
      const geometry = await body.boundingBox();
      expect(geometry).toBeTruthy();
      const before = await body.evaluate((el) => el.scrollTop);
      const cdp = await context.newCDPSession(page);
      const x = geometry!.x + geometry!.width * 0.6,
        y = Math.min(geometry!.y + geometry!.height - 70, 700);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      for (const dy of [35, 80, 135, 190]) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x, y: y - dy }],
        });
        await page.waitForTimeout(16);
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await expect
        .poll(() => body.evaluate((el) => el.scrollTop))
        .toBeGreaterThan(before + 35);
      expect(await body.evaluate((el) => getComputedStyle(el).overflowX)).toBe(
        "hidden",
      );
      await page.screenshot({
        path: "test-results/v2121-cost-sharing-sheet.png",
      });
      await sheet
        .getByRole("button", { name: "Đóng", exact: true })
        .first()
        .click();
      await expect(sheet).toHaveCount(0);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await nav("Thêm");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /Chuẩn bị chuyến đi/ })
        .click();
      const prep = page.locator(".preparation-module");
      await expect(prep).toBeVisible();
      for (const width of [320, 390, 430, 768, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        for (const theme of ["light", "dark"]) {
          await page.evaluate((t) => {
            document.documentElement.dataset.theme = t;
            document.documentElement.style.colorScheme = t;
          }, theme);
          await checkLayout(`preparation ${width} ${theme}`);
          await page.screenshot({
            path: `test-results/v2121-preparation-${width}-${theme}.png`,
          });
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await prep.getByRole("button", { name: "Thêm mục", exact: true }).click();
      sheet = page.getByRole("dialog");
      expect(
        await sheet.evaluate((el) =>
          Array.from(el.querySelectorAll("input,select,textarea")).every(
            (x) => {
              const r = x.getBoundingClientRect(),
                p = el.getBoundingClientRect();
              return r.left >= p.left - 1 && r.right <= p.right + 1;
            },
          ),
        ),
      ).toBe(true);
      await sheet.getByRole("button", { name: "Hủy", exact: true }).click();
      await expect(
        page.locator('svg.brand-mark:visible image[href="/icon.svg"]').first(),
      ).toBeVisible();
      expect(
        await page
          .locator("svg.brand-mark")
          .first()
          .evaluate((el) => ({
            border: getComputedStyle(el).borderTopWidth,
            background: getComputedStyle(el).backgroundColor,
          })),
      ).toEqual({ border: "0px", background: "rgba(0, 0, 0, 0)" });
      refreshFailure = true;
      await page
        .getByRole("button", { name: "Tải lại dữ liệu", exact: true })
        .click();
      await expect(page.locator(".tf-toast.warning")).toBeVisible({
        timeout: 15000,
      });
      await expect(page.locator(".tf-toast.success")).toHaveCount(0);
      refreshFailure = false;
      if (errors.length) throw new Error(errors.join("\n"));
      console.log(
        "PASS V2.12.1: borderless logo, route modes and preparation controls contained at 320/390/430/768/1280 in light/dark; icon planner, contextual cost sharing sheet, native first gesture scrolling with rail ready on open; same toast pending→checked success→dismiss and failed refresh warning.",
      );
      return;
    }
    if (process.env.TRIPFLOW_ROUTE_TEST) {
      await nav("Lịch trình");
      const region = page.locator(".route-planner");
      const openPlanner = async () => {
        if (!(await region.isVisible()))
          await page
            .getByRole("button", { name: "Điều phối lịch trình", exact: true })
            .click();
      };
      await page
        .getByRole("button", { name: "26/09/2026", exact: true })
        .click();
      await openPlanner();
      await expect(region).toBeVisible();
      const breakfast = (
        await db.query<any>(
          "select * from itinerary_items where trip_id=$1 and title='Ăn sáng linh hoạt'",
          [tid],
        )
      ).rows[0];
      const visit = (
        await db.query<any>(
          "select * from itinerary_items where trip_id=$1 and title='Tham quan linh hoạt'",
          [tid],
        )
      ).rows[0];
      await page
        .getByLabel("Hoạt động cần điều chỉnh", { exact: true })
        .selectOption(breakfast.id);
      await openPlanner();
      await region
        .getByRole("button", { name: "Điều chỉnh", exact: true })
        .click();
      let sheet = page.getByRole("dialog");
      await sheet.getByLabel("Thời lượng (phút)", { exact: true }).fill("90");
      await sheet
        .getByLabel("Dời các điểm linh hoạt phía sau trong ngày")
        .check();
      await sheet
        .getByRole("button", { name: "Xem trước", exact: true })
        .click();
      await expect(sheet).toContainText("Tham quan linh hoạt");
      await expect(sheet.locator(".route-preview-list")).not.toContainText(
        "Tour cố định",
      );
      if (
        await sheet
          .getByLabel("Tôi đã xem các cảnh báo và vẫn muốn lưu.")
          .isVisible()
      )
        await sheet
          .getByLabel("Tôi đã xem các cảnh báo và vẫn muốn lưu.")
          .check();
      await sheet
        .getByRole("button", { name: "Xác nhận", exact: true })
        .click();
      await expect(sheet).toHaveCount(0);
      await expect
        .poll(async () =>
          new Date(
            (
              await db.query<any>(
                "select start_at from itinerary_items where id=$1",
                [visit.id],
              )
            ).rows[0].start_at,
          ).toISOString(),
        )
        .toBe("2026-09-26T02:30:00.000Z");
      await page
        .getByRole("button", {
          name: "Chặng đến Tham quan linh hoạt",
          exact: true,
        })
        .click();
      sheet = page.getByRole("dialog");
      await sheet
        .getByLabel("Phương tiện", { exact: true })
        .selectOption("car");
      await sheet.getByLabel("Di chuyển (phút)", { exact: true }).fill("20");
      await sheet.getByLabel("Dự phòng (phút)", { exact: true }).fill("10");
      await sheet
        .getByRole("button", { name: "Lưu chặng", exact: true })
        .click();
      await expect(sheet).toHaveCount(0);
      const visitRow = page.locator(".timeline-row").filter({
        has: page.getByRole("heading", {
          name: "Tham quan linh hoạt",
          exact: true,
        }),
      });
      await expect(visitRow).toContainText("20′ + 10′");
      await expect(
        visitRow.getByRole("link", { name: "Chỉ đường", exact: true }),
      ).toHaveAttribute("href", /google.com\/maps\/dir/);
      await openPlanner();
      await region.getByRole("button", { name: /Muốn đi/ }).click();
      sheet = page.getByRole("dialog");
      await sheet
        .getByRole("button", { name: "Thêm địa điểm", exact: true })
        .click();
      sheet = page.getByRole("dialog");
      await sheet
        .getByLabel("Tên địa điểm", { exact: true })
        .fill("Khu vui chơi trong nhà");
      await sheet
        .getByLabel("Địa chỉ", { exact: true })
        .fill("Trung tâm Đà Lạt");
      await sheet
        .getByLabel("Thời lượng dự kiến (phút)", { exact: true })
        .fill("45");
      await sheet
        .getByLabel("Phương án B cho hoạt động", { exact: true })
        .selectOption(visit.id);
      await sheet
        .getByRole("button", { name: "Lưu địa điểm", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toContainText(
        "Khu vui chơi trong nhà",
      );
      await page
        .getByRole("button", { name: "Dùng phương án B", exact: true })
        .click();
      sheet = page.getByRole("dialog");
      await sheet
        .getByRole("button", { name: "Xem trước", exact: true })
        .click();
      await expect(sheet).toContainText(
        "đặt chỗ và chi phí vẫn gắn với điểm cũ",
      );
      if (
        await sheet
          .getByLabel("Tôi đã xem các cảnh báo và vẫn muốn lưu.")
          .isVisible()
      )
        await sheet
          .getByLabel("Tôi đã xem các cảnh báo và vẫn muốn lưu.")
          .check();
      await sheet
        .getByRole("button", { name: "Xác nhận", exact: true })
        .click();
      await expect(
        page
          .getByRole("dialog")
          .getByRole("heading", { name: "Danh sách muốn đi", exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("dialog")).toContainText(
        "Tham quan linh hoạt",
      );
      expect(
        (
          await db.query<any>(
            "select status from itinerary_items where id=$1",
            [visit.id],
          )
        ).rows[0].status,
      ).toBe("skipped");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Đóng", exact: true })
        .first()
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      // Stale preview must not overwrite a concurrent itinerary update.
      await openPlanner();
      await region
        .getByRole("button", { name: "Điều chỉnh", exact: true })
        .click();
      sheet = page.getByRole("dialog");
      await sheet
        .getByRole("button", { name: "Xem trước", exact: true })
        .click();
      if (
        await sheet
          .getByLabel("Tôi đã xem các cảnh báo và vẫn muốn lưu.")
          .isVisible()
      )
        await sheet
          .getByLabel("Tôi đã xem các cảnh báo và vẫn muốn lưu.")
          .check();
      const tour = (
        await db.query<any>(
          "select * from itinerary_items where trip_id=$1 and title='Tour cố định'",
          [tid],
        )
      ).rows[0];
      await mutate(
        "item",
        {
          ...tour,
          start_at: new Date(tour.start_at).toISOString(),
          end_at: new Date(tour.end_at).toISOString(),
          note: "Concurrent change",
        },
        "update",
        { id: tour.id, version: tour.version },
      );
      await sheet
        .getByRole("button", { name: "Xác nhận", exact: true })
        .click();
      await expect(sheet.locator(".error")).toBeVisible();
      await sheet
        .getByRole("button", { name: "Quay lại", exact: true })
        .click();
      await sheet.getByRole("button", { name: "Hủy", exact: true }).click();
      await page.reload();
      await openPlanner();
      await expect(region).toBeVisible();
      await page
        .getByLabel("Hoạt động cần điều chỉnh", { exact: true })
        .selectOption(breakfast.id);
      await context.setOffline(true);
      await openPlanner();
      await region
        .getByRole("button", { name: "Điều chỉnh", exact: true })
        .click();
      sheet = page.getByRole("dialog");
      await sheet
        .getByLabel("Bắt đầu mới", { exact: true })
        .fill("2026-09-26T07:15");
      await sheet
        .getByRole("button", { name: "Xem trước", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Xem trước thay đổi", exact: true }),
      ).toBeVisible();
      if (
        await sheet
          .getByLabel("Tôi đã xem các cảnh báo và vẫn muốn lưu.")
          .isVisible()
      )
        await sheet
          .getByLabel("Tôi đã xem các cảnh báo và vẫn muốn lưu.")
          .check();
      await sheet
        .getByRole("button", { name: "Xác nhận", exact: true })
        .click();
      await expect(sheet).toHaveCount(0);
      await context.setOffline(false);
      await expect
        .poll(
          async () =>
            new Date(
              (
                await db.query<any>(
                  "select start_at from itinerary_items where id=$1",
                  [breakfast.id],
                )
              ).rows[0].start_at,
            ).toISOString(),
          { timeout: 15000 },
        )
        .toBe("2026-09-26T00:15:00.000Z");
      for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        await openPlanner();
        await expect(region).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        await page
          .getByLabel("Hoạt động cần điều chỉnh", { exact: true })
          .selectOption(breakfast.id);
        await openPlanner();
        await region
          .getByRole("button", { name: "Điều chỉnh", exact: true })
          .click();
        sheet = page.getByRole("dialog");
        expect(
          await sheet.evaluate((el) =>
            Array.from(el.querySelectorAll("input,select"))
              .filter((x) => getComputedStyle(x).display !== "none")
              .every((x) => {
                const r = x.getBoundingClientRect(),
                  p = el.getBoundingClientRect();
                return r.left >= p.left - 1 && r.right <= p.right + 1;
              }),
          ),
        ).toBe(true);
        await page.screenshot({ path: `test-results/v212-shift-${width}.png` });
        await sheet.getByRole("button", { name: "Hủy", exact: true }).click();
      }
      await page.setViewportSize({ width: 390, height: 844 });
      viewRole = "viewer";
      await page.reload();
      await openPlanner();
      await expect(region).toBeVisible();
      await expect(
        region.getByRole("button", { name: "Điều chỉnh", exact: true }),
      ).toHaveCount(0);
      await openPlanner();
      await region.getByRole("button", { name: /Muốn đi/ }).click();
      await expect(
        page
          .getByRole("dialog")
          .getByRole("button", { name: "Thêm địa điểm", exact: true }),
      ).toHaveCount(0);
      if (errors.length) throw new Error(errors.join("\n"));
      console.log(
        "PASS V2.12 auth light/dark 320-1280, fixed/flexible preview, duration propagation, leg estimates, Plan B/history, concurrent conflict, offline batch/sync, responsive sheets and Viewer.",
      );
      return;
    }
    if (process.env.TRIPFLOW_PREPARATION_TEST) {
      const openPreparation = async () => {
        await nav("Thêm");
        await page
          .getByRole("dialog")
          .getByRole("button", { name: /Chuẩn bị chuyến đi/ })
          .click();
        await expect(page.locator(".preparation-module")).toBeVisible();
      };
      await openPreparation();
      const prep = page.locator(".preparation-module");
      await prep.getByRole("button", { name: "Dùng mẫu", exact: true }).click();
      let sheet = page.getByRole("dialog");
      await sheet.getByLabel("Mẫu hành lý").selectOption("baby");
      await sheet.getByLabel("Phạm vi").selectOption("personal");
      await sheet
        .getByLabel("Người phụ trách")
        .selectOption({ label: "Mai Phụng" });
      await sheet
        .getByLabel("Hạn chuẩn bị", { exact: true })
        .fill("24/09/2026");
      await sheet.getByRole("button", { name: "Áp dụng mẫu" }).click();
      await expect(sheet).toHaveCount(0);
      await expect(prep.locator(".prep-item")).toHaveCount(11);
      await prep
        .getByRole("button", { name: "Sửa Giấy tờ tùy thân", exact: true })
        .click();
      sheet = page.getByRole("dialog");
      await expect(
        sheet.getByLabel("Hạn chuẩn bị", { exact: true }),
      ).toHaveValue("24/09/2026");
      await sheet.getByLabel("Số lượng", { exact: true }).fill("2");
      await sheet.getByRole("button", { name: "Lưu thay đổi" }).click();
      await expect(sheet).toHaveCount(0);
      await prep
        .getByLabel("Bạn là ai trong chuyến?")
        .selectOption({ label: "Mai Phụng" });
      await prep.getByLabel("Lọc checklist").selectOption("mine");
      await expect(prep.locator(".prep-item")).toHaveCount(11);
      await prep
        .getByLabel("Trạng thái Giấy tờ tùy thân", { exact: true })
        .selectOption("packed");
      await expect(prep.locator(".prep-progress")).toContainText("1/11");
      await prep.getByLabel("Lọc checklist").selectOption("unfinished");
      await expect(prep.locator(".prep-item")).toHaveCount(10);
      await prep.getByLabel("Lọc checklist").selectOption("all");
      await prep
        .getByLabel("Trạng thái Giấy tờ tùy thân", { exact: true })
        .selectOption("excluded");
      await expect(prep.locator(".prep-progress")).toContainText("0/10");
      await prep
        .getByLabel("Trạng thái Giấy tờ tùy thân", { exact: true })
        .selectOption("packed");
      await prep.getByRole("button", { name: "Thêm mục", exact: true }).click();
      sheet = page.getByRole("dialog");
      await sheet
        .getByLabel("Tên mục *", { exact: true })
        .fill("Kiểm tra ghế em bé");
      await sheet.getByLabel("Loại mục", { exact: true }).selectOption("task");
      await sheet
        .getByLabel("Nhóm", { exact: true })
        .selectOption("Việc trước khi đi");
      await sheet
        .getByLabel("Người phụ trách")
        .selectOption({ label: "Anh Hai" });
      await sheet.getByRole("button", { name: "Lưu thay đổi" }).click();
      await expect(sheet).toHaveCount(0);
      await prep
        .getByLabel("Trạng thái Kiểm tra ghế em bé", { exact: true })
        .selectOption("done");
      await expect(prep.locator(".prep-progress")).toContainText("2/12");
      await prep
        .getByRole("button", { name: "Thêm liên hệ", exact: true })
        .click();
      sheet = page.getByRole("dialog");
      await sheet.getByLabel("Tên liên hệ *").fill("Tài xế xe gia đình");
      await sheet.getByLabel("Loại liên hệ").selectOption("driver");
      await sheet.getByLabel("Số điện thoại").fill("+84 912 345 678");
      await sheet.getByLabel("Địa chỉ", { exact: true }).fill("Hồ Tràm");
      await sheet
        .getByLabel("Liên kết bản đồ HTTPS")
        .fill("https://maps.google.com/");
      await sheet.getByRole("button", { name: "Lưu thay đổi" }).click();
      await expect(sheet).toHaveCount(0);
      await expect(prep.locator('a[href="tel:+84912345678"]')).toBeVisible();
      await expect(prep.getByRole("link", { name: "Bản đồ" })).toHaveAttribute(
        "href",
        "https://maps.google.com/",
      );
      await prep.getByText("Gia đình & nhu cầu").click();
      await expect(prep.locator(".prep-family")).toContainText("Mang bình sữa");
      await expect(prep.locator(".prep-family")).toContainText("Em bé");
      await context.setOffline(true);
      await prep
        .getByLabel("Trạng thái Giấy tờ tùy thân", { exact: true })
        .selectOption("needed");
      await expect(prep.locator(".prep-progress")).toContainText("1/12");
      await context.setOffline(false);
      await expect
        .poll(
          async () =>
            (
              await db.query<any>(
                "select status from trip_checklist_items where trip_id=$1 and title='Giấy tờ tùy thân'",
                [tid],
              )
            ).rows[0]?.status,
          { timeout: 15000 },
        )
        .toBe("needed");
      for (const [width, theme] of [
        [320, "light"],
        [390, "dark"],
        [768, "light"],
        [1280, "dark"],
      ] as const) {
        await page.setViewportSize({ width, height: 844 });
        await page.evaluate((t) => {
          document.documentElement.dataset.theme = t;
          localStorage.setItem("tripflow:theme", t);
        }, theme);
        // Open the module from desktop More as well; on mobile it remains selected.
        if (width === 768) {
          await nav("Thêm");
        }
        await expect(prep).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        await prep
          .getByRole("button", { name: "Thêm mục", exact: true })
          .click();
        sheet = page.getByRole("dialog");
        expect(
          await sheet.evaluate((el) =>
            Array.from(el.querySelectorAll("input,select,textarea")).every(
              (i) => {
                const r = i.getBoundingClientRect(),
                  p = el.getBoundingClientRect();
                return r.left >= p.left - 1 && r.right <= p.right + 1;
              },
            ),
          ),
        ).toBe(true);
        await page.screenshot({
          path: `test-results/preparation-form-${width}-${theme}.png`,
        });
        await sheet.getByRole("button", { name: "Hủy", exact: true }).click();
        await expect(sheet).toHaveCount(0);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      const current = (
        await db.query<any>("select * from trips where id=$1", [tid])
      ).rows[0];
      await mutate(
        "trip",
        {
          ...current,
          start_date: "2026-09-25",
          end_date: "2026-09-27",
          status: "planning",
        },
        "update",
        { version: current.version },
      );
      await nav("Tổng quan");
      await page.reload();
      await expect(
        page.getByRole("button", { name: "Mở chuẩn bị chuyến đi" }),
      ).toContainText("1/12");
      await page.getByRole("button", { name: "Mở chuẩn bị chuyến đi" }).click();
      await expect(prep).toBeVisible();
      await page.reload();
      await expect(prep).toBeVisible();
      viewRole = "viewer";
      await page.reload();
      await expect(prep).toBeVisible();
      await expect(
        prep.getByRole("button", { name: "Thêm mục", exact: true }),
      ).toHaveCount(0);
      await expect(
        prep.getByLabel("Trạng thái Giấy tờ tùy thân", { exact: true }),
      ).toBeDisabled();
      if (errors.length) throw new Error(errors.join("\n"));
      console.log(
        "PASS V2.11 preparation UI: module, template copy, personal filter, inline statuses/exclusion, family metadata, contacts, offline sync, before-trip summary, Viewer, 320/390/768/1280 containment and themes.",
      );
      return;
    }
    if (process.env.TRIPFLOW_COST_TEST) {
      await nav("Chi phí");
      await page
        .locator(".finance-toolbar")
        .getByRole("button", { name: "Dự toán", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Thêm dự toán", exact: true })
        .click();
      const sheet = page.getByRole("dialog");
      await page
        .getByLabel("Tên khoản *", { exact: true })
        .fill("Tiền phòng 10.740.000");
      await page.getByLabel("Đơn giá VNĐ *", { exact: true }).fill("10740000");
      await expect(page.getByLabel("Cách chia", { exact: true })).toHaveValue(
        "equal",
      );
      await expect(sheet.locator(".cost-people")).toHaveCount(0);
      await expect(sheet.locator(".cost-preview > div")).toHaveCount(5);
      await page
        .getByLabel("Cách chia", { exact: true })
        .selectOption("fixed_remainder");
      await page
        .getByLabel("Người chịu phần cố định 1", { exact: true })
        .selectOption({ label: "A" });
      await page
        .getByLabel("Số tiền cố định 1", { exact: true })
        .fill("7000000");
      for (const name of ["B", "C", "D"])
        await sheet.getByRole("checkbox", { name, exact: true }).check();
      await expect(
        sheet.getByRole("checkbox", { name: "Không chia", exact: true }),
      ).not.toBeChecked();
      await expect(sheet.locator(".cost-preview > div")).toHaveCount(4);
      for (const width of [320, 390, 430]) {
        await page.setViewportSize({ width, height: 844 });
        expect(
          await sheet.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        ).toBe(true);
        const box = (await sheet.boundingBox())!;
        expect(Math.abs(box.y + box.height - 844)).toBeLessThan(2);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await sheet
        .getByRole("button", { name: "Lưu thay đổi", exact: true })
        .click();
      await expect(sheet).toHaveCount(0);
      const saved = (
        await db.query<any>(
          "select * from budget_items where title='Tiền phòng 10.740.000'",
        )
      ).rows[0];
      expect(saved.cost_sharing.mode).toBe("fixed_remainder");
      expect(saved.cost_sharing.participants).toHaveLength(3);
      await page
        .getByRole("button", { name: "Ghi chi tiêu", exact: true })
        .first()
        .click();
      await page.getByLabel("Số tiền VNĐ *", { exact: true }).fill("5370000");
      await page
        .getByLabel("Nội dung chi *", { exact: true })
        .fill("Cọc phòng 50%");
      await sheet.locator(".smart-form-toggle").click();
      await page
        .getByLabel("Thuộc khoản dự toán", { exact: true })
        .selectOption(saved.id);
      await page.getByLabel("Nguồn tiền", { exact: true }).selectOption("fund");
      await expect(
        page.getByLabel("Người thanh toán / người thực hiện", { exact: true }),
      ).toHaveCount(0);
      await page
        .getByLabel("Nguồn tiền", { exact: true })
        .selectOption("personal");
      await page
        .getByLabel("Người thanh toán / người thực hiện", { exact: true })
        .selectOption({ label: "A" });
      await expect(
        page.getByLabel("Hình thức cá nhân thanh toán", { exact: true }),
      ).toHaveValue("direct");
      // A small stale iOS visual-viewport gap must not move the closed-keyboard sheet upwards.
      await page.evaluate(() => {
        Object.defineProperty(window.visualViewport, "height", {
          configurable: true,
          value: 784,
        });
        Object.defineProperty(window.visualViewport, "offsetTop", {
          configurable: true,
          value: 0,
        });
        window.visualViewport!.dispatchEvent(new Event("resize"));
      });
      await page.waitForTimeout(100);
      let bounds = (await sheet.boundingBox())!;
      expect(Math.abs(bounds.y + bounds.height - 844)).toBeLessThan(2);
      await page.evaluate(() => {
        Reflect.deleteProperty(window.visualViewport!, "height");
        Reflect.deleteProperty(window.visualViewport!, "offsetTop");
        window.visualViewport!.dispatchEvent(new Event("resize"));
      });
      await sheet
        .getByRole("button", { name: "Lưu thay đổi", exact: true })
        .click();
      await expect(sheet).toHaveCount(0);
      await page
        .locator(".finance-toolbar")
        .getByRole("button", { name: "Đối chiếu", exact: true })
        .click();
      await expect(page.locator(".cost-sharing-report")).toHaveCount(0);
      await page
        .locator(".finance-toolbar")
        .getByRole("button", { name: "Báo cáo", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Phân chia chi phí", exact: true })
        .click();
      const report = page.locator(".cost-sharing-report");
      await report
        .getByLabel("Khoản dự toán cần đối chiếu", { exact: true })
        .selectOption(saved.id);
      await expect(report).toContainText("5.370.000");
      await expect(report).toContainText("7.000.000");
      await expect(report).toContainText("1.630.000");
      await expect(report.locator(".cost-person")).toHaveCount(4);
      await page.screenshot({
        path: "test-results/v210-custom-sharing.png",
        fullPage: true,
      });
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Đóng", exact: true })
        .first()
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const expense = (
        await db.query<any>(
          "select * from expenses where title='Cọc phòng 50%'",
        )
      ).rows[0];
      expect(expense.settlement_type).toBe("direct");
      expect(
        (await db.query<any>("select count(*)::int n from fund_entries"))
          .rows[0].n,
      ).toBe(0);

      await page
        .locator(".finance-toolbar")
        .getByRole("button", { name: "Dự toán", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Thêm dự toán", exact: true })
        .click();
      await sheet
        .getByLabel("Tên khoản *", { exact: true })
        .fill("Chia đều ba người");
      await sheet.getByLabel("Đơn giá VNĐ *", { exact: true }).fill("10740000");
      await sheet
        .getByLabel("Cách chia", { exact: true })
        .selectOption("selected_equal");
      await expect(
        sheet.getByLabel("Người chịu phần cố định 1", { exact: true }),
      ).toHaveCount(0);
      await expect(sheet.locator(".cost-preview > div")).toHaveCount(0);
      for (const name of ["B", "C", "D"])
        await sheet.getByRole("checkbox", { name, exact: true }).check();
      await expect(sheet.locator(".cost-preview > div")).toHaveCount(3);
      await expect(sheet.locator(".cost-preview")).toContainText("3.580.000");
      await sheet
        .getByRole("button", { name: "Lưu thay đổi", exact: true })
        .click();
      await expect(sheet).toHaveCount(0);
      const chosenBudget = (
        await db.query<any>(
          "select * from budget_items where title='Chia đều ba người'",
        )
      ).rows[0];
      expect(chosenBudget.cost_sharing.mode).toBe("selected_equal");
      expect(chosenBudget.cost_sharing.participants).toHaveLength(3);
      // The dock can touch the actual taskbar boundary, keeping only a 6px gap.
      const dock = page.locator(".tf-command-dock"),
        zap = page.getByRole("button", {
          name: "Mở TripFlow Command Center",
          exact: true,
        });
      for (const closeToast of await page
        .getByRole("button", { name: "Đóng thông báo", exact: true })
        .all())
        await closeToast.click();
      const dockBox = (await zap.boundingBox())!;
      await page.mouse.move(dockBox.x + 24, dockBox.y + 24);
      await page.mouse.down();
      await page.mouse.move(365, 838, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(400);
      let navBox = (await page.locator(".bottom-nav").boundingBox())!,
        currentDock = (await dock.boundingBox())!;
      expect(
        navBox.y - currentDock.y - currentDock.height,
      ).toBeGreaterThanOrEqual(5);
      expect(navBox.y - currentDock.y - currentDock.height).toBeLessThanOrEqual(
        7,
      );
      // Real animation and pointer following; reject a dirty close then close an empty picker.
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await nav("Thêm");
      const picker = page.locator(".module-picker");
      await expect(picker).toBeVisible();
      await expect(page.locator(".module-grid")).toHaveCount(1);
      const header = (await picker.locator(".dialog-header").boundingBox())!,
        handle = (await picker.locator(".sheet-grip").boundingBox())!;
      expect(header.height + handle.height).toBeLessThanOrEqual(66);
      expect(header.height).toBeGreaterThanOrEqual(44);
      const body = picker.locator(".dialog-body");
      expect(["auto", "scroll"]).toContain(
        await body.evaluate((el) => getComputedStyle(el).overflowY),
      );
      // First native touch gesture on a fresh sheet; no prior warm-up scroll.
      await expect
        .poll(async () => {
          const r = (await picker.boundingBox())!;
          return Math.round(r.y + r.height);
        })
        .toBe(844);
      const maxScroll = await body.evaluate(
        (el) => el.scrollHeight - el.clientHeight,
      );
      expect(maxScroll).toBeGreaterThan(20);
      const cdp = await context.newCDPSession(page);
      const widthBefore = await body.evaluate((el) => el.clientWidth);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: 280, y: 610 }],
      });
      for (let i = 1; i <= 10; i++)
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: 280, y: 610 - i * 24 }],
        });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await expect
        .poll(() => body.evaluate((el) => el.scrollTop))
        .toBeGreaterThan(Math.min(70, maxScroll / 2));
      expect(await body.evaluate((el) => el.clientWidth)).toBe(widthBefore);
      await cdp.detach();
      await body.evaluate((el) => (el.scrollTop = 0));

      await page.waitForTimeout(300);
      await page.screenshot({ path: "test-results/v210-module-picker.png" });
      const grip = (await picker.locator(".sheet-grip").boundingBox())!;
      await page.mouse.move(grip.x + grip.width / 2, grip.y + 10);
      await page.mouse.down();
      await page.mouse.move(grip.x + grip.width / 2, grip.y + 130, {
        steps: 10,
      });
      expect(
        await page
          .locator(".dialog-motion")
          .evaluate((el) => getComputedStyle(el).transform),
      ).not.toBe("none");
      await page.mouse.up();
      await expect(page.locator(".dialog-exit-layer")).toHaveCount(1);
      await expect(page.locator(".dialog-exit-layer")).toHaveCount(0);
      await expect(
        page.locator(".screen-content[data-screen=money]"),
      ).toBeVisible();
      expect(errors).toEqual([]);
      console.log(
        "PASS V2.10.1 selected shares, Reports placement, compact sheet, native first touch scroll and taskbar dock bounds: exact hotel split and deposit, 5 versus 3 selected people, hidden fund payer, direct payment without reimbursement, stale 60px viewport recovery, responsive input containment, drag following and animated exit.",
      );
      return;
    }
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
      const commandBox = (await command.boundingBox())!;
      expect(commandBox.height).toBeGreaterThan(200);
      expect(commandBox.height).toBeLessThanOrEqual(828);
      expect(Math.abs(commandBox.y + commandBox.height - 844)).toBeLessThan(2);
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
        expect(box!.height).toBeGreaterThan(200);
        expect(box!.height).toBeLessThan(740);
        expect(Math.abs(box!.y + box!.height - 844)).toBeLessThan(2);
        expect(box!.x).toBe(0);
        expect(await dialog.evaluate((el) => el.scrollTop)).toBe(0);
        const header = (await dialog.locator(".dialog-header").boundingBox())!;
        expect(header.y).toBeGreaterThanOrEqual(box!.y);
        expect(header.y + header.height).toBeLessThan(box!.y + box!.height);
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

      for (let cycle = 0; cycle < 2; cycle++) {
        await dialog.getByLabel("Mục tiêu đóng (VNĐ)", { exact: true }).focus();
        await page.evaluate(() => {
          Object.defineProperty(window.visualViewport, "height", {
            configurable: true,
            value: 420,
          });
          Object.defineProperty(window.visualViewport, "offsetTop", {
            configurable: true,
            value: 55,
          });
          window.visualViewport!.dispatchEvent(new Event("resize"));
        });
        await page.waitForTimeout(100);
        let bounds = (await dialog.boundingBox())!;
        expect(Math.abs(bounds.y + bounds.height - 475)).toBeLessThan(2);
        const keyboardFooter = (await dialog
          .locator(".fund-form-footer")
          .boundingBox())!;
        expect(keyboardFooter.y + keyboardFooter.height).toBeLessThanOrEqual(
          476,
        );
        await dialog.getByRole("heading", { level: 2 }).click();
        await page.waitForTimeout(750);
        bounds = (await dialog.boundingBox())!;
        expect(Math.abs(bounds.y + bounds.height - 844)).toBeLessThan(2);
        await page.evaluate(() => {
          Reflect.deleteProperty(window.visualViewport!, "height");
          Reflect.deleteProperty(window.visualViewport!, "offsetTop");
          window.visualViewport!.dispatchEvent(new Event("resize"));
        });
      }
      const grip = (await dialog.locator(".sheet-grip").boundingBox())!;
      page.removeAllListeners("dialog");
      page.once("dialog", (prompt) => prompt.dismiss());
      await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
      await page.mouse.down();
      await page.mouse.move(grip.x + grip.width / 2, grip.y + 110, {
        steps: 8,
      });
      await page.mouse.up();
      await expect(dialog).toBeVisible();
      page.on("dialog", (prompt) => prompt.accept());
      await expect(
        dialog.getByLabel("Mục tiêu đóng (VNĐ)", { exact: true }),
      ).toHaveValue("1.000.000");
      await expect
        .poll(
          async () =>
            await dialog
              .locator(".fund-form-footer button")
              .evaluateAll((buttons) =>
                buttons.every((button) => {
                  const r = button.getBoundingClientRect();
                  return button.contains(
                    document.elementFromPoint(
                      r.x + r.width / 2,
                      r.y + r.height / 2,
                    ),
                  );
                }),
              ),
        )
        .toBe(true);
      await page.screenshot({ path: "test-results/v294-target-sheet.png" });
      await expect(dialog.locator(".fund-management")).toHaveCount(0);
      const footer = await dialog.locator(".fund-form-footer").boundingBox();
      expect(footer!.y + footer!.height).toBeGreaterThan(700);
      expect(footer!.y + footer!.height).toBeLessThanOrEqual(845);
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
        "PASS V2.9.4 fund UI: five finance tabs, sheet bottom anchoring, keyboard recovery, setup, per-member targets, contribution, reimbursement, return, responsive 320/390/430/1280, cached offline read and write guards.",
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
      await expect(picker.locator(".module-tile")).toHaveCount(15);
      await expect(page.locator(".module-grid")).toHaveCount(1);
      await expect(page.locator(".module-hub .module-grid")).toHaveCount(0);
      await picker.getByRole("button", { name: "Đóng", exact: true }).click();
      await expect(picker).toHaveCount(0);
      await expect(page.locator(".daily-focus-card.current")).toBeVisible();
      await nav("Thêm");
      for (const width of [320, 390, 430]) {
        await page.setViewportSize({ width, height: 844 });
        await expect(picker).toBeVisible();
        expect(
          await picker.locator(".module-tile strong").evaluateAll((items) =>
            items.every((el) => {
              const style = getComputedStyle(el);
              return (
                style.whiteSpace === "normal" &&
                style.textOverflow !== "ellipsis" &&
                el.scrollHeight <= el.clientHeight + 1
              );
            }),
          ),
        ).toBe(true);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: "test-results/v280-module-grid.png",
        fullPage: true,
      });
      await picker
        .getByRole("button", {
          name: /^Đặt chỗ & tài liệu/,
        })
        .click();
      await expect(picker).toHaveCount(0);
      await page
        .getByRole("button", { name: "Tất cả module", exact: true })
        .click();
      await expect(picker).toBeVisible();
      await expect(page.locator(".module-grid")).toHaveCount(1);
      await page.goBack();
      await expect(picker).toHaveCount(0);
      await expect(
        page.locator(".module-management .booking-module"),
      ).toBeVisible();
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
        "PASS V2.9.4: single module picker, wrapping titles, management screen, booking overnight create, document create/edit/delete, cached offline read, write disabled offline, green/red connection indicators, no JS errors.",
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
      await expect(sheet.locator(".permission-grants .pill")).toHaveCount(6);
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
      await expect(page.locator(".dialog-motion")).toHaveAttribute(
        "data-enter-motion",
        "slide-up",
      );
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
      await expect(page.locator(".dialog-motion")).toHaveAttribute(
        "data-enter-motion",
        "slide-up",
      );
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
    await expect(page.locator(".permission-grants .pill")).toHaveCount(6);
    await page.getByRole("button", { name: "Sửa quyền", exact: true }).click();
    for (const label of [
      "Mời thành viên",
      "Đổi quyền thành viên",
      "Thu hồi quyền truy cập",
      "Xóa chuyến đi",
      "Chốt dự toán",
      "Chốt/mở lại quyết toán",
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
    await page
      .getByRole("button", { name: "Ghi chi tiêu", exact: true })
      .first()
      .click();
    await expect(
      page.getByLabel("Số tiền VNĐ *", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Hủy", exact: true })
      .click();
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
      "PASS V2.7.0 regression: six permission fields, owner grant persisted, viewer action visibility, offline Wallet+sync, theme persistence/system switching, 40 responsive views, delete-trip navigation/cache cleanup, no JS errors.",
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
