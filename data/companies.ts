import type { CompanyMaster } from "@/lib/types";

// Company master.  Sector and isFinancialCompany determine which models
// are applicable.  `screenerSlug` is the path segment on screener.in
// (e.g. https://www.screener.in/company/<slug>/consolidated/).  For most
// large-cap Indian listings this equals the NSE ticker.  Override the
// slug here whenever Screener uses a different slug.

const make = (
  name: string,
  ticker: string,
  sector: string,
  isFinancial = false,
  slug?: string
): CompanyMaster => ({
  companyName: name,
  ticker,
  screenerSlug: slug ?? ticker,
  sector,
  isFinancialCompany: isFinancial,
});

export const COMPANY_MASTER: CompanyMaster[] = [
  // Banks & Financials
  make("HDFC Bank", "HDFCBANK", "Bank", true),
  make("ICICI Bank", "ICICIBANK", "Bank", true),
  make("State Bank of India", "SBIN", "Bank", true),
  make("Kotak Mahindra Bank", "KOTAKBANK", "Bank", true),
  make("Axis Bank", "AXISBANK", "Bank", true),
  make("IndusInd Bank", "INDUSINDBK", "Bank", true),
  make("Bank of Baroda", "BANKBARODA", "Bank", true),
  make("Punjab National Bank", "PNB", "Bank", true),
  make("Bajaj Finance", "BAJFINANCE", "NBFC", true),
  make("Bajaj Finserv", "BAJAJFINSV", "Financial Services", true),
  make("Cholamandalam Investment", "CHOLAFIN", "NBFC", true),
  make("Shriram Finance", "SHRIRAMFIN", "NBFC", true),
  make("SBI Life Insurance", "SBILIFE", "Insurance", true),
  make("HDFC Life Insurance", "HDFCLIFE", "Insurance", true),
  make("ICICI Prudential Life", "ICICIPRULI", "Insurance", true),
  make("ICICI Lombard General", "ICICIGI", "Insurance", true),
  make("Life Insurance Corp", "LICI", "Insurance", true),

  // IT Services
  make("Tata Consultancy Services", "TCS", "IT Services"),
  make("Infosys", "INFY", "IT Services"),
  make("HCL Technologies", "HCLTECH", "IT Services"),
  make("Wipro", "WIPRO", "IT Services"),
  make("Tech Mahindra", "TECHM", "IT Services"),
  make("LTIMindtree", "LTIM", "IT Services"),
  make("Mphasis", "MPHASIS", "IT Services"),
  make("Coforge", "COFORGE", "IT Services"),
  make("Persistent Systems", "PERSISTENT", "IT Services"),

  // Energy / Oil & Gas / Power
  make("Reliance Industries", "RELIANCE", "Diversified"),
  make("ONGC", "ONGC", "Oil & Gas"),
  make("Indian Oil Corp", "IOC", "Oil & Gas"),
  make("BPCL", "BPCL", "Oil & Gas"),
  make("GAIL India", "GAIL", "Gas"),
  make("Power Grid Corp", "POWERGRID", "Power"),
  make("NTPC", "NTPC", "Power"),
  make("Coal India", "COALINDIA", "Mining"),
  make("Adani Enterprises", "ADANIENT", "Diversified"),
  make("Adani Power", "ADANIPOWER", "Power"),
  make("Adani Green Energy", "ADANIGREEN", "Power"),
  make("Adani Ports", "ADANIPORTS", "Infrastructure"),
  make("Tata Power", "TATAPOWER", "Power"),

  // Auto
  make("Maruti Suzuki", "MARUTI", "Auto"),
  make("Tata Motors", "TATAMOTORS", "Auto"),
  make("Mahindra & Mahindra", "M&M", "Auto"),
  make("Bajaj Auto", "BAJAJ-AUTO", "Auto"),
  make("Hero MotoCorp", "HEROMOTOCO", "Auto"),
  make("Eicher Motors", "EICHERMOT", "Auto"),
  make("TVS Motor", "TVSMOTOR", "Auto"),
  make("Ashok Leyland", "ASHOKLEY", "Auto"),

  // Metals
  make("Tata Steel", "TATASTEEL", "Metals"),
  make("JSW Steel", "JSWSTEEL", "Metals"),
  make("Hindalco", "HINDALCO", "Metals"),
  make("Vedanta", "VEDL", "Metals"),
  make("NMDC", "NMDC", "Metals"),

  // Pharma
  make("Sun Pharmaceutical", "SUNPHARMA", "Pharma"),
  make("Dr. Reddy's Labs", "DRREDDY", "Pharma"),
  make("Cipla", "CIPLA", "Pharma"),
  make("Lupin", "LUPIN", "Pharma"),
  make("Divi's Laboratories", "DIVISLAB", "Pharma"),
  make("Aurobindo Pharma", "AUROPHARMA", "Pharma"),
  make("Biocon", "BIOCON", "Pharma"),

  // FMCG
  make("Hindustan Unilever", "HINDUNILVR", "FMCG"),
  make("ITC", "ITC", "FMCG"),
  make("Nestle India", "NESTLEIND", "FMCG"),
  make("Britannia Industries", "BRITANNIA", "FMCG"),
  make("Dabur India", "DABUR", "FMCG"),
  make("Marico", "MARICO", "FMCG"),
  make("Godrej Consumer", "GODREJCP", "FMCG"),
  make("Colgate-Palmolive", "COLPAL", "FMCG"),

  // Cement
  make("UltraTech Cement", "ULTRACEMCO", "Cement"),
  make("Shree Cement", "SHREECEM", "Cement"),
  make("Ambuja Cements", "AMBUJACEM", "Cement"),
  make("ACC", "ACC", "Cement"),

  // Telecom
  make("Bharti Airtel", "BHARTIARTL", "Telecom"),
  make("Vodafone Idea", "IDEA", "Telecom"),

  // Capital Goods / Infra
  make("Larsen & Toubro", "LT", "Capital Goods"),
  make("Siemens", "SIEMENS", "Capital Goods"),
  make("ABB India", "ABB", "Capital Goods"),
  make("Bharat Electronics", "BEL", "Defence"),
  make("Hindustan Aeronautics", "HAL", "Defence"),

  // Real Estate
  make("DLF", "DLF", "Real Estate"),
  make("Godrej Properties", "GODREJPROP", "Real Estate"),

  // Retail & Consumer
  make("Avenue Supermarts", "DMART", "Retail"),
  make("Trent", "TRENT", "Retail"),
  make("Titan Company", "TITAN", "Consumer Durables"),
  make("Asian Paints", "ASIANPAINT", "Paints"),
  make("Berger Paints", "BERGEPAINT", "Paints"),
  make("Pidilite Industries", "PIDILITIND", "Chemicals"),

  // Dev / demo company — intentionally incomplete data so the
  // "Not Calculable" branch is easy to exercise.
  make("Sample Co. (incomplete data)", "SAMPLE_INCOMPLETE", "Demo"),
];

export function findCompany(ticker: string): CompanyMaster | undefined {
  return COMPANY_MASTER.find((c) => c.ticker === ticker);
}
