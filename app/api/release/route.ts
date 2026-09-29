import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { DATABASE_VERSION, VERSION } from "@/lib/types";

export const dynamic = "force-dynamic";

function reply(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-TripFlow-Version": VERSION,
      "X-Request-Id": randomUUID(),
    },
  });
}

export async function GET() {
  try {
    const s = await serverClient();
    const { data: auth, error: authError } = await s.auth.getUser();
    if (authError || !auth.user) return reply({ error: "Vui lòng đăng nhập." }, 401);

    const { data, error } = await s.rpc("tf_release_readiness");
    if (error) {
      const code = String(error.code || "");
      const message = String(error.message || "");
      if (code === "PGRST202" || code === "42883" || message.includes("tf_release_readiness"))
        return reply(
          {
            error:
              "Database chưa có capability V1.4.0. Hãy chạy migration Smart Planning Templates & Reuse còn thiếu.",
            code: "V140_MIGRATION_REQUIRED",
          },
          503,
        );
      if (message.includes("ACCOUNT_DEACTIVATED"))
        return reply({ error: "Tài khoản đã bị hủy kích hoạt.", code: "ACCOUNT_DEACTIVATED" }, 403);
      throw error;
    }

    const state = data as { app_version?: string; database_version?: string | null; channel?: string; ready?: boolean } | null;
    if (
      !state ||
      state.database_version !== DATABASE_VERSION ||
      state.channel !== "stable"
    ) {
      return reply(
        {
          error:
            "Database chưa đạt schema V1.4.0. Hãy chạy migration 202609290001_v140_smart_planning_templates_reuse.sql trước khi dùng V1.4.0.",
          code: "V140_MIGRATION_REQUIRED",
          currentDatabaseVersion: state?.database_version || null,
        },
        503,
      );
    }
    return reply({
      ...state,
      app_version: VERSION,
      database_required_version: DATABASE_VERSION,
      ui_release: "quick-entry-command-center",
    });
  } catch (error) {
    console.error("TripFlow production readiness failed", error instanceof Error ? error.message : "unknown");
    return reply({ error: "Không kiểm tra được trạng thái Production." }, 500);
  }
}
