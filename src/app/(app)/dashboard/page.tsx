import Link from "next/link";
import { Card, Empty, LinkButton, Stat, StageBadge } from "@/components/ui";
import { requireAgent } from "@/lib/auth";
import { CALCULATORS, getCalculator } from "@/lib/calc";
import { all, one, type Calculation, type Client } from "@/lib/db";
import { daysUntil, shortDate } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const agent = await requireAgent();

  const count = (sql: string, ...p: (string | number)[]) => one<{ n: number }>(sql, agent.id, ...p)!.n;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const in30 = new Date(now.getTime() + 30 * 86400_000).toISOString().slice(0, 10);

  const active = count("SELECT COUNT(*) AS n FROM clients WHERE agent_id = ? AND stage IN ('lead', 'active')");
  const underContract = count("SELECT COUNT(*) AS n FROM clients WHERE agent_id = ? AND stage = 'under_contract'");
  const closedYtd = count("SELECT COUNT(*) AS n FROM clients WHERE agent_id = ? AND stage = 'closed' AND updated_at >= ?", `${today.slice(0, 4)}-01-01`);
  const savedCount = count("SELECT COUNT(*) AS n FROM calculations WHERE agent_id = ?");

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

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting}, {agent.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-slate-500">Here&apos;s what needs you today.</p>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/clients/new" variant="secondary">+ Client</LinkButton>
          <LinkButton href="/calculators/buyer">Quick buyer numbers</LinkButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active clients" value={active} href="/clients?stage=active" />
        <Stat label="Under contract" value={underContract} href="/clients?stage=under_contract" />
        <Stat label="Closed this year" value={closedYtd} href="/clients?stage=closed" />
        <Stat label="Saved breakdowns" value={savedCount} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Closing in the next 30 days</h2>
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
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Follow-ups due</h2>
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

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Calculators</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CALCULATORS.map((c) => (
            <Link key={c.slug} href={`/calculators/${c.slug}`} className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-medium shadow-sm hover:border-brand-500 hover:text-brand-700">
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Recently saved</h2>
        {recent.length === 0 ? (
          <Empty title="No saved breakdowns yet">Run any calculator and hit Save to keep it on a client&apos;s profile.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((k) => {
              const h = getCalculator(k.calc_type)?.compute(JSON.parse(k.inputs)).headline;
              return (
                <Link key={k.id} href={k.client_id ? `/clients/${k.client_id}` : `/r/${k.share_token}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-500">
                  <div className="text-xs text-slate-500">{k.client_name ?? "No client"} · {shortDate(k.created_at)}</div>
                  <div className="mt-1 font-medium">{k.title}</div>
                  {h && <div className="mt-2 text-lg font-semibold text-brand-700">{h.value}</div>}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
