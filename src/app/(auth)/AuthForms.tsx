"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Field, Input } from "@/components/ui";

export function SignupForm() {
  const [state, action] = useActionState(signup, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Full name" htmlFor="name">
        <Input id="name" name="name" defaultValue={state?.values?.name} autoComplete="name" required />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" defaultValue={state?.values?.email} type="email" autoComplete="email" required />
      </Field>
      <Field label="Cell phone" htmlFor="phone" help="We use this for deal reminders and your client-facing reports.">
        <Input id="phone" name="phone" defaultValue={state?.values?.phone} type="tel" autoComplete="tel" placeholder="(312) 555-0123" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Brokerage (optional)" htmlFor="brokerage">
          <Input id="brokerage" name="brokerage" defaultValue={state?.values?.brokerage} autoComplete="organization" />
        </Field>
        <Field label="Market (optional)" htmlFor="market">
          <Input id="market" name="market" defaultValue={state?.values?.market} placeholder="Chicago Metro" />
        </Field>
      </div>
      <Field label="Password" htmlFor="password" help="At least 8 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
        <input type="checkbox" name="sms_opt_in" className="mt-0.5" defaultChecked={Boolean(state?.values?.sms_opt_in)} />
        <span>
          Text me deal reminders and product updates. Msg &amp; data rates may apply. Reply STOP to opt out anytime. Consent is not a condition of use.
        </span>
      </label>
      <SubmitButton className="w-full">Create account</SubmitButton>
      <p className="text-center text-sm text-slate-500">
        Already have an account? <Link href="/login" className="font-medium text-brand-600">Log in</Link>
      </p>
    </form>
  );
}

export function LoginForm() {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" defaultValue={state?.values?.email} type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton className="w-full">Log in</SubmitButton>
      <p className="text-center text-sm text-slate-500">
        New here? <Link href="/signup" className="font-medium text-brand-600">Create an account</Link>
      </p>
    </form>
  );
}
