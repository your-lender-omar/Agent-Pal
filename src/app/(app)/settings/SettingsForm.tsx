"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Card, Field, Input } from "@/components/ui";
import { AGENT_DEFAULT_KEYS, type AgentDefaults } from "@/lib/calc/types";

type Profile = { name: string; email: string; phone: string; brokerage: string; license_number: string; market: string; sms_opt_in: boolean; email_opt_in: boolean };

export function SettingsForm({ profile, defaults }: { profile: Profile; defaults: AgentDefaults }) {
  const [state, action] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="space-y-6">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.ok && <Alert tone="ok">{state.ok}</Alert>}

      <Card className="p-5">
        <h2 className="mb-1 font-semibold">Your profile</h2>
        <p className="mb-4 text-sm text-slate-500">This is what clients see on every report you send.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="name"><Input id="name" name="name" defaultValue={state?.values?.name ?? profile.name} required /></Field>
          <Field label="Email" htmlFor="email" help="Contact support to change your login email."><Input id="email" defaultValue={profile.email} disabled /></Field>
          <Field label="Cell phone" htmlFor="phone"><Input id="phone" name="phone" type="tel" defaultValue={state?.values?.phone ?? profile.phone} required /></Field>
          <Field label="Brokerage" htmlFor="brokerage"><Input id="brokerage" name="brokerage" defaultValue={state?.values?.brokerage ?? profile.brokerage} /></Field>
          <Field label="License #" htmlFor="license_number"><Input id="license_number" name="license_number" defaultValue={state?.values?.license_number ?? profile.license_number} /></Field>
          <Field label="Market" htmlFor="market"><Input id="market" name="market" defaultValue={state?.values?.market ?? profile.market} /></Field>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 font-semibold">Your market defaults</h2>
        <p className="mb-4 text-sm text-slate-500">Set these once and every calculator starts with your numbers. Leave blank to use ours.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {AGENT_DEFAULT_KEYS.map((d) => (
            <Field key={d.key} label={`${d.label} (%)`} htmlFor={`default_${d.key}`}>
              <Input id={`default_${d.key}`} name={`default_${d.key}`} inputMode="decimal" defaultValue={defaults[d.key] ?? ""} placeholder={String(d.fallback)} />
            </Field>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 font-semibold">Notifications</h2>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="email_opt_in" defaultChecked={profile.email_opt_in} /> Email me team announcements</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="sms_opt_in" defaultChecked={profile.sms_opt_in} /> Text me reminders and announcements (reply STOP anytime)</label>
        </div>
      </Card>

      <SubmitButton>Save settings</SubmitButton>
    </form>
  );
}
