import Link from "next/link";
import { markAllRead } from "@/app/actions";
import { Badge, Card, Empty, PageHeader, buttonClass } from "@/components/ui";
import { requireAgent } from "@/lib/auth";
import { all, type Notification } from "@/lib/db";
import { shortDate } from "@/lib/format";

export const metadata = { title: "Notifications" };

const KIND: Record<string, { label: string; tone: "blue" | "amber" | "green" | "slate" }> = {
  closing: { label: "Closing", tone: "amber" },
  follow_up: { label: "Follow-up", tone: "blue" },
  announcement: { label: "Announcement", tone: "green" },
  welcome: { label: "Welcome", tone: "blue" },
};

export default async function NotificationsPage() {
  const agent = await requireAgent();
  const items = all<Notification>("SELECT * FROM notifications WHERE agent_id = ? ORDER BY created_at DESC, id DESC LIMIT 100", agent.id);
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        sub={unread ? `${unread} unread` : "You're all caught up."}
        action={unread > 0 && <form action={markAllRead}><button className={buttonClass("secondary", "sm")}>Mark all read</button></form>}
      />
      {items.length === 0 ? (
        <Empty title="Nothing yet">Closing reminders, follow-ups and team announcements show up here.</Empty>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {items.map((n) => {
              const k = KIND[n.kind] ?? { label: "Update", tone: "slate" as const };
              const body = (
                <div className={`flex gap-3 px-4 py-3 ${n.read_at ? "" : "bg-brand-50/50"}`}>
                  <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-brand-500"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{n.title}</span>
                      <Badge tone={k.tone}>{k.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>
                    <p className="mt-1 text-xs text-slate-400">{shortDate(n.created_at)}</p>
                  </div>
                </div>
              );
              return <li key={n.id}>{n.link ? <Link href={n.link} className="block hover:bg-slate-50">{body}</Link> : body}</li>;
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
