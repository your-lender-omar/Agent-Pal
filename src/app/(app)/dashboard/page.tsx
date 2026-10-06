import Link from "next/link";
import { CalcIcon } from "@/components/CalcIcon";
import { Card, Empty, LinkButton, Stat, StageBadge } from "@/components/ui";
import { requireAgent } from "@/lib/auth";
import { CALCULATORS, getCalculator } from "@/lib/calc";
import { all, one, type Calculation, type Client } from "@/lib/db";
import { daysUntil, shortDate } from "@/lib/format";

export const metadata = { title: "Dashboard" };

/** The four tools agents reach for most; everything else sits behind "See all". */
const TOP_TOOLS = CALCULATORS.filter((c) => c.popular).slice(0, 4);
const MORE_TOOLS = CALCULATORS.filter((c) => !TOP_TOOLS.includes(c));

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>
      {action}
    </div>
  );
}

function CheckCircle({ done }: { done: boolean }) {
  return done ? (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 12.5 10 17 19 7" />
      </svg>
    </span>
  ) : (
    <span className="h-6 w-6 shrink-0 rounded-full border-2 border-slate-300" />
  );
}

export default async function Dashboard() {
  const agent = await requireAgent();
  const firstName = agent.name.split(" ")[0];

  const count = (sql: string, ...p: (string | number)[]) => one<{ n: number }>(sql, agent.id, ...p)!.n;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const in30 = new Date(now.getTime() + 30 * 86400_000).toISOString().slice(0, 10);

  const clientCount = count("SELECT COUNT(*) AS n FROM clients WHERE agent_id = ?");
  const savedCount = count("SELECT COUNT(*) AS n FROM calculations WHERE agent_id = ?");
  const hasDefaults = Object.keys(JSON.parse(agent.defaults || "{}")).length > 0;

  const steps = [
    { title: "Create your account", body: "You're in.", done: true, href: null, cta: null },
    {
      title: "Set your market numbers",
      body: "Your rate, taxes and commissions pre-fill every calculator, so you never retype them.",
      done: hasDefaults, href: "/settings#defaults", cta: "Set defaults",
    },
    {
      title: "Add your first client",
      body: "One profile per buyer or seller. Only the name is required.",
      done: clientCount > 0, href: "/clients/new", cta: "Add client",
    },
    {
      title: "Save & send a breakdown",
      body: "Run a Buyer Breakdown, hit Save, and text your client a branded link.",
      done: savedCount > 0, href: "/calculators/buyer", cta: "Run numbers",
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const onboarding = doneCount < steps.length;
  const nextStep = steps.find((s) => !s.done);

  const active = count("SELECT COUNT(*) AS n FROM clients WHERE agent_id = ? AND stage IN ('lead', 'active')");
  const underContract = count("SELECT COUNT(*) AS n FROM clients WHERE agent_id = ? AND stage = 'under_contract'");
  const closedYtd = count("SELECT COUNT(*) AS n FROM clients WHERE agent_id = ? AND stage = 'closed' AND updated_at >= ?", `${today.slice(0, 4)}-01-01`);

  const closings = all<Client>(
    "SELECT * FROM clients WHERE agent_id = ? AND closing_date BETWEEN ? AND ? AND stage NOT IN ('closed', 'lost') ORDER BY closing_date",
    agent.id, today, in30,
  );
  const followUps = all<Client>(
    "SELECT * FROM clients WHERE agent_id = ? AND follow_up_date <= ? AND stage NOT IN ('closed', 'lost') ORDER BY follow_up_date",
    agent.id, today,
  );
  const recent = all<Calculation & { client_name: string | null }>(
    `SELECT k.*, c.name AS client_name FROM calculations k LEFT JOIN clients c ON c.id = k.client_id
     WHERE k.agent_id = ? ORDER BY k.created_at DESC LIMIT 6`,
    agent.id,
  );

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {clientCount === 0 && savedCount === 0 ? `Welcome to AgentPal, ${firstName}` : `Welcome back, ${firstName}`}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {onboarding
              ? `${steps.length - doneCount} quick step${steps.length - doneCount === 1 ? "" : "s"} and you're ready to send your first client breakdown.`
              : "Here's what needs you today."}
          </p>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/clients/new" variant="secondary">+ Client</LinkButton>
          <LinkButton href="/calculators/buyer">Quick buyer numbers</LinkButton>
        </div>
      </div>

      {/* Getting started: only until every step is done */}
      {onboarding && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-semibold text-slate-900">Get set up</h2>
              <p className="text-sm text-slate-500">{doneCount} of {steps.length} done · about 3 minutes</p>
            </div>
            <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={steps.length}>
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </div>
          </div>
          <ol className="divide-y divide-slate-100">
            {steps.map((s) => {
              const isNext = s === nextStep;
              return (
                <li key={s.title} className={`flex items-start gap-4 px-5 py-4 ${isNext ? "bg-brand-50/60" : ""}`}>
                  <CheckCircle done={s.done} />
                  <div className="min-w-0 flex-1">
                    <div className={`font-medium ${s.done ? "text-slate-400 line-through" : "text-slate-900"}`}>{s.title}</div>
                    {!s.done && <p className="mt-0.5 text-sm text-slate-500">{s.body}</p>}
                  </div>
                  {!s.done && s.href && (
                    <LinkButton href={s.href} variant={isNext ? "primary" : "secondary"} size="sm">
                      {s.cta}
                    </LinkButton>
                  )}
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {/* Top 4 tools, with the rest behind "See all" */}
      <section>
        <SectionTitle>Your go-to tools</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {TOP_TOOLS.map((c) => (
            <Link
              key={c.slug}
              href={`/calculators/${c.slug}`}
              className="group flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 transition hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-md"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                <CalcIcon slug={c.slug} className="h-6 w-6" />
              </span>
              <span className="mt-3 font-semibold leading-snug text-slate-900 sm:mt-4">{c.name}</span>
              <span className="mt-1 hidden flex-1 text-sm leading-relaxed text-slate-500 sm:block">{c.blurb}</span>
              <span className="mt-4 hidden text-sm font-medium text-brand-600 sm:block">
                Open <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
              </span>
            </Link>
          ))}
        </div>

        <details className="group mt-3 rounded-xl border border-slate-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-sm font-medium text-slate-700 hover:text-brand-700 [&::-webkit-details-marker]:hidden">
            <span>
              See all calculators <span className="text-slate-400">({MORE_TOOLS.length} more)</span>
            </span>
            <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <div className="grid gap-1 border-t border-slate-100 p-2 sm:grid-cols-2">
            {MORE_TOOLS.map((c) => (
              <Link key={c.slug} href={`/calculators/${c.slug}`} className="flex items-start gap-3 rounded-lg px-3 py-3 hover:bg-slate-50">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                  <CalcIcon slug={c.slug} />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium text-slate-900">{c.name}</span>
                  <span className="block text-sm text-slate-500">{c.blurb}</span>
                </span>
              </Link>
            ))}
          </div>
        </details>
      </section>

      {/* Pipeline: only once they have clients, so new agents aren't greeted by empty boxes */}
      {clientCount > 0 && (
        <>
          <section>
            <SectionTitle>Your pipeline</SectionTitle>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Active clients" value={active} href="/clients?stage=active" />
              <Stat label="Under contract" value={underContract} href="/clients?stage=under_contract" />
              <Stat label="Closed this year" value={closedYtd} href="/clients?stage=closed" />
              <Stat label="Saved breakdowns" value={savedCount} />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section>
              <SectionTitle>Closing in the next 30 days</SectionTitle>
              {closings.length === 0 ? (
                <Empty title="No upcoming closings">Add a closing date to a client and you&apos;ll get reminders 7, 3 and 1 day out.</Empty>
              ) : (
                <Card>
                  <ul className="divide-y divide-slate-100">
                    {closings.map((c) => {
                      const d = daysUntil(c.closing_date!);
                      return (
                        <li key={c.id}>
                          <Link href={`/clients/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                            <div>
                              <div className="font-medium">{c.name}</div>
                              <div className="text-sm text-slate-500">{c.property_address || shortDate(c.closing_date)}</div>
                            </div>
                            <span className={`text-sm font-semibold ${d <= 3 ? "text-red-600" : "text-slate-700"}`}>{d === 0 ? "Today" : `${d} day${d === 1 ? "" : "s"}`}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              )}
            </section>

            <section>
              <SectionTitle>Follow-ups due</SectionTitle>
              {followUps.length === 0 ? (
                <Empty title="You're all caught up">Set a “Follow up on” date on any client to get a nudge here.</Empty>
              ) : (
                <Card>
                  <ul className="divide-y divide-slate-100">
                    {followUps.map((c) => (
                      <li key={c.id}>
                        <Link href={`/clients/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                          <div>
                            <div className="font-medium">{c.name}</div>
                            <div className="text-sm text-slate-500">Due {shortDate(c.follow_up_date)}</div>
                          </div>
                          <StageBadge stage={c.stage} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </section>
          </div>
        </>
      )}

      {recent.length > 0 && (
        <section>
          <SectionTitle action={<Link href="/clients" className="text-sm font-medium text-brand-600">All clients →</Link>}>Recently saved</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((k) => {
              const h = getCalculator(k.calc_type)?.compute(JSON.parse(k.inputs)).headline;
              return (
                <Link key={k.id} href={k.client_id ? `/clients/${k.client_id}` : `/r/${k.share_token}`} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-500">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                    <CalcIcon slug={k.calc_type} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs text-slate-500">{k.client_name ?? "No client"} · {shortDate(k.created_at)}</span>
                    <span className="mt-0.5 block truncate font-medium">{k.title}</span>
                    {h && <span className="mt-1 block text-lg font-semibold text-brand-700">{h.value}</span>}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
