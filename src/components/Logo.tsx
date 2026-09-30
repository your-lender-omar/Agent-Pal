import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-semibold tracking-tight text-slate-900">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">AP</span>
      <span className="text-lg">
        Agent<span className="text-brand-600">Pal</span>
      </span>
    </Link>
  );
}
