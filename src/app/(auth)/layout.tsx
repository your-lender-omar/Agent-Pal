import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { currentAgent } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await currentAgent()) redirect("/dashboard");
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10">
      <Logo />
      <div className="mt-8 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">{children}</div>
      <p className="mt-6 text-xs text-slate-400">Version {process.env.NEXT_PUBLIC_APP_VERSION}</p>
    </div>
  );
}
