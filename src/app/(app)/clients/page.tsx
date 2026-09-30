import Link from "next/link";
import { Badge, Empty, LinkButton, PageHeader, STAGES, StageBadge } from "@/components/ui";
import { requireAgent } from "@/lib/auth";
import { all, type Client } from "@/lib/db";
import { daysUntil, prettyPhone, shortDate, usd } from "@/lib/format";

export const metadata = { title: "Clients" };

export default async function ClientsPage(props: PageProps<"/clients">) {
  const agent = await requireAgent();
  const { stage, q } = await props.searchParams;
  const activeStage = typeof stage === "string" ? stage : "";
  const query = typeof q === "string" ? q.trim() : "";

  const clients = all<Client & { saved: number }>(
    `SELECT c.*, (SELECT COUNT(*) FROM calculations k WHERE k.client_id = c.id) AS saved
     FROM clients c WHERE c.agent_id = ? ${activeStage ? "AND c.stage = ?" : ""} ${query ? "AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)" : ""}
     ORDER BY c.updated_at DESC`,
    agent.id, ...(activeStage ? [activeStage] : []), ...(query ? [`%${query}%`, `%${query}%`, `%${query}%`] : []),
  );

  const tab = (value: string, label: string) => (
    <Link
      key={value}
      href={value ? `/clients?stage=${value}` : "/clients"}
      className={`whitespace-nowrap rounded-full px-3 py-1 text-sm ${activeStage === value ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <PageHeader title="Clients" sub="Every buyer and seller, with their numbers saved." action={<LinkButton href="/clients/new">+ New client</LinkButton>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-2 overflow-x-auto">{[tab("", "All"), ...STAGES.map((s) => tab(s.value, s.label))]}</div>
        <form className="ml-auto">
          {activeStage && <input type="hidden" name="stage" value={activeStage} />}
          <input name="q" defaultValue={query} placeholder="Search name, email, phone" className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm" />
        </form>
      </div>

      {clients.length === 0 ? (
        <Empty title={query || activeStage ? "No matching clients" : "No clients yet"}>
          <Link href="/clients/new" className="font-medium text-brand-600">Add your first client</Link> to start saving breakdowns to their profile.
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {clients.map((c) => {
              const closeIn = c.closing_date ? daysUntil(c.closing_date) : null;
              return (
                <li key={c.id}>
                  <Link href={`/clients/${c.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{c.name}</span>
                        <Badge>{c.kind === "both" ? "Buyer + Seller" : c.kind === "seller" ? "Seller" : "Buyer"}</Badge>
                      </div>
                      <div className="truncate text-sm text-slate-500">
                        {[prettyPhone(c.phone), c.email, c.budget ? usd(c.budget) : null].filter(Boolean).join(" · ") || "No contact info yet"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      {closeIn != null && closeIn >= 0 && c.stage !== "closed" && <Badge tone="amber">Closes {closeIn === 0 ? "today" : `in ${closeIn}d`}</Badge>}
                      {c.saved > 0 && <span>{c.saved} saved</span>}
                      <StageBadge stage={c.stage} />
                      <span className="hidden sm:inline">{shortDate(c.updated_at)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
