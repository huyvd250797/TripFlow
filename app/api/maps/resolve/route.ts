import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { privateHeaders } from "@/lib/api-hardening";
import { allowedGoogleMapsUrl, resolveGoogleMapsUrl } from "@/lib/google-maps-resolver";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function reply(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: privateHeaders() });
}

async function auth() {
  const s = await serverClient();
  const { data, error } = await s.auth.getUser();
  if (error || !data.user) return null;
  const { data: account, error: accountError } = await s.rpc("tf_account_state");
  if (accountError) throw new Error("V020_ACCOUNT_MIGRATION_REQUIRED");
  if (account?.status !== "active") return { blocked: true } as const;
  return { blocked: false } as const;
}

export async function GET(req: NextRequest) {
  try {
    const a = await auth();
    if (!a) return reply({ error: "Vui lòng đăng nhập." }, 401);
    if (a.blocked) return reply({ error: "Tài khoản đã bị hủy kích hoạt." }, 403);

    const raw = (req.nextUrl.searchParams.get("url") || "").trim();
    if (!raw || raw.length > 3000) return reply({ error: "Link Google Maps không hợp lệ." }, 400);
    if (!allowedGoogleMapsUrl(raw)) return reply({ error: "Chỉ hỗ trợ link Google Maps HTTPS." }, 400);

    const result = await resolveGoogleMapsUrl(raw);
    const debug = req.nextUrl.searchParams.get("debug") === "1";
    return reply({
      originalUrl: result.originalUrl,
      resolvedUrl: result.resolvedUrl,
      normalizedUrl: result.normalizedUrl,
      coordinate: result.coordinate,
      source: result.source,
      ...(debug || !result.coordinate ? { trace: result.trace } : {}),
    });
  } catch (error) {
    console.error("Google Maps resolve failed", error);
    return reply(
      {
        error: "Không đọc được tọa độ từ link Google Maps lúc này.",
        code: error instanceof Error ? error.message : "GOOGLE_MAPS_RESOLVE_FAILED",
      },
      502,
    );
  }
}
