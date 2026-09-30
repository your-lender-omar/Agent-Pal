import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { LinkButton } from "@/components/ui";
import { currentAgent } from "@/lib/auth";
import { CALCULATORS } from "@/lib/calc";

const FEATURES = [
  { title: "Answers in seconds", body: "Results update as you type. No Compute button, no 20-field forms. Your market's tax and insurance rates are pre-filled." },
  { title: "Plain-English breakdowns", body: "Every calculator writes a 3-bullet summary you can read to your client word-for-word on the phone." },
  { title: "A profile for every deal", body: "Save each buyer and seller with pre-approval, budget, closing date and every scenario you've run for them." },
  { title: "Send it, branded", body: "Text or email a clean, mobile-friendly report with your name, photo and number on it. One tap." },
  { title: "Never miss a date", body: "Automatic reminders 7, 3 and 1 day before closing, plus follow-up nudges you set per client." },
  { title: "Your team, in the loop", body: "Push announcements to every agent in-app, by email or by text, from one admin screen." },
];

export default async function Home() {
  if (await currentAgent()) redirect("/dashboard");
  return (
    <div className="flex-1">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <div className="flex gap-2">
          <LinkButton href="/login" variant="ghost">Log in</LinkButton>
          <LinkButton href="/signup">Get started free</LinkButton>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 text-center sm:pt-20">
        <p className="mx-auto mb-4 w-fit rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">Built for agents, not loan officers</p>
        <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
          The numbers your clients ask for, <span className="text-brand-600">in seconds.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Payment, cash to close, seller net, rent vs buy. Save them to each client&apos;s profile and send a branded breakdown before you hang up.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <LinkButton href="/signup">Create your free account</LinkButton>
          <LinkButton href="/login" variant="secondary">I have an account</LinkButton>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">{f.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-center text-2xl font-semibold tracking-tight">{CALCULATORS.length} calculators. Zero clutter.</h2>
          <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-2">
            {CALCULATORS.map((c) => (
              <div key={c.slug} className="rounded-lg border border-slate-200 p-4">
                <div className="font-medium">{c.name}</div>
                <div className="text-sm text-slate-500">{c.blurb}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-slate-400">© {new Date().getFullYear()} AgentPal. Estimates only, not a loan commitment.</footer>
    </div>
  );
}
