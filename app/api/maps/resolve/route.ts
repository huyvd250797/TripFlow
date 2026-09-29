import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { privateHeaders } from "@/lib/api-hardening";
import { coordinateMapUrl, extractMapCoordinate } from "@/lib/route-intelligence";

export const dynamic = "force-dynamic";

function reply(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: privateHeaders() });
}

function allowedGoogleMapsUrl(value: string, base?: URL) {
  try {
    const url = base ? new URL(value, base) : new URL(value);
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

function coordinateFromHtml(html: string) {
  const candidates = html.match(/https?:\\?\/\\?\/[^\s"'<>]{12,3000}/gi) || [];
  for (const candidate of candidates.slice(0, 120)) {
    const cleaned = candidate
      .replace(/\\u003d/gi, "=")
      .replace(/\\u0026/gi, "&")
      .replace(/\\u002f/gi, "/")
      .replace(/\\\//g, "/")
      .replace(/&amp;/gi, "&");
    const coord = extractMapCoordinate(cleaned);
    if (coord) return coord;
  }

  // Some Google responses keep the map state outside a canonical URL.
  // Limit extraction to coordinate-shaped fragments instead of arbitrary decimal pairs in the page.
  const fragments =
    html.match(
      /(?:@-?\d{1,2}(?:\.\d+)?,-?\d{1,3}(?:\.\d+)?|!3d-?\d{1,2}(?:\.\d+)?!4d-?\d{1,3}(?:\.\d+)?|["'](?:lat|latitude)["']\s*:\s*-?\d{1,2}(?:\.\d+)?\s*,\s*["'](?:lng|lon|longitude)["']\s*:\s*-?\d{1,3}(?:\.\d+)?)/gi,
    ) || [];
  for (const fragment of fragments.slice(0, 120)) {
    const coord = extractMapCoordinate(fragment);
    if (coord) return coord;
  }
  return null;
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
    if (direct) {
      return reply({
        originalUrl: raw,
        resolvedUrl: input.toString(),
        normalizedUrl: coordinateMapUrl(direct),
        coordinate: direct,
        source: "direct",
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      let current = input;
      let lastUrl = input.toString();

      for (let hop = 0; hop < 7; hop += 1) {
        const response = await fetch(current, {
          method: "GET",
          redirect: "manual",
          cache: "no-store",
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/154 Mobile Safari/537.36 TripFlow/1.8.2",
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.7",
          },
        });

        const responseUrl = allowedGoogleMapsUrl(response.url || current.toString()) || current;
        lastUrl = responseUrl.toString();
        const fromResponseUrl = extractMapCoordinate(lastUrl);
        if (fromResponseUrl) {
          return reply({
            originalUrl: raw,
            resolvedUrl: lastUrl,
            normalizedUrl: coordinateMapUrl(fromResponseUrl),
            coordinate: fromResponseUrl,
            source: "redirect",
          });
        }

        const location = response.headers.get("location");
        if (response.status >= 300 && response.status < 400 && location) {
          const next = allowedGoogleMapsUrl(location, responseUrl);
          if (!next) break;
          const fromLocation = extractMapCoordinate(next.toString());
          if (fromLocation) {
            return reply({
              originalUrl: raw,
              resolvedUrl: next.toString(),
              normalizedUrl: coordinateMapUrl(fromLocation),
              coordinate: fromLocation,
              source: "redirect",
            });
          }
          current = next;
          continue;
        }

        const html = (await response.text()).slice(0, 4_000_000);
        const fromHtml = coordinateFromHtml(html);
        if (fromHtml) {
          return reply({
            originalUrl: raw,
            resolvedUrl: lastUrl,
            normalizedUrl: coordinateMapUrl(fromHtml),
            coordinate: fromHtml,
            source: "html",
          });
        }
        break;
      }

      return reply({
        originalUrl: raw,
        resolvedUrl: lastUrl,
        normalizedUrl: null,
        coordinate: null,
        source: "unresolved",
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    console.error("Google Maps resolve failed", error);
    return reply({ error: "Không đọc được tọa độ từ link Google Maps lúc này." }, 502);
  }
}
