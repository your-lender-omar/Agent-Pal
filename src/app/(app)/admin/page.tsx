import { Badge, Card, PageHeader, Stat, buttonClass } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { all, one, type Agent } from "@/lib/db";
import { prettyPhone, shortDate } from "@/lib/format";
import { channelStatus } from "@/lib/notify";
import { BroadcastForm, RoleToggle } from "./AdminForms";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const me = await requireAdmin();
  const n = (sql: string) => one<{ n: number }>(sql)!.n;
  const agents = all<Agent & { clients: number; saved: number }>(
    `SELECT a.*, (SELECT COUNT(*) FROM clients c WHERE c.agent_id = a.id) AS clients,
            (SELECT COUNT(*) FROM calculations k WHERE k.agent_id = a.id) AS saved
     FROM agents a ORDER BY a.created_at DESC`,
  );
  const broadcasts = all<{ id: number; title: string; channels: string; recipients: number; created_at: string }>(
    "SELECT id, title, channels, recipients, created_at FROM broadcasts ORDER BY id DESC LIMIT 5",
  );

  return (
    <div className="space-y-8">
      <PageHeader title="Admin" sub="Your agents, their contact info, and team-wide notifications." action={<a href="/admin/agents.csv" className={buttonClass("secondary", "sm")}>Export agents (CSV)</a>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Agents" value={agents.length} />
        <Stat label="New this week" value={n("SELECT COUNT(*) AS n FROM agents WHERE created_at >= datetime('now', '-7 days')")} />
        <Stat label="Active this week" value={n("SELECT COUNT(*) AS n FROM agents WHERE last_login_at >= datetime('now', '-7 days')")} />
        <Stat label="SMS opted in" value={n("SELECT COUNT(*) AS n FROM agents WHERE sms_opt_in = 1")} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Send a notification</h2>
          <BroadcastForm emailReady={channelStatus.email} smsReady={channelStatus.sms} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Recent sends</h2>
          {broadcasts.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing sent yet.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {broadcasts.map((b) => (
                <li key={b.id}>
                  <div className="font-medium">{b.title}</div>
                  <div className="text-slate-500">{b.recipients} agents · {b.channels.replaceAll(",", ", ").replace("in_app", "in-app")} · {shortDate(b.created_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Agents</h2>
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {["Name", "Email", "Cell", "Brokerage", "Clients", "Saved", "SMS", "Joined", ""].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {agents.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap px-4 py-2 font-medium">
                    {a.name} {a.role === "admin" && <Badge tone="blue">Admin</Badge>}
                  </td>
                  <td className="px-4 py-2"><a className="text-brand-600" href={`mailto:${a.email}`}>{a.email}</a></td>
                  <td className="whitespace-nowrap px-4 py-2"><a className="text-brand-600" href={`tel:${a.phone}`}>{prettyPhone(a.phone)}</a></td>
                  <td className="px-4 py-2 text-slate-600">{a.brokerage ?? "—"}</td>
                  <td className="px-4 py-2 tabular-nums">{a.clients}</td>
                  <td className="px-4 py-2 tabular-nums">{a.saved}</td>
                  <td className="px-4 py-2">{a.sms_opt_in ? "Yes" : "No"}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">{shortDate(a.created_at)}</td>
                  <td className="px-4 py-2">{a.id !== me.id && <RoleToggle agentId={a.id} role={a.role} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
