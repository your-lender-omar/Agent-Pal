import type { CalcResult } from "@/lib/calc";

/** Renders a calculator result. Pure, so it works in the live calculator and the client-facing share page. */
export function ResultView({ result, compact = false }: { result: CalcResult; compact?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-700 p-5 text-white shadow-sm">
        <div className="text-sm font-medium text-brand-100">{result.headline.label}</div>
        <div className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{result.headline.value}</div>
        {result.headline.sub && <div className="mt-1 text-sm text-brand-100">{result.headline.sub}</div>}
      </div>

      {result.warnings && result.warnings.length > 0 && (
        <div className="space-y-2">
          {result.warnings.map((w) => (
            <div key={w} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {w}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-600">Quick breakdown</div>
        <ul className="space-y-2 text-[15px] leading-relaxed text-slate-700">
          {result.breakdown.map((b) => (
            <li key={b} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={compact ? "space-y-3" : "grid gap-3 sm:grid-cols-2"}>
        {result.sections.map((s) => (
          <div key={s.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{s.title}</div>
            <dl className="divide-y divide-slate-100">
              {s.rows.map((r) => (
                <div key={r.label} className={`flex justify-between gap-4 py-1.5 text-sm ${r.strong ? "font-semibold text-slate-900" : "text-slate-600"}`}>
                  <dt>{r.label}</dt>
                  <dd className="tabular-nums">{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
