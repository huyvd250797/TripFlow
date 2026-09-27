import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (code) {
    const s = await serverClient();
    const { error } = await s.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          req.nextUrl.searchParams.get("recovery") === "1"
            ? "/?recovery=1"
            : "/",
          req.url,
        ),
      );
  }
  return NextResponse.redirect(new URL("/?auth_error=1", req.url));
}
