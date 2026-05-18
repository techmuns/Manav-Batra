"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StockSearchHit } from "@/app/api/stock-search/route";

const DEBOUNCE_MS = 250;

// Country → exchange label shown on the ticker chip.
function exchangeFor(country: string): string {
  const c = country.trim().toUpperCase();
  if (c === "USA" || c === "US" || c === "UNITED STATES") return "NASDAQ";
  if (c === "INDIA" || c === "IN") return "NSE";
  return c || "—";
}

type FetchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; results: StockSearchHit[] }
  | { kind: "error"; message: string };

export function CompanySearch({
  onSelect,
  placeholder = "Search company or ticker",
  autoFocus = false,
}: {
  onSelect: (hit: StockSearchHit) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<FetchState>({ kind: "idle" });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setState({ kind: "idle" });
      return;
    }
    const reqId = ++reqIdRef.current;
    setState({ kind: "loading" });
    const handle = setTimeout(async () => {
      try {
        const res = await fetch("/api/stock-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
        });
        const body = (await res.json()) as
          | { ok: true; results: StockSearchHit[] }
          | { ok: false; message: string };
        if (reqId !== reqIdRef.current) return; // stale
        if (!body.ok) {
          setState({ kind: "error", message: body.message });
          return;
        }
        setState({ kind: "ready", results: body.results });
        setActive(0);
      } catch (e) {
        if (reqId !== reqIdRef.current) return;
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : "Network error",
        });
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  // Close dropdown on outside click.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const choose = useCallback(
    (hit: StockSearchHit) => {
      onSelect(hit);
      setQuery(hit.name);
      setOpen(false);
    },
    [onSelect]
  );

  const results = state.kind === "ready" ? state.results : [];

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || results.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(results.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-surface-soft px-4 py-3 text-[15px] outline-none transition focus:border-ink focus:ring-4 focus:ring-ink/10"
      />

      {open && query.trim() !== "" && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          {state.kind === "loading" && (
            <p className="px-4 py-3 text-sm text-ink-muted">Searching…</p>
          )}
          {state.kind === "error" && (
            <p className="px-4 py-3 text-sm text-rose-600">{state.message}</p>
          )}
          {state.kind === "ready" && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-ink-muted">No matches.</p>
          )}
          {state.kind === "ready" &&
            results.map((hit, i) => (
              <button
                key={hit.ticker}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(hit)}
                className={`flex w-full items-center justify-between gap-3 border-b border-line/60 px-4 py-3 text-left text-sm transition last:border-b-0 ${
                  i === active ? "bg-surface-soft" : "hover:bg-surface-soft"
                }`}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-ink">{hit.name}</span>
                  <span className="truncate text-[11px] text-ink-subtle">
                    {hit.industry || "—"}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-paper/60 px-2 py-1 text-[10px] font-medium tracking-wide text-ink-subtle">
                  <span className="text-ink">{hit.ticker}</span>
                  <span aria-hidden>·</span>
                  <span>{exchangeFor(hit.country)}</span>
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
