import { PageHeader } from "@/components/ui";
import { requireAgent } from "@/lib/auth";
import type { AgentDefaults } from "@/lib/calc/types";
import { prettyPhone } from "@/lib/format";
import { SettingsForm } from "./SettingsForm";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const a = await requireAgent();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Profile & settings" action={<form method="post" action="/api/auth/logout"><button className="text-sm text-slate-500 hover:underline">Log out</button></form>} />
      <SettingsForm
        profile={{
          name: a.name, email: a.email, phone: prettyPhone(a.phone), brokerage: a.brokerage ?? "", license_number: a.license_number ?? "",
          market: a.market ?? "", sms_opt_in: Boolean(a.sms_opt_in), email_opt_in: Boolean(a.email_opt_in),
        }}
        defaults={JSON.parse(a.defaults || "{}") as AgentDefaults}
      />
    </div>
  );
}
