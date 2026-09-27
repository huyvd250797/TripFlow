import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { mutationSchema } from "@/lib/validation";
import { z } from "zod";
export const dynamic = "force-dynamic";
const messages: Record<string, string> = {
  FORBIDDEN: "Bạn không có quyền truy cập chuyến đi này.",
  READ_ONLY: "Bạn chỉ có quyền xem.",
  OWNER_ONLY: "Chỉ chủ chuyến đi được thực hiện thao tác này.",
  CONFLICT:
    "Dữ liệu đã được thay đổi. Hãy đóng form, tải lại và kiểm tra trước khi sửa.",
  ITEM_OUTSIDE_TRIP: "Hoạt động nằm ngoài ngày của chuyến đi.",
  INVALID_LINK: "Dữ liệu liên kết không còn hợp lệ.",
  ACTIVE_CHANGED: "Điểm đang diễn ra đã thay đổi. Hãy tải lại lịch trình.",
  HAS_REFUNDS: "Khoản chi đã có hoàn tiền. Hãy xử lý các khoản hoàn trước.",
  REFUND_EXCEEDED: "Tổng hoàn tiền không được vượt khoản chi gốc.",
  INVITE_INVALID: "Lời mời đã hết hạn, bị thu hồi hoặc không tồn tại.",
  INVITE_EMAIL_MISMATCH: "Hãy đăng nhập bằng đúng email được mời.",
  INVITE_ALREADY_USED: "Lời mời này đã được sử dụng.",
  ALREADY_OWNER: "Bạn đã là chủ chuyến đi.",
  INVALID_REFUND: "Không tìm thấy khoản chi gốc.",
  INVALID_TIMEZONE: "Múi giờ không hợp lệ.",
  OPERATION_REUSED: "Mã thao tác đã dùng cho nội dung khác.",
  ACCOUNT_DEACTIVATED: "Tài khoản đã bị hủy kích hoạt. Liên hệ quản trị Master để được mở lại.",
  NOT_FOUND: "Không tìm thấy dữ liệu hoặc dữ liệu đã bị xóa.",
};
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
async function accountState(s: Awaited<ReturnType<typeof serverClient>>) {
  const { data, error } = await s.rpc("tf_account_state");
  if (error) throw new Error("V020_ACCOUNT_MIGRATION_REQUIRED:" + error.message);
  return data as {
    user_id: string;
    role: "master" | "user";
    status: "active" | "deactivated";
    deactivated_at: string | null;
  };
}
export async function GET(req: NextRequest) {
  try {
    const a = await auth();
    if (!a) return reply({ error: "Vui lòng đăng nhập." }, 401);
    const { s, user } = a;
    const account = await accountState(s);
    if (account.status !== "active")
      return reply(
        {
          error: messages.ACCOUNT_DEACTIVATED,
          code: "ACCOUNT_DEACTIVATED",
          account,
        },
        403,
      );
    const tid = req.nextUrl.searchParams.get("trip");
    if (!tid) {
      const { data, error } = await s
        .from("trips")
        .select("*")
        .is("deleted_at", null)
        .order("start_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return reply({
        trips: data,
        user: { id: user.id, email: user.email },
        account,
      });
    }
    if (!z.uuid().safeParse(tid).success)
      return reply({ error: "Mã chuyến đi không hợp lệ." }, 400);
    const { data: trip, error } = await s
      .from("trips")
      .select("*")
      .eq("id", tid)
      .is("deleted_at", null)
      .single();
    if (error || !trip)
      return reply(
        { error: "Không tìm thấy chuyến đi hoặc bạn không có quyền xem." },
        404,
      );
    async function all(table: string, soft = true) {
      const result: Record<string, unknown>[] = [];
      for (let start = 0; start < 20000; start += 500) {
        let q = s
          .from(table)
          .select("*")
          .eq("trip_id", tid)
          .order("id")
          .range(start, start + 499);
        if (soft) q = q.is("deleted_at", null);
        const { data, error } = await q;
        if (error) throw error;
        result.push(...data);
        if (data.length < 500) return result;
      }
      throw Error("LIMIT_REACHED");
    }
    const [
      items,
      budgets,
      expenses,
      media,
      participants,
      members,
      snapshots,
      invResult,
      auditResult,
    ] = await Promise.all([
      all("itinerary_items"),
      all("budget_items"),
      all("expenses"),
      all("media_links"),
      all("trip_participants"),
      all("trip_members", false),
      all("budget_snapshots", false),
      s
        .from("trip_invitations")
        .select("*")
        .eq("trip_id", tid)
        .order("created_at", { ascending: false })
        .limit(100),
      s
        .from("audit_logs")
        .select("id,entity,action,created_at,actor_id,after_data")
        .eq("trip_id", tid)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (invResult.error || auditResult.error)
      throw invResult.error || auditResult.error;
    const role =
      trip.owner_id === user.id
        ? "owner"
        : members.find((m) => m.user_id === user.id)?.role;
    return reply({
      trip,
      role,
      items,
      budgets,
      expenses,
      media,
      participants,
      members,
      snapshots,
      invitations: invResult.data,
      audits: auditResult.data,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "database";
    console.error("TripFlow read failed", message);
    if (message.startsWith("V020_ACCOUNT_MIGRATION_REQUIRED:"))
      return reply(
        {
          error:
            "Database chưa được nâng cấp V0.2.0. Hãy chạy migration 202609270001_v020_offline_master_admin.sql.",
          code: "V020_MIGRATION_REQUIRED",
        },
        503,
      );
    return reply(
      {
        error:
          "Không tải được dữ liệu. Kiểm tra kết nối và SQL khởi tạo database.",
      },
      500,
    );
  }
}
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin)
      return reply({ error: "Nguồn yêu cầu không hợp lệ." }, 403);
    const a = await auth();
    if (!a)
      return reply({ error: "Phiên đã hết hạn. Vui lòng đăng nhập lại." }, 401);
    const account = await accountState(a.s);
    if (account.status !== "active")
      return reply(
        { error: messages.ACCOUNT_DEACTIVATED, code: "ACCOUNT_DEACTIVATED" },
        403,
      );
    const raw = await req.text();
    if (raw.length > 50000) return reply({ error: "Dữ liệu quá lớn." }, 413);
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      return reply({ error: "JSON không hợp lệ." }, 400);
    }
    const parsed = mutationSchema.safeParse(json);
    if (!parsed.success)
      return reply({ error: parsed.error.issues[0]?.message }, 400);
    const { data, error } = await a.s.rpc("tf_mutate", { req: parsed.data });
    if (error) {
      const code = Object.keys(messages).find((k) => error.message.includes(k));
      return reply(
        {
          error: code
            ? messages[code]
            : "Không lưu được dữ liệu. Kiểm tra trường nhập và thử lại.",
          code: code || "DATABASE_ERROR",
        },
        code === "CONFLICT" || code === "ACTIVE_CHANGED" ? 409 : 400,
      );
    }
    return reply({ result: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message.startsWith("V020_ACCOUNT_MIGRATION_REQUIRED:"))
      return reply(
        {
          error:
            "Database chưa được nâng cấp V0.2.0. Hãy chạy migration 202609270001_v020_offline_master_admin.sql.",
          code: "V020_MIGRATION_REQUIRED",
        },
        503,
      );
    return reply(
      { error: "Lưu chưa thành công. Kiểm tra kết nối rồi thử lại." },
      500,
    );
  }
}
