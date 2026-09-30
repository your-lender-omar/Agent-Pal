import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { requireAgent } from "@/lib/auth";
import { one, type Client } from "@/lib/db";
import { ClientForm } from "../../ClientForm";

export default async function EditClientPage(props: PageProps<"/clients/[id]/edit">) {
  const { id } = await props.params;
  const agent = await requireAgent();
  const client = one<Client>("SELECT * FROM clients WHERE id = ? AND agent_id = ?", Number(id), agent.id);
  if (!client) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit ${client.name}`} />
      <Card className="p-5 sm:p-6">
        <ClientForm client={client} />
      </Card>
    </div>
  );
}
