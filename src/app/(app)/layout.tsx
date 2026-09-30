import Link from "next/link";
import { logout } from "@/app/actions";
import { AppNav } from "@/components/AppNav";
import { Logo } from "@/components/Logo";
import { requireAgent } from "@/lib/auth";
import { one } from "@/lib/db";
import { generateReminders } from "@/lib/notify";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const agent = await requireAgent();
  // Also runs daily via /api/cron/reminders; running here keeps reminders fresh with no setup.
  generateReminders(agent.id);
  const unread = one<{ n: number }>("SELECT COUNT(*) AS n FROM notifications WHERE agent_id = ? AND read_at IS NULL", agent.id)!.n;
  const initials = agent.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex flex-1 flex-col">
      <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Logo href="/dashboard" />
          <div className="hidden flex-1 sm:block">
            <AppNav isAdmin={agent.role === "admin"} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/notifications" className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label={`Notifications (${unread} unread)`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <Link href="/settings" className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700" title="Profile & settings">
              {initials}
            </Link>
            <form action={logout}>
              <button className="hidden rounded-lg px-2 py-2 text-sm text-slate-500 hover:bg-slate-100 sm:block">Log out</button>
            </form>
          </div>
        </div>
        <div className="border-t border-slate-100 px-2 py-1.5 sm:hidden">
          <AppNav isAdmin={agent.role === "admin"} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
