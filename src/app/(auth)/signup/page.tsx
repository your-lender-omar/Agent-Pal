import Link from "next/link";
import { Alert, Field, Input, buttonClass } from "@/components/ui";

export const metadata = { title: "Create your account" };

export default async function SignupPage(props: PageProps<"/signup">) {
  const sp = await props.searchParams;
  const v = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  return (
    <>
      <h1 className="text-xl font-semibold">Create your free account</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">Takes 30 seconds. No credit card.</p>
      <form method="post" action="/api/auth/signup" className="space-y-4">
        {v("error") && <Alert tone="error">{v("error")}</Alert>}
        <Field label="Full name" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" defaultValue={v("name")} required />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" defaultValue={v("email")} required />
        </Field>
        <Field label="Cell phone" htmlFor="phone" help="We use this for deal reminders and your client-facing reports.">
          <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="(312) 555-0123" defaultValue={v("phone")} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Brokerage (optional)" htmlFor="brokerage">
            <Input id="brokerage" name="brokerage" autoComplete="organization" defaultValue={v("brokerage")} />
          </Field>
          <Field label="Market (optional)" htmlFor="market">
            <Input id="market" name="market" placeholder="Chicago Metro" defaultValue={v("market")} />
          </Field>
        </div>
        <Field label="Password" htmlFor="password" help="At least 8 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
          <input type="checkbox" name="sms_opt_in" value="1" className="mt-0.5" defaultChecked={v("sms_opt_in") === "1"} />
          <span>Text me deal reminders and product updates. Msg &amp; data rates may apply. Reply STOP to opt out anytime. Consent is not a condition of use.</span>
        </label>
        <button type="submit" className={`${buttonClass()} w-full`}>Create account</button>
        <p className="text-center text-sm text-slate-500">
          Already have an account? <Link href="/login" className="font-medium text-brand-600">Log in</Link>
        </p>
      </form>
    </>
  );
}
