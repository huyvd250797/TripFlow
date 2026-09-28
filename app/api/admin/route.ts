import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serverClient } from "@/lib/supabase/server";
import { mutationRequestError, privateHeaders, readJsonText } from "@/lib/api-hardening";

export const dynamic = "force-dynamic";

function reply(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: privateHeaders(),
  });
}

async function client() {
  const s = await serverClient();
  const { data, error } = await s.auth.getUser();
  if (error || !data.user) return null;
  return { s, user: data.user };
}

function dbError(message = "") {
  if (message.includes("MASTER_ONLY")) return ["Chỉ tài khoản Master được truy cập khu vực này.", 403] as const;
  if (message.includes("MASTER_SELF_PROTECTED")) return ["Không thể tự hủy kích hoạt tài khoản Master đang đăng nhập.", 400] as const;
  if (message.includes("MASTER_PROTECTED")) return ["Không thể hủy kích hoạt tài khoản Master.", 400] as const;
  if (message.includes("USER_NOT_FOUND")) return ["Không tìm thấy tài khoản.", 404] as const;
  if (message.includes("NOT_FOUND")) return ["Không tìm thấy dữ liệu.", 404] as const;
  return ["Không tải được dữ liệu quản trị. Kiểm tra migration V0.2.0.", 500] as const;
}

export async function GET(req: NextRequest) {
  const a = await client();
  if (!a) return reply({ error: "Vui lòng đăng nhập." }, 401);
  const mode = req.nextUrl.searchParams.get("mode") || "overview";
  try {
    if (mode === "overview") {
      const search = (req.nextUrl.searchParams.get("search") || "").trim().slice(0, 200);
      const { data, error } = await a.s.rpc("tf_admin_overview", { search_text: search });
      if (error) throw error;
      return reply(data);
    }
    if (mode === "user") {
      const id = req.nextUrl.searchParams.get("id") || "";
      if (!z.uuid().safeParse(id).success) return reply({ error: "Mã user không hợp lệ." }, 400);
      const { data, error } = await a.s.rpc("tf_admin_user_detail", { target_user: id });
      if (error) throw error;
      return reply(data);
    }
    if (mode === "trip") {
      const id = req.nextUrl.searchParams.get("id") || "";
      if (!z.uuid().safeParse(id).success) return reply({ error: "Mã chuyến đi không hợp lệ." }, 400);
      const { data, error } = await a.s.rpc("tf_admin_trip_detail", { target_trip: id });
      if (error) throw error;
      return reply(data);
    }
    if (mode === "ops") {
      const { data, error } = await a.s.rpc("tf_admin_ops_health");
      if (error) {
        if (String(error.code || "") === "PGRST202" || String(error.message || "").includes("tf_admin_ops_health"))
          return reply({ error: "Database chưa được nâng cấp V0.7.0. Hãy chạy migration 202609280003_v070_backup_recovery_operations.sql.", code: "V070_MIGRATION_REQUIRED" }, 503);
        throw error;
      }
      return reply(data);
    }
    return reply({ error: "Chế độ quản trị không hợp lệ." }, 400);
  } catch (e) {
    const [message, status] = dbError(e instanceof Error ? e.message : "");
    return reply({ error: message }, status);
  }
}

export async function POST(req: NextRequest) {
  const requestError = mutationRequestError(req, 5000);
  if (requestError)
    return reply({ error: requestError.message }, requestError.status);
  const a = await client();
  if (!a) return reply({ error: "Vui lòng đăng nhập." }, 401);
  try {
    let raw: string;
    try {
      raw = await readJsonText(req, 5000);
    } catch (e) {
      if (e instanceof Error && e.message === "PAYLOAD_TOO_LARGE")
        return reply({ error: "Dữ liệu quá lớn." }, 413);
      throw e;
    }
    const parsed = z
      .object({
        action: z.literal("set_status"),
        userId: z.uuid(),
        status: z.enum(["active", "deactivated"]),
      })
      .safeParse(JSON.parse(raw));
    if (!parsed.success) return reply({ error: "Dữ liệu quản trị không hợp lệ." }, 400);
    const { data, error } = await a.s.rpc("tf_admin_set_user_status", {
      target_user: parsed.data.userId,
      new_status: parsed.data.status,
    });
    if (error) throw error;
    return reply({ result: data });
  } catch (e) {
    if (e instanceof SyntaxError) return reply({ error: "JSON không hợp lệ." }, 400);
    const [message, status] = dbError(e instanceof Error ? e.message : "");
    return reply({ error: message }, status);
  }
}
