"use client";

import { useActionState, useTransition } from "react";
import { sendBroadcast, setAgentRole } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Field, Input, inputClass } from "@/components/ui";

export function BroadcastForm({ emailReady, smsReady }: { emailReady: boolean; smsReady: boolean }) {
  const [state, action] = useActionState(sendBroadcast, undefined);
  return (
    <form action={action} className="space-y-3">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.ok && <Alert tone="ok">{state.ok}</Alert>}
      <Field label="Title" htmlFor="title"><Input id="title" name="title" placeholder="Rates dropped to 6.1% today" required /></Field>
      <Field label="Message" htmlFor="body">
        <textarea id="body" name="body" rows={3} className={inputClass} placeholder="Great time to call your fence-sitters. Run a Refi or Buyer Breakdown for them." required />
      </Field>
      <Field label="Link (optional)" htmlFor="link"><Input id="link" name="link" placeholder="/calculators/refi" /></Field>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked disabled /> In-app</label>
        <label className={`flex items-center gap-2 ${emailReady ? "" : "text-slate-400"}`}>
          <input type="checkbox" name="email" disabled={!emailReady} /> Email {!emailReady && "(add RESEND_API_KEY)"}
        </label>
        <label className={`flex items-center gap-2 ${smsReady ? "" : "text-slate-400"}`}>
          <input type="checkbox" name="sms" disabled={!smsReady} /> Text (opted-in only) {!smsReady && "(add Twilio keys)"}
        </label>
        <select name="audience" className={`${inputClass} ml-auto w-auto py-1.5 text-sm`} defaultValue="all" aria-label="Audience">
          <option value="all">All agents</option>
          <option value="admins">Admins only (test)</option>
        </select>
      </div>
      <SubmitButton>Send notification</SubmitButton>
    </form>
  );
}

export function RoleToggle({ agentId, role }: { agentId: number; role: "agent" | "admin" }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(() => setAgentRole(agentId, role === "admin" ? "agent" : "admin"))} className="text-xs text-brand-600 hover:underline">
      {role === "admin" ? "Remove admin" : "Make admin"}
    </button>
  );
}
