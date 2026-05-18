import { NextResponse } from "next/server";

// Proxies the typeahead through the worker so the Munshot bearer token never
// reaches the client.  Token is read from the same MUNS_ACCESS_TOKEN secret
// the other Munshot dashboards use.

export type StockSearchHit = {
  ticker: string;
  name: string;
  country: string;
  industry: string;
};

type UpstreamResponse = {
  data?: {
    results?: Record<string, [string, string, string]>;
  };
};

const ERROR_HEADERS: HeadersInit = {
  "Cache-Control": "no-store, must-revalidate",
  "Content-Type": "application/json",
};

function rank(query: string, hits: StockSearchHit[]): StockSearchHit[] {
  const q = query.trim().toUpperCase();
  const score = (h: StockSearchHit): number => {
    const t = h.ticker.toUpperCase();
    if (t === q) return 0;
    if (t.startsWith(q)) return 1;
    return 2;
  };
  return [...hits].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sa - sb;
    return a.ticker.localeCompare(b.ticker);
  });
}

export async function POST(req: Request) {
  let query = "";
  try {
    const body = (await req.json()) as { query?: unknown };
    if (typeof body?.query === "string") query = body.query;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON body." },
      { status: 400, headers: ERROR_HEADERS }
    );
  }

  const q = query.trim();
  if (!q) {
    return NextResponse.json({ ok: true, results: [] }, { headers: ERROR_HEADERS });
  }

  const token = process.env.MUNS_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, message: "Server is missing MUNS_ACCESS_TOKEN." },
      { status: 500, headers: ERROR_HEADERS }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch("https://devde.muns.io/stock/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ user_index: 124, query: q }),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upstream fetch failed.";
    return NextResponse.json(
      { ok: false, message },
      { status: 502, headers: ERROR_HEADERS }
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { ok: false, message: `Upstream returned ${upstream.status}.` },
      { status: 502, headers: ERROR_HEADERS }
    );
  }

  let payload: UpstreamResponse;
  try {
    payload = (await upstream.json()) as UpstreamResponse;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Upstream returned non-JSON." },
      { status: 502, headers: ERROR_HEADERS }
    );
  }

  const raw = payload?.data?.results ?? {};
  const hits: StockSearchHit[] = Object.entries(raw).map(([ticker, tuple]) => {
    const [country, name, industry] = tuple ?? ["", "", ""];
    return { ticker, name, country, industry };
  });

  return NextResponse.json(
    { ok: true, results: rank(q, hits) },
    { headers: ERROR_HEADERS }
  );
}
