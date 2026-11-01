import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serverClient } from "@/lib/supabase/server";
import {
  mutationRequestError,
  privateHeaders,
  readJsonText,
} from "@/lib/api-hardening";
import { fundMutation, fundErrors } from "@/lib/fund";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: privateHeaders() });
function failure(error: unknown) {
  const m = String((error as { message?: string })?.message || "");
  const code = Object.keys(fundErrors).find((c) => m.includes(c));
  if (code)
    return reply(
      { error: fundErrors[code] },
      code === "FORBIDDEN" || code === "READ_ONLY"
        ? 403
        : code === "STALE_VERSION"
          ? 409
          : 400,
    );
  if (/does not exist|schema cache|PGRST202|42P01/.test(m))
    return reply(
      { error: "Chạy migration V2.9.0 để sử dụng quỹ chuyến đi." },
      503,
    );
  return reply(
    { error: "Không xử lý được quỹ. Kiểm tra thông tin và thử lại." },
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
    const t = z.uuid().safeParse(req.nextUrl.searchParams.get("trip"));
    if (!t.success) return reply({ error: "Chuyến đi không hợp lệ." }, 400);
    const access = await s.rpc("tf_trip_permissions", { target_trip: t.data });
    if (access.error) return failure(access.error);
    const results = await Promise.all([
      s.from("trip_funds").select("*").eq("trip_id", t.data).limit(1),
      s.from("fund_targets").select("*").eq("trip_id", t.data).limit(2001),
      s
        .from("fund_entries")
        .select("*")
        .eq("trip_id", t.data)
        .order("created_at")
        .limit(10001),
    ]);
    for (const r of results) if (r.error) return failure(r.error);
    if (
      (results[1].data?.length || 0) > 2000 ||
      (results[2].data?.length || 0) > 10000
    )
      return reply(
        {
          error: "Sổ quỹ vượt giới hạn tải. Liên hệ quản trị để xuất dữ liệu.",
        },
        413,
      );
    return reply({
      fund: results[0].data?.[0] || null,
      targets: results[1].data || [],
      entries: results[2].data || [],
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const bad = mutationRequestError(req, 16000);
    if (bad) return reply({ error: bad.message }, bad.status);
    const s = await serverClient();
    const {
      data: { user },
    } = await s.auth.getUser();
    if (!user) return reply({ error: "Vui lòng đăng nhập." }, 401);
    const p = fundMutation.safeParse(
      JSON.parse(await readJsonText(req, 16000)),
    );
    if (!p.success)
      return reply(
        { error: p.error.issues.map((i) => i.message).join(" ") },
        400,
      );
    if (p.data.action === "setup") {
      const keeper = await s
        .from("trip_participants")
        .select("id")
        .eq("trip_id", p.data.tripId)
        .eq("name", p.data.data.keeper)
        .is("deleted_at", null)
        .limit(1);
      if (keeper.error || !keeper.data?.length)
        return reply(
          { error: "Chọn người giữ quỹ từ danh sách người tham gia hiện tại." },
          400,
        );
    }
    const r = await s.rpc("tf_fund_mutate", { p: p.data });
    if (r.error) return failure(r.error);
    return reply({ result: r.data });
  } catch (e) {
    return failure(e);
  }
}
