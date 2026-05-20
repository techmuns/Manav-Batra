import { NextResponse } from "next/server";
import GURU from "../scores/gurufocus-snapshot";
import { buildEligibleUniverse, type ScoreTypeFilter } from "@/lib/eligibility";

const RESPONSE_HEADERS: HeadersInit = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=86400",
  "Content-Type": "application/json",
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const raw = (url.searchParams.get("scoreType") ?? "both").toLowerCase();
    const scoreType: ScoreTypeFilter =
      raw === "altman" || raw === "beneish" ? raw : "both";

    const universe = buildEligibleUniverse(GURU, scoreType);
    return NextResponse.json(
      { ok: true, scoreType, ...universe },
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
