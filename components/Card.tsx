import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-line bg-surface-soft shadow-card ${className}`}
    >
      {(title || right) && (
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            {title && (
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>
            )}
          </div>
          {right}
        </header>
      )}
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}
