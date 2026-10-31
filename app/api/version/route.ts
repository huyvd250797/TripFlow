import { NextResponse } from "next/server";
import { VERSION, DATABASE_VERSION } from "@/lib/types";
export const dynamic = "force-dynamic";
export function GET() {
  // Public app metadata only. No authentication/database round trip for each version check.
  return NextResponse.json(
    { version: VERSION, databaseVersion: DATABASE_VERSION },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
      },
    },
  );
}
