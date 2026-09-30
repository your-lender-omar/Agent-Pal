import { Card, PageHeader } from "@/components/ui";
import { ClientForm } from "../ClientForm";

export const metadata = { title: "New client" };

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New client" sub="Only the name is required. Fill in the rest as you learn it." />
      <Card className="p-5 sm:p-6">
        <ClientForm />
      </Card>
    </div>
  );
}
