import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { privateHeaders } from "@/lib/api-hardening";
import { extractMapCoordinate } from "@/lib/route-intelligence";

export const dynamic = "force-dynamic";

function reply(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: privateHeaders() });
}

function allowedGoogleMapsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    const allowed =
      host === "maps.app.goo.gl" ||
      host === "goo.gl" ||
      host === "maps.google.com" ||
      host === "google.com" ||
      host === "www.google.com" ||
      host.endsWith(".google.com");
    return allowed ? url : null;
  } catch {
    return null;
  }
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
    const input = allowedGoogleMapsUrl(raw);
    if (!input) return reply({ error: "Chỉ hỗ trợ link Google Maps HTTPS." }, 400);

    const direct = extractMapCoordinate(input.toString());
    if (direct)
      return reply({ originalUrl: raw, resolvedUrl: input.toString(), coordinate: direct, source: "direct" });

    // maps.app.goo.gl is a short redirect. Resolve it on the server so the browser does not hit CORS.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    try {
      const response = await fetch(input, {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 TripFlow/1.8.1",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      const resolvedUrl = response.url || input.toString();
      const resolvedAllowed = allowedGoogleMapsUrl(resolvedUrl);
      if (!resolvedAllowed)
        return reply({ originalUrl: raw, resolvedUrl: raw, coordinate: null, source: "unresolved" });
      const coordinate = extractMapCoordinate(resolvedAllowed.toString());
      return reply({
        originalUrl: raw,
        resolvedUrl: resolvedAllowed.toString(),
        coordinate,
        source: coordinate ? "redirect" : "unresolved",
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    console.error("Google Maps resolve failed", error);
    return reply({ error: "Không đọc được tọa độ từ link Google Maps lúc này." }, 502);
  }
}
