import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { ResultView } from "@/components/ResultView";
import { getCalculator, type Inputs } from "@/lib/calc";
import { one, type Agent, type Calculation } from "@/lib/db";
import { prettyPhone, shortDate } from "@/lib/format";

type Row = Calculation & Pick<Agent, "name" | "email" | "phone" | "brokerage" | "license_number"> & { client_name: string | null };

function load(token: string) {
  return one<Row>(
    `SELECT k.*, a.name, a.email, a.phone, a.brokerage, a.license_number, c.name AS client_name
     FROM calculations k JOIN agents a ON a.id = k.agent_id LEFT JOIN clients c ON c.id = k.client_id
     WHERE k.share_token = ?`,
    token,
  );
}

export async function generateMetadata(props: PageProps<"/r/[token]">): Promise<Metadata> {
  const row = load((await props.params).token);
  return { title: row ? `${row.title} · ${row.name}` : "Report", robots: { index: false } };
}

/** Public, client-facing report. Branded with the agent's contact info. */
export default async function SharedReport(props: PageProps<"/r/[token]">) {
  const row = load((await props.params).token);
  if (!row) notFound();
  const calc = getCalculator(row.calc_type);
  if (!calc) notFound();
  const inputs = JSON.parse(row.inputs) as Inputs;
  const result = calc.compute(inputs);
  const initials = row.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-600 font-semibold text-white">{initials}</div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{row.name}</div>
          <div className="text-sm text-slate-500">{[row.brokerage, row.license_number && `Lic. ${row.license_number}`].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="no-print flex gap-2">
          <a href={`tel:${row.phone}`} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white">Call</a>
          <a href={`sms:${row.phone}`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium">Text</a>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-sm text-slate-500">{row.client_name ? `Prepared for ${row.client_name} · ` : ""}{shortDate(row.created_at)}</div>
        <h1 className="text-2xl font-semibold tracking-tight">{calc.name}</h1>
      </div>

      <ResultView result={result} compact />

      <details className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
        <summary className="cursor-pointer font-medium">Assumptions used</summary>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          {calc.fields.filter((f) => !f.showIf || f.showIf(inputs)).map((f) => (
            <div key={f.key} className="flex justify-between gap-3 text-slate-600">
              <dt>{f.label}</dt>
              <dd className="tabular-nums text-slate-900">
                {f.kind === "select" ? f.options?.find((o) => o.value === inputs[f.key])?.label : f.kind === "money" ? `$${Number(inputs[f.key]).toLocaleString()}` : f.kind === "percent" ? `${inputs[f.key]}%` : f.kind === "years" ? `${inputs[f.key]} yrs` : inputs[f.key]}
              </dd>
            </div>
          ))}
        </dl>
      </details>

      <p className="mt-6 text-xs leading-relaxed text-slate-400">
        Estimates for discussion only. Not a loan approval, commitment, or Loan Estimate. Actual taxes, insurance, rates and closing costs will vary. Questions? Contact {row.name} at {prettyPhone(row.phone)} or {row.email}.
      </p>
      <div className="no-print mt-4 text-center">
        <PrintButton />
      </div>
    </div>
  );
}
