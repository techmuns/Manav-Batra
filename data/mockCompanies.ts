import type { CompanyFinancials, YearFinancials } from "@/lib/types";

// All numeric values are in INR crore unless otherwise noted.
// Numbers are illustrative seed data only — they are not authoritative
// and exist purely to demonstrate the calculation engine. When real
// Screener.com data is wired in, this file is replaced by a fetcher
// returning the same `CompanyFinancials[]` shape.

const range = (start: number, end: number) => {
  const out: number[] = [];
  for (let y = start; y <= end; y += 1) out.push(y);
  return out;
};

// Generate ten years of internally-consistent figures using a simple
// growth-and-margin scaffold so trends look plausible.
function build(
  base: Omit<YearFinancials, "year">,
  growth: number,
  startYear: number,
  endYear: number
): YearFinancials[] {
  return range(startYear, endYear).map((year, idx) => {
    const g = (1 + growth) ** idx;
    const y: YearFinancials = { year };
    (Object.keys(base) as Array<keyof typeof base>).forEach((k) => {
      const v = base[k];
      if (typeof v === "number") (y as unknown as Record<string, number>)[k as string] = +(v * g).toFixed(2);
    });
    return y;
  });
}

const infosys: CompanyFinancials = {
  ticker: "INFY",
  name: "Infosys",
  sector: "non_financial",
  sectorLabel: "IT Services",
  years: build(
    {
      sales: 100000,
      cogs: 68000,
      sga: 9000,
      depreciation: 2800,
      ebit: 25000,
      netIncomeBeforeExtraordinary: 19500,
      receivables: 18000,
      currentAssets: 55000,
      currentLiabilities: 22000,
      ppe: 12000,
      totalAssets: 110000,
      totalLiabilities: 35000,
      longTermDebt: 1500,
      retainedEarnings: 60000,
      cfo: 21000,
      marketCap: 620000,
    },
    0.11,
    2016,
    2025
  ),
};

const reliance: CompanyFinancials = {
  ticker: "RELIANCE",
  name: "Reliance Industries",
  sector: "non_financial",
  sectorLabel: "Diversified",
  years: build(
    {
      sales: 400000,
      cogs: 290000,
      sga: 28000,
      depreciation: 22000,
      ebit: 55000,
      netIncomeBeforeExtraordinary: 38000,
      receivables: 22000,
      currentAssets: 180000,
      currentLiabilities: 220000,
      ppe: 420000,
      totalAssets: 950000,
      totalLiabilities: 520000,
      longTermDebt: 230000,
      retainedEarnings: 320000,
      cfo: 70000,
      marketCap: 1600000,
    },
    0.09,
    2016,
    2025
  ),
};

const tcs: CompanyFinancials = {
  ticker: "TCS",
  name: "Tata Consultancy Services",
  sector: "non_financial",
  sectorLabel: "IT Services",
  years: build(
    {
      sales: 150000,
      cogs: 95000,
      sga: 13000,
      depreciation: 3500,
      ebit: 38000,
      netIncomeBeforeExtraordinary: 30000,
      receivables: 28000,
      currentAssets: 70000,
      currentLiabilities: 32000,
      ppe: 14000,
      totalAssets: 130000,
      totalLiabilities: 45000,
      longTermDebt: 1200,
      retainedEarnings: 70000,
      cfo: 33000,
      marketCap: 1400000,
    },
    0.10,
    2016,
    2025
  ),
};

// A finance company — Altman should not be calculated for it.
// Banks don't report receivables / current-asset structures the way
// non-financials do, so those fields are intentionally absent.
const hdfcBank: CompanyFinancials = {
  ticker: "HDFCBANK",
  name: "HDFC Bank",
  sector: "financial",
  sectorLabel: "Bank",
  years: build(
    {
      sales: 120000,
      ebit: 42000,
      netIncomeBeforeExtraordinary: 38000,
      ppe: 9000,
      totalAssets: 1900000,
      totalLiabilities: 1700000,
      marketCap: 1300000,
    },
    0.12,
    2016,
    2025
  ),
};

// A company with intentionally-missing fields so the UI can showcase
// the "Not Calculable" branch with a clear missing-variable list.
const missingDemo: CompanyFinancials = {
  ticker: "DEMO",
  name: "Sample Co. (incomplete data)",
  sector: "non_financial",
  sectorLabel: "Manufacturing",
  years: range(2021, 2025).map((year) => ({
    year,
    sales: 5000 + year * 10,
    cogs: 3500 + year * 8,
    totalAssets: 8000,
    // Deliberately missing: receivables, sga, depreciation, ppe, etc.
  })),
};

export const COMPANIES: CompanyFinancials[] = [
  infosys,
  tcs,
  reliance,
  hdfcBank,
  missingDemo,
];

export function getCompany(ticker: string): CompanyFinancials | undefined {
  return COMPANIES.find((c) => c.ticker === ticker);
}

export function getYear(
  company: CompanyFinancials,
  year: number
): YearFinancials | undefined {
  return company.years.find((y) => y.year === year);
}
