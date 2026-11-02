import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serverClient } from "@/lib/supabase/server";
import {
  mutationRequestError,
  privateHeaders,
  readJsonText,
} from "@/lib/api-hardening";
import { settlementMutation, settlementErrors } from "@/lib/settlement";
import { fundErrors } from "@/lib/fund";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: privateHeaders() });
function failure(e: unknown) {
  const message = String((e as { message?: string })?.message || "");
  const errors = { ...fundErrors, ...settlementErrors };
  const code = Object.keys(errors).find((k) => message.includes(k));
  if (code)
    return reply(
      { error: errors[code], code },
      [
        "FORBIDDEN",
        "READ_ONLY",
        "PERMISSION_DENIED",
        "ACCOUNT_DEACTIVATED",
      ].includes(code)
        ? 403
        : code === "STALE_VERSION"
          ? 409
          : 400,
    );
  if (/does not exist|schema cache|PGRST202|42P01/.test(message))
    return reply(
      { error: "Chạy migration V2.13.0 để sử dụng Công nợ & quyết toán." },
      503,
    );
  return reply(
    { error: "Không xử lý được quyết toán. Kiểm tra dữ liệu và thử lại." },
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
    const id = z.uuid().safeParse(req.nextUrl.searchParams.get("trip"));
    if (!id.success) return reply({ error: "Chuyến đi không hợp lệ." }, 400);
    const r = await s.rpc("tf_settlement_snapshot", { target_trip: id.data });
    if (r.error) return failure(r.error);
    return reply(r.data);
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
    const p = settlementMutation.safeParse(
      JSON.parse(await readJsonText(req, 16000)),
    );
    if (!p.success)
      return reply(
        { error: p.error.issues.map((i) => i.message).join(" ") },
        400,
      );
    const r = await s.rpc("tf_settlement_mutate", { p: p.data });
    if (r.error) return failure(r.error);
    return reply(r.data);
  } catch (e) {
    return failure(e);
  }
}
