import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

export function PageHeader({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({ label, htmlFor, help, children }: { label: string; htmlFor?: string; help?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {help && <p className="mt-1 text-xs text-slate-500">{help}</p>}
    </div>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

const buttonStyles = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-slate-300",
  secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100",
  danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50",
};

export function buttonClass(variant: keyof typeof buttonStyles = "primary", size: "sm" | "md" = "md") {
  return `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors ${
    size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2.5 text-[15px]"
  } ${buttonStyles[variant]}`;
}

export function LinkButton({ href, variant, size, children }: { href: string; variant?: keyof typeof buttonStyles; size?: "sm" | "md"; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClass(variant, size)}>
      {children}
    </Link>
  );
}

const badgeTones = {
  blue: "bg-brand-50 text-brand-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  slate: "bg-slate-100 text-slate-600",
  red: "bg-red-50 text-red-700",
};

export function Badge({ tone = "slate", children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeTones[tone]}`}>{children}</span>;
}

export function Stat({ label, value, href }: { label: string; value: ReactNode; href?: string }) {
  const inner = (
    <Card className="p-4 transition-colors hover:border-brand-500">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {children && <div className="mt-2 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Alert({ tone, children }: { tone: "error" | "ok" | "warn"; children: ReactNode }) {
  const styles = { error: "border-red-200 bg-red-50 text-red-700", ok: "border-emerald-200 bg-emerald-50 text-emerald-700", warn: "border-amber-200 bg-amber-50 text-amber-800" };
  return <div className={`rounded-lg border px-3 py-2 text-sm ${styles[tone]}`}>{children}</div>;
}

export const STAGES = [
  { value: "lead", label: "Lead", tone: "slate" },
  { value: "active", label: "Active search", tone: "blue" },
  { value: "under_contract", label: "Under contract", tone: "amber" },
  { value: "closed", label: "Closed", tone: "green" },
  { value: "lost", label: "Lost", tone: "red" },
] as const;

export function StageBadge({ stage }: { stage: string }) {
  const s = STAGES.find((x) => x.value === stage) ?? STAGES[0];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
