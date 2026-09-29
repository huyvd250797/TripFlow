import { request as httpsRequest } from "node:https";
import { coordinateMapUrl, extractMapCoordinate, type RouteCoordinate } from "./route-intelligence";

export type GoogleMapsResolveSource = "direct" | "location" | "refresh" | "html" | "unresolved";

export type GoogleMapsResolveTrace = {
  hop: number;
  method: "HEAD" | "GET";
  status: number | null;
  url: string;
  location?: string;
  note?: string;
};

export type GoogleMapsResolveResult = {
  originalUrl: string;
  resolvedUrl: string;
  normalizedUrl: string | null;
  coordinate: RouteCoordinate | null;
  source: GoogleMapsResolveSource;
  trace: GoogleMapsResolveTrace[];
};

export type GoogleMapsHttpResult = {
  status: number;
  headers: Record<string, string>;
  body: string;
};

export type GoogleMapsRequestFn = (url: URL, method: "HEAD" | "GET") => Promise<GoogleMapsHttpResult>;

const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36";

const MAX_HOPS = 8;
const MAX_BODY_BYTES = 2_000_000;

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function normalizeEscaped(value: string) {
  let output = value
    .replace(/&amp;/gi, "&")
    .replace(/&#x26;/gi, "&")
    .replace(/&#38;/gi, "&")
    .replace(/\\u003d/gi, "=")
    .replace(/\\u0026/gi, "&")
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/")
    .trim();
  for (let i = 0; i < 3; i += 1) {
    try {
      const decoded = decodeURIComponent(output);
      if (decoded === output) break;
      output = decoded;
    } catch {
      break;
    }
  }
  return output;
}

export function allowedGoogleMapsUrl(value: string, base?: URL) {
  try {
    const url = base ? new URL(normalizeEscaped(value), base) : new URL(normalizeEscaped(value));
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    const googleDomains = [
      "google.com",
      "google.com.vn",
      "google.co.jp",
      "google.co.uk",
      "google.co.in",
      "google.com.au",
      "google.ca",
      "google.de",
      "google.fr",
      "google.sg",
      "google.co.th",
    ];
    const googleRegionalHost = googleDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
    const allowed = host === "maps.app.goo.gl" || host === "goo.gl" || googleRegionalHost;
    return allowed ? url : null;
  } catch {
    return null;
  }
}

function coordinateFromText(value?: string | null) {
  if (!value) return null;
  const normalized = normalizeEscaped(value);
  return extractMapCoordinate(normalized) || extractMapCoordinate(value);
}

function targetFromRefresh(value: string, base: URL) {
  const match = value.match(/(?:^|;)\s*url\s*=\s*(.+)$/i);
  if (!match) return null;
  return allowedGoogleMapsUrl(match[1].replace(/^['"]|['"]$/g, ""), base);
}

function candidatesFromHtml(html: string, base: URL) {
  const result: URL[] = [];
  const seen = new Set<string>();
  const add = (raw?: string | null) => {
    if (!raw) return;
    const url = allowedGoogleMapsUrl(raw, base);
    if (!url || seen.has(url.toString())) return;
    seen.add(url.toString());
    result.push(url);
  };

  const metaRefresh = html.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["']([^"']+)["'][^>]*>/i);
  if (metaRefresh) {
    const target = targetFromRefresh(metaRefresh[1], base);
    if (target) add(target.toString());
  }

  const canonical = html.match(/<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*canonical[^"']*["'][^>]*>/i);
  if (canonical) add(canonical[1]);

  const ogUrl = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["'][^>]*>/i);
  if (ogUrl) add(ogUrl[1]);

  const jsRedirects = html.matchAll(/(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/gi);
  for (const match of jsRedirects) add(match[1]);

  const rawUrls = html.match(/https?:\\?\/\\?\/[^\s"'<>]{12,4000}/gi) || [];
  for (const raw of rawUrls.slice(0, 160)) add(raw);

  return result;
}

function coordinateFromHtml(html: string, base: URL) {
  const direct = coordinateFromText(html);
  if (direct) return { coordinate: direct, resolvedUrl: base.toString() };

  for (const candidate of candidatesFromHtml(html, base)) {
    const coordinate = coordinateFromText(candidate.toString());
    if (coordinate) return { coordinate, resolvedUrl: candidate.toString() };
  }
  return null;
}

async function rawHttpsRequest(url: URL, method: "HEAD" | "GET"): Promise<GoogleMapsHttpResult> {
  return await new Promise<GoogleMapsHttpResult>((resolve, reject) => {
    const request = httpsRequest(
      url,
      {
        method,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      },
      (response) => {
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(response.headers)) {
          const text = firstHeader(value);
          if (text) headers[key.toLowerCase()] = text;
        }

        if (method === "HEAD") {
          response.resume();
          resolve({ status: response.statusCode || 0, headers, body: "" });
          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += buffer.length;
          if (size <= MAX_BODY_BYTES) chunks.push(buffer);
        });
        response.on("end", () => {
          resolve({
            status: response.statusCode || 0,
            headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
        response.on("error", reject);
      },
    );
    request.setTimeout(6500, () => request.destroy(new Error("GOOGLE_MAPS_RESOLVE_TIMEOUT")));
    request.on("error", reject);
    request.end();
  });
}

function success(
  originalUrl: string,
  resolvedUrl: string,
  coordinate: RouteCoordinate,
  source: GoogleMapsResolveSource,
  trace: GoogleMapsResolveTrace[],
): GoogleMapsResolveResult {
  return {
    originalUrl,
    resolvedUrl,
    normalizedUrl: coordinateMapUrl(coordinate),
    coordinate,
    source,
    trace,
  };
}

export async function resolveGoogleMapsUrl(
  raw: string,
  requestFn: GoogleMapsRequestFn = rawHttpsRequest,
): Promise<GoogleMapsResolveResult> {
  const input = allowedGoogleMapsUrl(raw);
  if (!input) throw new Error("INVALID_GOOGLE_MAPS_URL");

  const trace: GoogleMapsResolveTrace[] = [];
  const direct = coordinateFromText(input.toString());
  if (direct) return success(raw, input.toString(), direct, "direct", trace);

  let current = input;
  const visited = new Set<string>();

  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    if (visited.has(current.toString())) break;
    visited.add(current.toString());

    for (const method of ["HEAD", "GET"] as const) {
      let response: GoogleMapsHttpResult;
      try {
        response = await requestFn(current, method);
      } catch (error) {
        trace.push({
          hop,
          method,
          status: null,
          url: current.toString(),
          note: error instanceof Error ? error.message : "request_failed",
        });
        if (method === "HEAD") continue;
        return {
          originalUrl: raw,
          resolvedUrl: current.toString(),
          normalizedUrl: null,
          coordinate: null,
          source: "unresolved",
          trace,
        };
      }

      const locationRaw = response.headers.location || "";
      trace.push({
        hop,
        method,
        status: response.status,
        url: current.toString(),
        ...(locationRaw ? { location: locationRaw } : {}),
      });

      // Google short links normally expose the final Maps URL here. Parse it before
      // deciding whether the HTTP status is a redirect, because some proxies/CDNs
      // preserve Location while rewriting the status code.
      if (locationRaw) {
        const location = allowedGoogleMapsUrl(locationRaw, current);
        if (location) {
          const coordinate = coordinateFromText(location.toString());
          if (coordinate) return success(raw, location.toString(), coordinate, "location", trace);
          current = location;
          break;
        }
      }

      const refreshRaw = response.headers.refresh || "";
      if (refreshRaw) {
        const refreshTarget = targetFromRefresh(refreshRaw, current);
        if (refreshTarget) {
          const coordinate = coordinateFromText(refreshTarget.toString());
          if (coordinate) return success(raw, refreshTarget.toString(), coordinate, "refresh", trace);
          current = refreshTarget;
          break;
        }
      }

      if (method === "GET" && response.body) {
        const fromHtml = coordinateFromHtml(response.body, current);
        if (fromHtml) return success(raw, fromHtml.resolvedUrl, fromHtml.coordinate, "html", trace);

        const htmlTargets = candidatesFromHtml(response.body, current);
        if (htmlTargets.length) {
          current = htmlTargets[0];
          break;
        }
      }

      // HEAD returned a non-redirect response: retry the same URL with GET so we can
      // inspect HTML/meta refresh/canonical content before giving up.
      if (method === "HEAD") continue;

      return {
        originalUrl: raw,
        resolvedUrl: current.toString(),
        normalizedUrl: null,
        coordinate: null,
        source: "unresolved",
        trace,
      };
    }
  }

  return {
    originalUrl: raw,
    resolvedUrl: current.toString(),
    normalizedUrl: null,
    coordinate: null,
    source: "unresolved",
    trace,
  };
}
