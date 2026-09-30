import Link from "next/link";
import { notFound } from "next/navigation";
import { CalculatorView } from "@/components/CalculatorView";
import { PageHeader } from "@/components/ui";
import { requireAgent } from "@/lib/auth";
import { getCalculator, initialInputs, type AgentDefaults, type Inputs } from "@/lib/calc";
import { all, one, type Calculation, type Client } from "@/lib/db";

export default async function CalculatorPage(props: PageProps<"/calculators/[slug]">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const calc = getCalculator(slug);
  if (!calc) notFound();
  const agent = await requireAgent();

  const clients = all<Pick<Client, "id" | "name" | "phone" | "email" | "budget">>(
    "SELECT id, name, phone, email, budget FROM clients WHERE agent_id = ? AND stage != 'lost' ORDER BY updated_at DESC",
    agent.id,
  );
  const clientId = Number(sp.client) || null;
  const client = clients.find((c) => c.id === clientId) ?? null;

  // Re-open a saved breakdown to tweak it (?from=<calculation id>).
  let overrides: Inputs = {};
  const from = Number(sp.from);
  if (from) {
    const saved = one<Calculation>("SELECT * FROM calculations WHERE id = ? AND agent_id = ? AND calc_type = ?", from, agent.id, slug);
    if (saved) overrides = JSON.parse(saved.inputs);
  } else if (client?.budget) {
    if (calc.fields.some((f) => f.key === "price")) overrides.price = client.budget;
  }

  const defaults = JSON.parse(agent.defaults || "{}") as AgentDefaults;

  return (
    <>
      <Link href="/calculators" className="no-print mb-3 inline-block text-sm text-slate-500 hover:text-slate-800">
        ← All calculators
      </Link>
      <PageHeader title={calc.name} sub={client ? <>For <Link className="font-medium text-brand-600" href={`/clients/${client.id}`}>{client.name}</Link> · {calc.blurb}</> : calc.blurb} />
      <CalculatorView
        slug={slug}
        initial={initialInputs(calc, defaults, overrides)}
        clients={clients.map(({ id, name, phone, email }) => ({ id, name, phone, email }))}
        defaultClientId={client?.id ?? null}
        agentName={agent.name}
      />
    </>
  );
}
