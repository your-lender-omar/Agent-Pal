import { SignupForm } from "../AuthForms";

export const metadata = { title: "Create your account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Create your free account</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">Takes 30 seconds. No credit card.</p>
      <SignupForm />
    </>
  );
}
