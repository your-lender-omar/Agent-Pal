"use client";

import { useActionState } from "react";
import { saveClient } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Field, Input, STAGES, inputClass } from "@/components/ui";
import type { Client } from "@/lib/db";

export function ClientForm({ client }: { client?: Client }) {
  const [state, action] = useActionState(saveClient, undefined);
  const c = client;
  return (
    <form action={action} className="space-y-6">
      {c && <input type="hidden" name="id" value={c.id} />}
      {state?.error && <Alert tone="error">{state.error}</Alert>}

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name">
          <Input id="name" name="name" defaultValue={c?.name} required autoFocus={!c} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" htmlFor="kind">
            <select id="kind" name="kind" defaultValue={c?.kind ?? "buyer"} className={inputClass}>
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
              <option value="both">Buyer + Seller</option>
            </select>
          </Field>
          <Field label="Stage" htmlFor="stage">
            <select id="stage" name="stage" defaultValue={c?.stage ?? "lead"} className={inputClass}>
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Cell phone" htmlFor="phone">
          <Input id="phone" name="phone" type="tel" defaultValue={c?.phone ?? ""} />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={c?.email ?? ""} />
        </Field>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">The deal</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Budget / target price" htmlFor="budget" help="Pre-fills the calculators for this client.">
            <Input id="budget" name="budget" inputMode="decimal" defaultValue={c?.budget ?? ""} placeholder="$" />
          </Field>
          <Field label="Pre-approval amount" htmlFor="preapproval_amount">
            <Input id="preapproval_amount" name="preapproval_amount" inputMode="decimal" defaultValue={c?.preapproval_amount ?? ""} placeholder="$" />
          </Field>
          <Field label="Lender / loan officer" htmlFor="lender">
            <Input id="lender" name="lender" defaultValue={c?.lender ?? ""} />
          </Field>
          <Field label="Target area" htmlFor="target_area">
            <Input id="target_area" name="target_area" defaultValue={c?.target_area ?? ""} placeholder="Lincoln Park, Wicker Park…" />
          </Field>
          <Field label="Property address" htmlFor="property_address">
            <Input id="property_address" name="property_address" defaultValue={c?.property_address ?? ""} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Closing date" htmlFor="closing_date">
              <Input id="closing_date" name="closing_date" type="date" defaultValue={c?.closing_date ?? ""} />
            </Field>
            <Field label="Follow up on" htmlFor="follow_up_date">
              <Input id="follow_up_date" name="follow_up_date" type="date" defaultValue={c?.follow_up_date ?? ""} />
            </Field>
          </div>
        </div>
      </section>

      <Field label="Notes" htmlFor="notes">
        <textarea id="notes" name="notes" rows={4} defaultValue={c?.notes ?? ""} className={inputClass} placeholder="Must-haves, timeline, motivation, kids' schools…" />
      </Field>

      <SubmitButton>{c ? "Save changes" : "Add client"}</SubmitButton>
    </form>
  );
}
