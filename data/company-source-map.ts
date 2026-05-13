import type { CompanySourceMapItem } from "@/lib/types";

// Source-of-truth metadata for the official-filings ingestion pipeline.
// `nseSymbol` and `bseCode` are publicly listed identifiers used by the
// XBRL ingestion path.  `annualReportUrls` is populated manually as
// each company's annual reports are verified — DO NOT pre-fill with
// guesses; only add URLs you have actually cited.
//
// The pipeline iterates this map (NOT the original `data/companies.ts`)
// so the legacy company master can remain in place but only the
// entries listed here are candidates for verified data.

const make = (
  companyName: string,
  ticker: string,
  sector: string,
  ids: { nseSymbol?: string; bseCode?: string; isFinancialCompany?: boolean } = {}
): CompanySourceMapItem => ({
  companyName,
  ticker,
  sector,
  isFinancialCompany: ids.isFinancialCompany ?? false,
  nseSymbol: ids.nseSymbol ?? ticker,
  bseCode: ids.bseCode,
  annualReportUrls: {},
});

export const COMPANY_SOURCE_MAP: CompanySourceMapItem[] = [
  // IT Services
  make("Tata Consultancy Services", "TCS", "IT Services", { bseCode: "532540" }),
  make("Infosys", "INFY", "IT Services", { bseCode: "500209" }),
  make("HCL Technologies", "HCLTECH", "IT Services", { bseCode: "532281" }),
  make("Wipro", "WIPRO", "IT Services", { bseCode: "507685" }),
  make("Tech Mahindra", "TECHM", "IT Services", { bseCode: "532755" }),
  make("LTIMindtree", "LTIM", "IT Services", { bseCode: "540005" }),

  // Energy / Diversified
  make("Reliance Industries", "RELIANCE", "Diversified", { bseCode: "500325" }),
  make("ONGC", "ONGC", "Oil & Gas", { bseCode: "500312" }),
  make("Indian Oil Corp", "IOC", "Oil & Gas", { bseCode: "530965" }),
  make("BPCL", "BPCL", "Oil & Gas", { bseCode: "500547" }),
  make("Coal India", "COALINDIA", "Mining", { bseCode: "533278" }),

  // Power
  make("NTPC", "NTPC", "Power", { bseCode: "532555" }),
  make("Power Grid Corp", "POWERGRID", "Power", { bseCode: "532898" }),
  make("Tata Power", "TATAPOWER", "Power", { bseCode: "500400" }),

  // Auto
  make("Maruti Suzuki", "MARUTI", "Auto", { bseCode: "532500" }),
  make("Tata Motors", "TATAMOTORS", "Auto", { bseCode: "500570" }),
  make("Mahindra & Mahindra", "M&M", "Auto", { bseCode: "500520", nseSymbol: "M%26M" }),
  make("Bajaj Auto", "BAJAJ-AUTO", "Auto", { bseCode: "532977", nseSymbol: "BAJAJ-AUTO" }),
  make("Hero MotoCorp", "HEROMOTOCO", "Auto", { bseCode: "500182" }),
  make("Eicher Motors", "EICHERMOT", "Auto", { bseCode: "505200" }),
  make("TVS Motor", "TVSMOTOR", "Auto", { bseCode: "532343" }),

  // FMCG
  make("Hindustan Unilever", "HINDUNILVR", "FMCG", { bseCode: "500696" }),
  make("ITC", "ITC", "FMCG", { bseCode: "500875" }),
  make("Nestle India", "NESTLEIND", "FMCG", { bseCode: "500790" }),
  make("Britannia Industries", "BRITANNIA", "FMCG", { bseCode: "500825" }),
  make("Dabur India", "DABUR", "FMCG", { bseCode: "500096" }),
  make("Marico", "MARICO", "FMCG", { bseCode: "531642" }),

  // Pharma
  make("Sun Pharmaceutical", "SUNPHARMA", "Pharma", { bseCode: "524715" }),
  make("Dr. Reddy's Labs", "DRREDDY", "Pharma", { bseCode: "500124" }),
  make("Cipla", "CIPLA", "Pharma", { bseCode: "500087" }),
  make("Divi's Laboratories", "DIVISLAB", "Pharma", { bseCode: "532488" }),

  // Cement / Capital Goods / Infra
  make("UltraTech Cement", "ULTRACEMCO", "Cement", { bseCode: "532538" }),
  make("Shree Cement", "SHREECEM", "Cement", { bseCode: "500387" }),
  make("Ambuja Cements", "AMBUJACEM", "Cement", { bseCode: "500425" }),
  make("Larsen & Toubro", "LT", "Capital Goods", { bseCode: "500510" }),

  // Telecom
  make("Bharti Airtel", "BHARTIARTL", "Telecom", { bseCode: "532454" }),

  // Metals
  make("Tata Steel", "TATASTEEL", "Metals", { bseCode: "500470" }),
  make("JSW Steel", "JSWSTEEL", "Metals", { bseCode: "500228" }),
  make("Hindalco", "HINDALCO", "Metals", { bseCode: "500440" }),

  // Consumer / Retail / Paints
  make("Avenue Supermarts", "DMART", "Retail", { bseCode: "540376" }),
  make("Titan Company", "TITAN", "Consumer Durables", { bseCode: "500114" }),
  make("Asian Paints", "ASIANPAINT", "Paints", { bseCode: "500820" }),
  make("Berger Paints", "BERGEPAINT", "Paints", { bseCode: "509480" }),
  make("Pidilite Industries", "PIDILITIND", "Chemicals", { bseCode: "500331" }),

  // Financials — flagged isFinancialCompany so they're excluded from the
  // eligible universe until a sector-specific model is built.
  make("HDFC Bank", "HDFCBANK", "Bank", { bseCode: "500180", isFinancialCompany: true }),
  make("ICICI Bank", "ICICIBANK", "Bank", { bseCode: "532174", isFinancialCompany: true }),
  make("State Bank of India", "SBIN", "Bank", { bseCode: "500112", isFinancialCompany: true }),
  make("Kotak Mahindra Bank", "KOTAKBANK", "Bank", { bseCode: "500247", isFinancialCompany: true }),
  make("Axis Bank", "AXISBANK", "Bank", { bseCode: "532215", isFinancialCompany: true }),
  make("Bajaj Finance", "BAJFINANCE", "NBFC", { bseCode: "500034", isFinancialCompany: true }),
  make("Bajaj Finserv", "BAJAJFINSV", "Financial Services", { bseCode: "532978", isFinancialCompany: true }),
];

export function findSourceFor(ticker: string): CompanySourceMapItem | undefined {
  return COMPANY_SOURCE_MAP.find((c) => c.ticker === ticker.toUpperCase());
}
