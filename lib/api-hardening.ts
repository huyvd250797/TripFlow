import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { VERSION } from "./types";

export function privateHeaders() {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
    Vary: "Cookie",
    "X-TripFlow-Version": VERSION,
    "X-Request-Id": randomUUID(),
  };
}

export type RequestGuardError = { message: string; status: number };

export function mutationRequestError(
  req: NextRequest,
  maxBytes: number,
): RequestGuardError | null {
  const origin = req.headers.get("origin");
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site" || origin !== req.nextUrl.origin)
    return { message: "Nguồn yêu cầu không hợp lệ.", status: 403 };

  const contentType = (req.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("application/json"))
    return { message: "Yêu cầu phải dùng application/json.", status: 415 };

  const length = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(length) && length > maxBytes)
    return { message: "Dữ liệu quá lớn.", status: 413 };
  return null;
}

export async function readJsonText(req: NextRequest, maxBytes: number) {
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes)
    throw Object.assign(new Error("PAYLOAD_TOO_LARGE"), { status: 413 });
  return raw;
}
