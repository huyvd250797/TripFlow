import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serverClient } from "@/lib/supabase/server";
import { mutationRequestError, privateHeaders, readJsonText } from "@/lib/api-hardening";

export const dynamic = "force-dynamic";

function reply(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: privateHeaders() });
}

async function auth() {
  const s = await serverClient();
  const { data, error } = await s.auth.getUser();
  if (error || !data.user) return null;
  const { data: account, error: accountError } = await s.rpc("tf_account_state");
  if (accountError) throw new Error("V020_ACCOUNT_MIGRATION_REQUIRED");
  if (account?.status !== "active") return { s, user: data.user, blocked: true } as const;
  return { s, user: data.user, blocked: false } as const;
}

const saveSchema = z.object({
  action: z.literal("save"),
  tripId: z.uuid(),
  name: z.string().trim().min(1).max(160),
  description: z.string().max(1200).default(""),
});
const applySchema = z.object({
  action: z.literal("apply"),
  templateId: z.uuid(),
  name: z.string().trim().min(1).max(160),
  startDate: z.iso.date(),
  destination: z.string().max(300).optional().nullable(),
});
const deleteSchema = z.object({ action: z.literal("delete"), templateId: z.uuid() });
const bodySchema = z.discriminatedUnion("action", [saveSchema, applySchema, deleteSchema]);

export async function GET() {
  try {
    const a = await auth();
    if (!a) return reply({ error: "Vui lòng đăng nhập." }, 401);
    if (a.blocked) return reply({ error: "Tài khoản đã bị hủy kích hoạt." }, 403);
    const { data, error } = await a.s
      .from("trip_templates")
      .select("id,owner_id,name,description,destination,timezone,people,duration_days,item_count,budget_count,participant_count,usage_count,last_used_at,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) {
      if (String(error.code || "") === "42P01")
        return reply({ error: "Database chưa được nâng cấp V1.4.0.", code: "V140_MIGRATION_REQUIRED" }, 503);
      throw error;
    }
    return reply({ templates: data || [] });
  } catch (error) {
    console.error("Template list failed", error);
    return reply({ error: "Không tải được mẫu kế hoạch." }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const requestError = mutationRequestError(req, 30000);
    if (requestError) return reply({ error: requestError.message }, requestError.status);
    const a = await auth();
    if (!a) return reply({ error: "Phiên đã hết hạn. Vui lòng đăng nhập lại." }, 401);
    if (a.blocked) return reply({ error: "Tài khoản đã bị hủy kích hoạt." }, 403);
    let raw: string;
    try {
      raw = await readJsonText(req, 30000);
    } catch (error) {
      if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE")
        return reply({ error: "Dữ liệu quá lớn." }, 413);
      throw error;
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return reply({ error: "JSON không hợp lệ." }, 400);
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return reply({ error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ." }, 400);

    if (parsed.data.action === "save") {
      const { data, error } = await a.s.rpc("tf_save_trip_template", {
        target_trip: parsed.data.tripId,
        template_name: parsed.data.name,
        template_description: parsed.data.description,
      });
      if (error) {
        if (String(error.code || "") === "42883")
          return reply({ error: "Database chưa được nâng cấp V1.4.0.", code: "V140_MIGRATION_REQUIRED" }, 503);
        throw error;
      }
      return reply({ template: data });
    }

    if (parsed.data.action === "apply") {
      const { data, error } = await a.s.rpc("tf_create_trip_from_template", {
        template_id: parsed.data.templateId,
        new_name: parsed.data.name,
        new_start_date: parsed.data.startDate,
        new_destination: parsed.data.destination || null,
      });
      if (error) {
        if (String(error.code || "") === "42883")
          return reply({ error: "Database chưa được nâng cấp V1.4.0.", code: "V140_MIGRATION_REQUIRED" }, 503);
        throw error;
      }
      return reply({ result: data });
    }

    const { error } = await a.s.from("trip_templates").delete().eq("id", parsed.data.templateId);
    if (error) throw error;
    return reply({ deleted: true });
  } catch (error) {
    console.error("Template mutation failed", error);
    const message = error instanceof Error ? error.message : "";
    const known = ["READ_ONLY", "FORBIDDEN", "NOT_FOUND", "INVALID_TEMPLATE_NAME", "INVALID_TRIP_NAME", "START_DATE_REQUIRED"]
      .find((code) => message.includes(code));
    const labels: Record<string, string> = {
      READ_ONLY: "Bạn chỉ có quyền xem chuyến đi này.",
      FORBIDDEN: "Bạn không có quyền tạo mẫu từ chuyến đi này.",
      NOT_FOUND: "Không tìm thấy mẫu hoặc chuyến đi.",
      INVALID_TEMPLATE_NAME: "Tên mẫu kế hoạch không hợp lệ.",
      INVALID_TRIP_NAME: "Tên chuyến đi mới không hợp lệ.",
      START_DATE_REQUIRED: "Vui lòng chọn ngày bắt đầu cho chuyến mới.",
    };
    return reply({ error: known ? labels[known] : "Không xử lý được mẫu kế hoạch. Vui lòng thử lại." }, known === "FORBIDDEN" || known === "READ_ONLY" ? 403 : 400);
  }
}
