import Link from "next/link";
import { CalcIcon } from "@/components/CalcIcon";
import { Badge, PageHeader } from "@/components/ui";
import { CALCULATORS } from "@/lib/calc";

export const metadata = { title: "Calculators" };

const GROUPS = [
  { key: "buyer", title: "Buyers" },
  { key: "seller", title: "Sellers" },
  { key: "finance", title: "Financing" },
] as const;

export default async function CalculatorsPage(props: PageProps<"/calculators">) {
  const { client } = await props.searchParams;
  const suffix = typeof client === "string" ? `?client=${client}` : "";
  return (
    <>
      <PageHeader title="Calculators" sub="Results update as you type. Save any result to a client and send it in one tap." />
      <div className="space-y-8">
        {GROUPS.map((g) => (
          <section key={g.key}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{g.title}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {CALCULATORS.filter((c) => c.audience === g.key).map((c) => (
                <Link key={c.slug} href={`/calculators/${c.slug}${suffix}`} className="group flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-500">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                    <CalcIcon slug={c.slug} />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 group-hover:text-brand-700">{c.name}</span>
                      {c.popular && <Badge tone="blue">Popular</Badge>}
                    </span>
                    <span className="mt-1 block text-sm text-slate-500">{c.blurb}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
