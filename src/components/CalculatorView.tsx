"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { saveCalculation } from "@/app/actions";
import { getCalculator, type Field, type Inputs } from "@/lib/calc";
import { ResultView } from "./ResultView";
import { buttonClass, inputClass } from "./ui";

type ClientOption = { id: number; name: string; phone: string | null; email: string | null };

const affix: Record<string, { pre?: string; post?: string }> = {
  money: { pre: "$" },
  percent: { post: "%" },
  years: { post: "yrs" },
};

function toInputs(fields: Field[], raw: Record<string, string>): Inputs {
  const out: Inputs = {};
  for (const f of fields) {
    out[f.key] = f.kind === "select" ? raw[f.key] : Number(String(raw[f.key] ?? "").replace(/[$,%\s]/g, "")) || 0;
  }
  return out;
}

export function CalculatorView({
  slug,
  initial,
  clients,
  defaultClientId,
  agentName,
}: {
  slug: string;
  initial: Inputs;
  clients: ClientOption[];
  defaultClientId: number | null;
  agentName: string;
}) {
  const calc = getCalculator(slug)!;
  const [raw, setRaw] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, String(v)])));
  const [clientId, setClientId] = useState<number | null>(defaultClientId);
  const [title, setTitle] = useState("");
  const [saved, setSaved] = useState<{ shareToken: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const inputs = useMemo(() => toInputs(calc.fields, raw), [calc.fields, raw]);
  const result = useMemo(() => calc.compute(inputs), [calc, inputs]);
  const client = clients.find((c) => c.id === clientId) ?? null;

  const set = (key: string, value: string) => {
    setRaw((r) => ({ ...r, [key]: value }));
    setSaved(null);
  };

  const save = () =>
    startTransition(async () => {
      setError(null);
      const res = await saveCalculation({ slug, inputs, clientId, title: title.trim() });
      if ("error" in res && res.error) setError(res.error);
      else if ("shareToken" in res) setSaved({ shareToken: res.shareToken! });
    });

  const shareUrl = saved ? `${window.location.origin}/r/${saved.shareToken}` : "";
  const firstName = client?.name.split(" ")[0] ?? "";
  const message = `Hi${firstName ? ` ${firstName}` : ""}, here's the breakdown we talked about: ${shareUrl} - ${agentName}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3">
            {calc.fields.map((f) => {
              if (f.showIf && !f.showIf(inputs)) return null;
              const id = `f-${f.key}`;
              return (
                <div key={f.key}>
                  <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
                    {f.label}
                  </label>
                  {f.kind === "select" ? (
                    <select id={id} value={raw[f.key]} onChange={(e) => set(f.key, e.target.value)} className={inputClass}>
                      {f.options!.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
                      {affix[f.kind]?.pre && <span className="grid place-items-center bg-brand-50 px-3 text-sm font-medium text-brand-600">{affix[f.kind].pre}</span>}
                      <input
                        id={id}
                        inputMode="decimal"
                        value={raw[f.key]}
                        onChange={(e) => set(f.key, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-full min-w-0 px-3 py-2.5 text-[15px] tabular-nums outline-none"
                      />
                      {affix[f.kind]?.post && <span className="grid place-items-center bg-brand-50 px-3 text-sm font-medium text-brand-600">{affix[f.kind].post}</span>}
                    </div>
                  )}
                  {f.help && <p className="mt-1 text-xs text-slate-500">{f.help}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <ResultView result={result} />

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold text-slate-900">Save &amp; send</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <select value={clientId ?? ""} onChange={(e) => { setClientId(e.target.value ? Number(e.target.value) : null); setSaved(null); }} className={inputClass} aria-label="Client">
              <option value="">No client (just save it)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={calc.title(inputs)} className={inputClass} aria-label="Title" />
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          {!saved ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button onClick={save} disabled={pending} className={buttonClass()}>
                {pending ? "Saving…" : client ? `Save to ${client.name}` : "Save breakdown"}
              </button>
              {clients.length === 0 && (
                <Link href="/clients/new" className="text-sm text-brand-600">
                  + Add a client first
                </Link>
              )}
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-emerald-700">Saved{client ? ` to ${client.name}'s profile` : ""}. Share this client-ready report:</p>
              <div className="flex gap-2">
                <input readOnly value={shareUrl} className={`${inputClass} text-sm`} onFocus={(e) => e.target.select()} />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className={buttonClass("secondary")}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={`sms:${client?.phone ?? ""}?&body=${encodeURIComponent(message)}`} className={buttonClass("primary", "sm")}>
                  Text it
                </a>
                <a href={`mailto:${client?.email ?? ""}?subject=${encodeURIComponent(calc.name)}&body=${encodeURIComponent(message)}`} className={buttonClass("secondary", "sm")}>
                  Email it
                </a>
                <a href={shareUrl} target="_blank" className={buttonClass("ghost", "sm")}>
                  Preview
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
