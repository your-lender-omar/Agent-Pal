import Link from "next/link";
import { Alert, Field, Input, buttonClass } from "@/components/ui";

export const metadata = { title: "Log in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { error, email } = await props.searchParams;
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Welcome back</h1>
      <form method="post" action="/api/auth/login" className="space-y-4">
        {error && <Alert tone="error">Email or password is incorrect.</Alert>}
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" defaultValue={typeof email === "string" ? email : ""} required />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <button type="submit" className={`${buttonClass()} w-full`}>Log in</button>
        <p className="text-center text-sm text-slate-500">
          New here? <Link href="/signup" className="font-medium text-brand-600">Create an account</Link>
        </p>
      </form>
    </>
  );
}
