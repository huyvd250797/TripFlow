import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import {
  mutationRequestError,
  privateHeaders,
  readJsonText,
} from "@/lib/api-hardening";
import { bookingMutation } from "@/lib/bookings";
import { z } from "zod";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: privateHeaders() });
function failure(error: unknown) {
  const m = String((error as { message?: string })?.message || "");
  if (/42P01|PGRST202|does not exist|schema cache/i.test(m))
    return reply(
      { error: "Chưa có module đặt chỗ. Chạy migration V2.8.0 rồi thử lại." },
      503,
    );
  if (/FORBIDDEN|ACCOUNT_DEACTIVATED/.test(m))
    return reply({ error: "Bạn không có quyền thao tác chuyến đi này." }, 403);
  if (/STALE_VERSION/.test(m))
    return reply(
      {
        error:
          "Dữ liệu đã thay đổi trên thiết bị khác. Tải lại danh sách trước khi sửa.",
      },
      409,
    );
  return reply(
    {
      error:
        "Không xử lý được đặt chỗ. Kiểm tra thông tin, kết nối và thử lại.",
    },
    400,
  );
}
export async function GET(req: NextRequest) {
  try {
    const s = await serverClient();
    const {
      data: { user },
    } = await s.auth.getUser();
    if (!user) return reply({ error: "Vui lòng đăng nhập." }, 401);
    const trip = z.uuid().safeParse(req.nextUrl.searchParams.get("trip"));
    if (!trip.success) return reply({ error: "Chuyến đi không hợp lệ." }, 400);
    const access = await s.rpc("tf_trip_permissions", {
      target_trip: trip.data,
    });
    if (access.error) return failure(access.error);
    const { data, error } = await s
      .from("travel_bookings")
      .select("*")
      .eq("trip_id", trip.data)
      .is("deleted_at", null)
      .order("created_at")
      .limit(2001);
    if (error) return failure(error);
    if ((data?.length || 0) > 2000)
      return reply(
        {
          error: "Chuyến có trên 2.000 đặt chỗ/tài liệu. Hãy liên hệ quản trị.",
        },
        413,
      );
    return reply({ bookings: data || [] });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const bad = mutationRequestError(req, 30000);
    if (bad) return reply({ error: bad.message }, bad.status);
    const s = await serverClient();
    const {
      data: { user },
    } = await s.auth.getUser();
    if (!user) return reply({ error: "Vui lòng đăng nhập." }, 401);
    const parsed = bookingMutation.safeParse(
      JSON.parse(await readJsonText(req, 30000)),
    );
    if (!parsed.success)
      return reply(
        { error: parsed.error.issues.map((i) => i.message).join(" ") },
        400,
      );
    const { data, error } = await s.rpc("tf_booking_mutate", {
      p: parsed.data,
    });
    if (error) return failure(error);
    return reply({ booking: data });
  } catch (e) {
    return failure(e);
  }
}
