"use client";

import { useMemo, useState } from "react";
import { AltmanTable } from "@/components/AltmanTable";
import { BeneishTable } from "@/components/BeneishTable";
import { Card } from "@/components/Card";
import { CompanySelector } from "@/components/CompanySelector";
import { ComparisonTable } from "@/components/ComparisonTable";
import { ScoreSummary } from "@/components/ScoreSummary";
import { TrendChart } from "@/components/TrendChart";
import { COMPANIES, getCompany, getYear } from "@/data/mockCompanies";
import { calculateAltman, calculateBeneish } from "@/lib/calculations";

export default function Page() {
  const defaultCompany = COMPANIES[0];
  const defaultYear =
    defaultCompany.years[defaultCompany.years.length - 1]?.year ?? 2025;

  const [selection, setSelection] = useState<{
    ticker: string;
    year: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  function handleCalculate(ticker: string, year: number) {
    setLoading(true);
    // Brief delay so the loading state is visible; calculations are sync.
    window.setTimeout(() => {
      setSelection({ ticker, year });
      setLoading(false);
    }, 350);
  }

  const result = useMemo(() => {
    if (!selection) return null;
    const company = getCompany(selection.ticker);
    if (!company) return null;
    const sorted = [...company.years].sort((a, b) => a.year - b.year);
    const idx = sorted.findIndex((y) => y.year === selection.year);
    const current = idx >= 0 ? sorted[idx] : undefined;
    const prior = idx > 0 ? sorted[idx - 1] : undefined;
    const beneish = calculateBeneish(current, prior);
    const altman = calculateAltman(company, current);
    return { company, year: selection.year, beneish, altman };
  }, [selection]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">
            Financial Risk
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">
            Beneish &amp; Altman Dashboard
          </h1>
        </div>
      </header>

      <Card title="Select company">
        <CompanySelector
          companies={COMPANIES}
          initialTicker={defaultCompany.ticker}
          initialYear={defaultYear}
          onCalculate={handleCalculate}
          loading={loading}
        />
      </Card>

      {loading && (
        <Card>
          <div className="flex items-center gap-3 text-sm text-ink-muted">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
            Crunching ratios…
          </div>
        </Card>
      )}

      {!loading && result && (
        <>
          <ScoreSummary
            company={result.company}
            year={result.year}
            beneish={result.beneish}
            altman={result.altman}
          />

          <Card
            title="Beneish M-Score"
            subtitle="Eight-variable manipulation detection model"
          >
            <BeneishTable outcome={result.beneish} />
          </Card>

          <Card
            title="Altman Z-Score"
            subtitle="Five-variable bankruptcy distress model"
          >
            <AltmanTable outcome={result.altman} />
          </Card>

          <Card title="Score trend">
            <TrendChart company={result.company} />
          </Card>

          <Card
            title="Company comparison"
            subtitle={`At FY ${result.year}`}
          >
            <ComparisonTable companies={COMPANIES} year={result.year} />
          </Card>
        </>
      )}

      {!loading && !result && (
        <Card>
          <p className="text-sm text-ink-muted">
            Pick a company and year, then press <span className="font-medium text-ink">Calculate</span> to view the scores.
          </p>
        </Card>
      )}
    </main>
  );
}
