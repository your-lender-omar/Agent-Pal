import { LoginForm } from "../AuthForms";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Welcome back</h1>
      <LoginForm />
    </>
  );
}
