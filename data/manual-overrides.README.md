# Manual verified overrides

Add an entry to `manual-overrides.json` only when you have personally
verified the value against the cited source document.  Each entry is
treated as `source: "annual_report_verified"` at the field level.

### Schema

```json
{
  "ticker": "TCS",
  "fiscalYear": "FY2025",
  "field": "currentAssets",
  "value": 123456,
  "unit": "INR crore",
  "source": "annual_report_verified",
  "sourceDocument": "TCS Annual Report FY2025",
  "pageOrSection": "Consolidated Balance Sheet",
  "verifiedBy": "manual"
}
```

### Rules

- Every override **must** include `sourceDocument` and `pageOrSection`.
- Numbers are stored as written in the cited statement, in the stated `unit`.
- Do not paste figures from secondary aggregators (Screener, Tijori, Moneycontrol).
  Only consolidated audited financial statements or NSE/BSE XBRL filings.
- Do not include current market cap for prior years; market cap must be
  the as-of-fiscal-year value if used at all.
- Do not estimate or interpolate.
- If you can't cite a source page/section, do not add the entry.
