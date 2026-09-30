import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Empty, LinkButton } from "@/components/ui";
import { requireAgent } from "@/lib/auth";
import { CALCULATORS, getCalculator } from "@/lib/calc";
import { all, one, type Calculation, type Client } from "@/lib/db";
import { daysUntil, prettyPhone, shortDate, usd } from "@/lib/format";
import { DeleteCalcButton, DeleteClientButton, StageSelect } from "./ClientActions";

export default async function ClientPage(props: PageProps<"/clients/[id]">) {
  const { id } = await props.params;
  const agent = await requireAgent();
  const c = one<Client>("SELECT * FROM clients WHERE id = ? AND agent_id = ?", Number(id), agent.id);
  if (!c) notFound();
  const calcs = all<Calculation>("SELECT * FROM calculations WHERE client_id = ? AND agent_id = ? ORDER BY created_at DESC", c.id, agent.id);

  const suggested = CALCULATORS.filter((k) => (c.kind === "seller" ? k.audience === "seller" : c.kind === "buyer" ? k.audience === "buyer" : k.audience !== "finance"));
  const closeIn = c.closing_date ? daysUntil(c.closing_date) : null;

  const facts = [
    { label: "Budget", value: c.budget ? usd(c.budget) : null },
    { label: "Pre-approved", value: c.preapproval_amount ? usd(c.preapproval_amount) : null },
    { label: "Lender", value: c.lender },
    { label: "Target area", value: c.target_area },
    { label: "Property", value: c.property_address },
    { label: "Closing", value: c.closing_date ? `${shortDate(c.closing_date)}${closeIn != null && closeIn >= 0 ? ` (${closeIn}d)` : ""}` : null },
    { label: "Follow up", value: c.follow_up_date ? shortDate(c.follow_up_date) : null },
  ];

  return (
    <>
      <Link href="/clients" className="mb-3 inline-block text-sm text-slate-500 hover:text-slate-800">← Clients</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
            <Badge>{c.kind === "both" ? "Buyer + Seller" : c.kind === "seller" ? "Seller" : "Buyer"}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {c.phone && <a className="text-brand-600" href={`tel:${c.phone}`}>{prettyPhone(c.phone)}</a>}
            {c.phone && <a className="text-brand-600" href={`sms:${c.phone}`}>Text</a>}
            {c.email && <a className="text-brand-600" href={`mailto:${c.email}`}>{c.email}</a>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StageSelect clientId={c.id} stage={c.stage} />
          <LinkButton href={`/clients/${c.id}/edit`} variant="secondary" size="sm">Edit</LinkButton>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Run numbers for {c.name.split(" ")[0]}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {suggested.map((k) => (
                <Link key={k.slug} href={`/calculators/${k.slug}?client=${c.id}`} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium shadow-sm hover:border-brand-500 hover:text-brand-700">
                  {k.name} →
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Saved breakdowns</h2>
            {calcs.length === 0 ? (
              <Empty title="Nothing saved yet">Run a calculator above and hit Save. It&apos;ll show up here with a shareable link.</Empty>
            ) : (
              <ul className="space-y-2">
                {calcs.map((k) => {
                  const calc = getCalculator(k.calc_type);
                  const headline = calc?.compute(JSON.parse(k.inputs)).headline;
                  return (
                    <li key={k.id}>
                      <Card className="flex flex-wrap items-center gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{k.title}</div>
                          <div className="text-sm text-slate-500">
                            {calc?.name} · {shortDate(k.created_at)}
                            {headline && <> · <span className="font-medium text-slate-800">{headline.label}: {headline.value}</span></>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <Link className="text-brand-600" href={`/r/${k.share_token}`} target="_blank">View</Link>
                          <Link className="text-brand-600" href={`/calculators/${k.calc_type}?client=${c.id}&from=${k.id}`}>Tweak</Link>
                          <DeleteCalcButton id={k.id} />
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <Card className="p-4">
            <dl className="space-y-2 text-sm">
              {facts.map((f) => (
                <div key={f.label} className="flex justify-between gap-3">
                  <dt className="text-slate-500">{f.label}</dt>
                  <dd className="text-right font-medium text-slate-800">{f.value ?? <span className="font-normal text-slate-300">—</span>}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card className="p-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</div>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{c.notes || <span className="text-slate-400">No notes yet.</span>}</p>
          </Card>
          <div className="text-center">
            <DeleteClientButton clientId={c.id} name={c.name} />
          </div>
        </aside>
      </div>
    </>
  );
}
