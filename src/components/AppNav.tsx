"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/calculators", label: "Calculators" },
];

export function AppNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const links = isAdmin ? [...LINKS, { href: "/admin", label: "Admin" }] : LINKS;
  return (
    <nav className="flex gap-1 overflow-x-auto">
      {links.map((l) => {
        const active = path === l.href || path.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
