import { NextResponse } from "next/server";
import { findCompany } from "@/data/companies";
import { fetchFromScreener } from "@/lib/screener/fetch";
import type { CompanyFinancials, FinancialYearData } from "@/lib/types";

export const runtime = "edge";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = url.searchParams.get("ticker");
  if (!ticker) {
    return NextResponse.json({ error: "missing ticker" }, { status: 400 });
  }
  const master = findCompany(ticker.toUpperCase());
  if (!master) {
    return NextResponse.json({ error: "unknown ticker" }, { status: 404 });
  }

  const result = await fetchFromScreener(master);

  // Strip internal-only fields before sending to the client.
  const years: FinancialYearData[] = result.years.map((y) => {
    const { fieldStatus: _ignored, ...rest } = y;
    void _ignored;
    return rest as FinancialYearData;
  });

  const payload: CompanyFinancials & { error?: string } = {
    master,
    years,
  };
  if (!result.ok) payload.error = result.error ?? "unknown fetch failure";

  return NextResponse.json(payload, {
    status: result.ok ? 200 : 502,
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
