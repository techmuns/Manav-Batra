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

## How to capture a new sample (non-technical guide)

1. Open the repo on GitHub.
2. Go to **Settings → Secrets and variables → Actions** and make sure
   these two repository secrets exist:
   - `DASH_TOOLS_KEY`
   - `MUNSHOT_ACCESS_TOKEN`
   (Add them once; they're reused across runs.)
3. Go to the **Actions** tab.
4. Pick **Probe upstream APIs** from the left sidebar.
5. Click **Run workflow**, type a ticker (e.g. `RELIANCE`, `INFY`,
   `TCS`), keep `commit_samples` as `true`, and click **Run**.
6. Wait ~30 seconds.  The captured JSON appears here as
   `<TICKER>__get_annual_reports.json` and
   `<TICKER>__combined_financials.json`.

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
  "url": "https://birdnest.muns.io/filings/combined_financials",
  "requestBody": { "ticker": "RELIANCE", "country": "India", "q": "consolidated", "period": "annual" },
  "status": 200,
  "fetchedAt": "2026-05-20T03:45:00.000Z",
  "data": { /* the upstream JSON exactly as returned */ }
}
```

## Next step after capture

Once a sample is in this folder, the next pull request will add a
typed mapper (`scripts/ingest/api-financials.ts`) that converts the
`data` field into `FinancialYearData[]` and plugs it into
`scripts/ingest/build-verified-financials.ts` as a new source.
