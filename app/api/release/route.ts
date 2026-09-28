import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { VERSION } from "@/lib/types";

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
              "Database chưa được nâng cấp V0.9.0. Hãy chạy migration 202609280004_v090_release_candidate_hardening.sql.",
            code: "V090_MIGRATION_REQUIRED",
          },
          503,
        );
      if (message.includes("ACCOUNT_DEACTIVATED"))
        return reply({ error: "Tài khoản đã bị hủy kích hoạt.", code: "ACCOUNT_DEACTIVATED" }, 403);
      throw error;
    }
    return reply(data);
  } catch (error) {
    console.error("TripFlow release readiness failed", error instanceof Error ? error.message : "unknown");
    return reply({ error: "Không kiểm tra được trạng thái Release Candidate." }, 500);
  }
}
