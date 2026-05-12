export function MissingDataWarning({ missing }: { missing: string[] }) {
  return (
    <div className="rounded-xl border border-line bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
        Not Calculable
      </p>
      <p className="mt-1 text-sm text-ink-muted">
        The following required variables are missing:
      </p>
      <ul className="mt-2 grid list-disc grid-cols-1 gap-x-6 gap-y-1 pl-5 text-sm text-ink sm:grid-cols-2">
        {missing.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}
