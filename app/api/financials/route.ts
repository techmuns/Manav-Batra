import { NextResponse } from "next/server";
import { findCompany } from "@/data/companies";
import { devMockYearsFor } from "@/data/devMockFinancials";
import { fetchFromScreener } from "@/lib/screener/fetch";
import type { CompanyFinancials, FinancialYearData } from "@/lib/types";

export const runtime = "edge";

interface ApiResponse {
  master: CompanyFinancials["master"];
  years: FinancialYearData[];
  /** True iff `years` came from the dev mock data (not real Screener). */
  usingSampleData: boolean;
  /** Internal-only diagnostic — never displayed in UI. */
  error?: string;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = url.searchParams.get("ticker");
  const forceMock = url.searchParams.get("mock") === "1";

  if (!ticker) {
    return NextResponse.json({ error: "missing ticker" }, { status: 400 });
  }
  const master = findCompany(ticker.toUpperCase());
  if (!master) {
    return NextResponse.json({ error: "unknown ticker" }, { status: 404 });
  }

  // 1. Try real Screener first (unless explicitly forced to mock).
  let realYears: FinancialYearData[] = [];
  let fetchError: string | undefined;
  if (!forceMock) {
    const result = await fetchFromScreener(master);
    if (result.ok) realYears = result.years;
    else fetchError = result.error;
  }

  // Strip internal-only fieldStatus before returning.
  const stripStatus = (ys: FinancialYearData[]): FinancialYearData[] =>
    ys.map((y) => {
      const { fieldStatus: _drop, ...rest } = y;
      void _drop;
      return rest as FinancialYearData;
    });

  // 2. Fall back to dev mock only if Screener didn't give us anything usable.
  if (realYears.length === 0) {
    const mockYears = devMockYearsFor(master.ticker);
    if (mockYears) {
      const payload: ApiResponse = {
        master,
        years: stripStatus(mockYears),
        usingSampleData: true,
      };
      return NextResponse.json(payload, {
        status: 200,
        headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
      });
    }

    // No real data, no mock — surface the error honestly.
    return NextResponse.json(
      {
        master,
        years: [] as FinancialYearData[],
        usingSampleData: false,
        error: fetchError ?? "no financial data available for this company",
      } satisfies ApiResponse,
      { status: 502 }
    );
  }

  return NextResponse.json(
    {
      master,
      years: stripStatus(realYears),
      usingSampleData: false,
    } satisfies ApiResponse,
    {
      status: 200,
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    }
  );
}
