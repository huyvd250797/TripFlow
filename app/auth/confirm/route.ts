import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
export async function GET(req: NextRequest) {
  const token_hash = req.nextUrl.searchParams.get("token_hash");
  const type = req.nextUrl.searchParams.get("type");
  if (token_hash && (type === "email" || type === "recovery")) {
    const s = await serverClient();
    const { error } = await s.auth.verifyOtp({ token_hash, type });
    if (!error)
      return NextResponse.redirect(
        new URL(type === "recovery" ? "/?recovery=1" : "/", req.url),
      );
  }
  return NextResponse.redirect(new URL("/?auth_error=1", req.url));
}
