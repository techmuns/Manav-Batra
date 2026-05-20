# API samples

This folder holds **raw JSON responses** captured from the two upstream
financial-data APIs:

- `get_annual_reports` — annual-report PDF URLs per ticker
- `filings/combined_financials` — structured financial line items
  (consolidated, annual)

The captured samples are the **source of truth** when writing the
1:1 mapping from API response → `FinancialYearData` (see
`lib/types.ts`).  Never edit these files by hand — regenerate by
running the probe workflow.

## How to capture samples (non-technical guide)

1. Open the repo on GitHub.
2. Go to **Settings → Secrets and variables → Actions** and make sure
   these two repository secrets exist:
   - `DASH_TOOLS_KEY`
   - `MUNSHOT_ACCESS_TOKEN`
   (Add them once; they're reused across runs.)
3. Go to the **Actions** tab.
4. Pick **Probe upstream APIs** from the left sidebar.
5. Click **Run workflow**.  Two useful modes:
   - **Single ticker**: enter e.g. `RELIANCE`, `INFY`, `TCS`.  ~30 seconds.
   - **All companies**: enter `ALL`.  Iterates every entry in
     `data/companies.ts` (~86 tickers).  Takes a few minutes; tune
     `concurrency` and `delay_ms` if the upstream rate-limits.
6. Keep `commit_samples` as `true`, click **Run**, wait, and the
   captured JSON appears here as
   `<TICKER>__get_annual_reports.json` and
   `<TICKER>__combined_financials.json`, plus an aggregate
   `_summary.json` with status codes per ticker.

## File naming

```
<TICKER>__<endpoint>.json
```

For example:

```
RELIANCE__get_annual_reports.json
RELIANCE__combined_financials.json
```

## What each file contains

```jsonc
{
  "endpoint": "filings/combined_financials",
  "url": "https://devde.muns.io/filings/combined_financials",
  "requestBody": { "ticker": "RELIANCE", "country": "India", "q": "consolidated", "period": "annual" },
  "status": 200,
  "fetchedAt": "2026-05-20T03:45:00.000Z",
  "data": { /* the upstream JSON exactly as returned */ }
}
```

## Next step after capture

Once `combined_financials` samples are in this folder, the next change
will add a typed JSON → `FinancialYearData` mapper that runs against
every captured sample and updates `app/api/scores/snapshot.ts` for
every ticker (alongside the existing markdown parser at
`scripts/ingest/parse-combined-financial-tool.ts`).

This is how the dashboard becomes generic-across-companies in
practice: one probe run captures all responses, one ingest run maps
them into the snapshot, one commit ships the data.
