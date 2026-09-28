import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serverClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function reply(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

async function auth() {
  const s = await serverClient();
  const { data, error } = await s.auth.getUser();
  if (error || !data.user) return null;
  return { s, user: data.user };
}

function migrationError(error: { code?: string; message?: string } | null | undefined) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  return code === "PGRST202" || code === "42883" || message.includes("tf_recovery_overview");
}

function mapped(message = "") {
  if (message.includes("OWNER_ONLY")) return ["Chỉ chủ chuyến đi được dùng Backup & Recovery.", 403] as const;
  if (message.includes("NOT_FOUND")) return ["Không tìm thấy bản backup hoặc dữ liệu cần khôi phục.", 404] as const;
  if (message.includes("DEPENDENCY_DELETED")) return ["Khoản hoàn tiền phụ thuộc giao dịch gốc đang bị xóa. Hãy khôi phục giao dịch gốc trước.", 409] as const;
  if (message.includes("BACKUP_CHECKSUM_MISMATCH")) return ["Checksum backup không khớp. Không khôi phục để tránh dùng dữ liệu hỏng.", 409] as const;
  if (message.includes("BACKUP_FORMAT_UNSUPPORTED")) return ["Định dạng backup này không còn được hỗ trợ.", 400] as const;
  if (message.includes("ACCOUNT_DEACTIVATED")) return ["Tài khoản đã bị hủy kích hoạt.", 403] as const;
  return ["Thao tác Backup & Recovery chưa thành công.", 400] as const;
}

export async function GET(req: NextRequest) {
  const a = await auth();
  if (!a) return reply({ error: "Vui lòng đăng nhập." }, 401);
  const mode = req.nextUrl.searchParams.get("mode") || "overview";
  try {
    if (mode === "overview") {
      const trip = req.nextUrl.searchParams.get("trip");
      if (trip && !z.uuid().safeParse(trip).success)
        return reply({ error: "Mã chuyến đi không hợp lệ." }, 400);
      const { data, error } = await a.s.rpc("tf_recovery_overview", {
        target_trip: trip || null,
      });
      if (error) {
        if (migrationError(error))
          return reply(
            {
              error:
                "Database chưa được nâng cấp V0.7.0. Hãy chạy migration 202609280003_v070_backup_recovery_operations.sql.",
              code: "V070_MIGRATION_REQUIRED",
            },
            503,
          );
        throw error;
      }
      return reply(data);
    }
    if (mode === "download") {
      const id = req.nextUrl.searchParams.get("id") || "";
      if (!z.uuid().safeParse(id).success)
        return reply({ error: "Mã backup không hợp lệ." }, 400);
      const { data, error } = await a.s.rpc("tf_get_trip_backup", { backup_id: id });
      if (error) {
        if (migrationError(error))
          return reply({ error: "Database chưa được nâng cấp V0.7.0.", code: "V070_MIGRATION_REQUIRED" }, 503);
        throw error;
      }
      return reply(data);
    }
    return reply({ error: "Chế độ recovery không hợp lệ." }, 400);
  } catch (e) {
    const [message, status] = mapped(e instanceof Error ? e.message : "");
    return reply({ error: message }, status);
  }
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_backup"), tripId: z.uuid(), title: z.string().trim().max(200).optional() }),
  z.object({ action: z.literal("restore_backup"), backupId: z.uuid(), name: z.string().trim().max(160).optional() }),
  z.object({ action: z.literal("restore_deleted"), tripId: z.uuid(), entity: z.enum(["trip", "item", "budget", "expense", "media", "participant"]), id: z.uuid() }),
]);

export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin)
    return reply({ error: "Nguồn yêu cầu không hợp lệ." }, 403);
  const a = await auth();
  if (!a) return reply({ error: "Vui lòng đăng nhập." }, 401);
  try {
    const raw = await req.text();
    if (raw.length > 10000) return reply({ error: "Dữ liệu quá lớn." }, 413);
    const parsed = bodySchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return reply({ error: "Dữ liệu recovery không hợp lệ." }, 400);
    let result;
    if (parsed.data.action === "create_backup")
      result = await a.s.rpc("tf_create_trip_backup", { target_trip: parsed.data.tripId, backup_title: parsed.data.title || null });
    else if (parsed.data.action === "restore_backup")
      result = await a.s.rpc("tf_restore_trip_backup", { backup_id: parsed.data.backupId, restored_name: parsed.data.name || null });
    else
      result = await a.s.rpc("tf_restore_deleted", { target_trip: parsed.data.tripId, target_entity: parsed.data.entity, target_id: parsed.data.id });
    if (result.error) {
      if (migrationError(result.error))
        return reply(
          {
            error:
              "Database chưa được nâng cấp V0.7.0. Hãy chạy migration 202609280003_v070_backup_recovery_operations.sql.",
            code: "V070_MIGRATION_REQUIRED",
          },
          503,
        );
      throw result.error;
    }
    return reply({ result: result.data });
  } catch (e) {
    if (e instanceof SyntaxError) return reply({ error: "JSON không hợp lệ." }, 400);
    const [message, status] = mapped(e instanceof Error ? e.message : "");
    return reply({ error: message }, status);
  }
}
