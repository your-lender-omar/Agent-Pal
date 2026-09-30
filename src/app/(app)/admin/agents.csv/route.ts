import { currentAgent } from "@/lib/auth";
import { all, type Agent } from "@/lib/db";
import { prettyPhone } from "@/lib/format";

const cell = (v: unknown) => {
  const s = String(v ?? "");
  // Quote everything and neutralize spreadsheet formula injection.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replaceAll('"', '""')}"`;
};

export async function GET() {
  const me = await currentAgent();
  if (me?.role !== "admin") return new Response("Forbidden", { status: 403 });
  const rows = all<Agent>("SELECT * FROM agents ORDER BY created_at");
  const header = ["name", "email", "phone", "brokerage", "license_number", "market", "role", "sms_opt_in", "email_opt_in", "created_at", "last_login_at"];
  const csv = [header.join(","), ...rows.map((r) => header.map((h) => cell(h === "phone" ? prettyPhone(r.phone) : r[h as keyof Agent])).join(","))].join("\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="agents-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
