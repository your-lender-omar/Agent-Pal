import "server-only";
import { all, one, run, type Agent } from "./db";

/**
 * Notification fan-out. In-app always works. Email and SMS switch on when their
 * provider keys are present in the environment (see .env.example), so the app runs
 * with zero setup and gets louder once you connect Resend / Twilio.
 */

export type Channel = "in_app" | "email" | "sms";

export const channelStatus = {
  email: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
  sms: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
};

export function notifyInApp(agentId: number, n: { title: string; body: string; link?: string; kind?: string; dedupeKey?: string }) {
  // dedupe_key + UNIQUE constraint makes scheduled reminders safe to run repeatedly.
  run(
    `INSERT OR IGNORE INTO notifications (agent_id, title, body, link, kind, dedupe_key) VALUES (?, ?, ?, ?, ?, ?)`,
    agentId, n.title, n.body, n.link ?? null, n.kind ?? "info", n.dedupeKey ?? null,
  );
}

async function sendEmail(to: string, subject: string, text: string) {
  if (!channelStatus.email) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
  });
  return res.ok;
}

async function sendSms(to: string, body: string) {
  if (!channelStatus.sms) return false;
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM_NUMBER!, Body: body }),
  });
  return res.ok;
}

export async function broadcast(opts: { sentBy: number; title: string; body: string; link?: string; channels: Channel[]; audience: "all" | "admins" }) {
  const agents = all<Agent>(opts.audience === "admins" ? "SELECT * FROM agents WHERE role = 'admin'" : "SELECT * FROM agents");
  let emailed = 0;
  let texted = 0;
  for (const a of agents) {
    notifyInApp(a.id, { title: opts.title, body: opts.body, link: opts.link, kind: "announcement" });
    if (opts.channels.includes("email") && a.email_opt_in && (await sendEmail(a.email, opts.title, `${opts.body}${opts.link ? `\n\n${opts.link}` : ""}`))) emailed++;
    // SMS only to agents who explicitly opted in (TCPA). Always include opt-out language.
    if (opts.channels.includes("sms") && a.sms_opt_in && (await sendSms(a.phone, `${opts.title}: ${opts.body} Reply STOP to opt out.`))) texted++;
  }
  run(
    "INSERT INTO broadcasts (sent_by, title, body, channels, recipients) VALUES (?, ?, ?, ?, ?)",
    opts.sentBy, opts.title, opts.body, opts.channels.join(","), agents.length,
  );
  return { recipients: agents.length, emailed, texted };
}

/** Deal reminders: closings in 7/3/1 days and follow-ups due today. Idempotent via dedupe keys. */
export function generateReminders(agentId?: number) {
  type Row = { id: number; agent_id: number; name: string; closing_date: string | null; follow_up_date: string | null };
  const today = new Date().toISOString().slice(0, 10);
  const rows = all<Row>(
    `SELECT id, agent_id, name, closing_date, follow_up_date FROM clients
     WHERE stage NOT IN ('closed', 'lost') ${agentId ? "AND agent_id = ?" : ""}`,
    ...(agentId ? [agentId] : []),
  );
  let created = 0;
  const before = one<{ n: number }>("SELECT COUNT(*) AS n FROM notifications")!.n;
  for (const c of rows) {
    if (c.closing_date) {
      const days = Math.round((Date.parse(c.closing_date) - Date.parse(today)) / 86400_000);
      if ([7, 3, 1, 0].includes(days)) {
        notifyInApp(c.agent_id, {
          title: days === 0 ? `${c.name} closes today` : `${c.name} closes in ${days} day${days === 1 ? "" : "s"}`,
          body: days === 0 ? "Big day. Confirm keys, final walkthrough, and wire instructions." : "Check CD delivery, final walkthrough, and utilities transfer.",
          link: `/clients/${c.id}`,
          kind: "closing",
          dedupeKey: `closing:${c.id}:${c.closing_date}:${days}`,
        });
      }
    }
    if (c.follow_up_date && c.follow_up_date <= today) {
      notifyInApp(c.agent_id, {
        title: `Follow up with ${c.name}`,
        body: "You set a follow-up reminder for today.",
        link: `/clients/${c.id}`,
        kind: "follow_up",
        dedupeKey: `followup:${c.id}:${c.follow_up_date}`,
      });
    }
  }
  created = one<{ n: number }>("SELECT COUNT(*) AS n FROM notifications")!.n - before;
  return created;
}
