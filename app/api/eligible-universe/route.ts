import { NextResponse } from "next/server";
import SNAPSHOT from "../scores/snapshot";
import { buildEligibleUniverse } from "@/lib/eligibility";

// Reads the bundled, verified-source snapshot and returns only the
// (company, fiscalYear) combinations the dashboard is willing to render.
// No fetching, no estimation, no fallback.

const RESPONSE_HEADERS: HeadersInit = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=86400",
  "Content-Type": "application/json",
};

export async function GET() {
  try {
    const universe = buildEligibleUniverse(SNAPSHOT);
    return NextResponse.json(
      { ok: true, ...universe },
      { status: 200, headers: RESPONSE_HEADERS }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, errorCode: "ROUTE_FAILED", message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
