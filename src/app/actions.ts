"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireAgent } from "@/lib/auth";
import { getCalculator, AGENT_DEFAULT_KEYS, type Inputs } from "@/lib/calc";
import { one, run, type Client } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { broadcast, type Channel } from "@/lib/notify";

export type FormState = { error?: string; ok?: string; values?: Record<string, string> } | undefined;

/** Echo submitted fields (never passwords) so a failed submit doesn't wipe the form. */
function fail(error: string, fd: FormData): FormState {
  const values: Record<string, string> = {};
  fd.forEach((v, k) => {
    if (typeof v === "string" && !k.startsWith("$") && k !== "password") values[k] = v;
  });
  return { error, values };
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const optStr = (fd: FormData, key: string) => str(fd, key) || null;
const optNum = (fd: FormData, key: string) => {
  const s = str(fd, key).replace(/[$,]/g, "");
  return s === "" || !Number.isFinite(Number(s)) ? null : Number(s);
};

// ── Profile & settings ────────────────────────────────────────────────────────

export async function updateProfile(_: FormState, fd: FormData): Promise<FormState> {
  const agent = await requireAgent();
  const name = str(fd, "name");
  const phone = normalizePhone(str(fd, "phone"));
  if (!name) return fail("Name is required.", fd);
  if (!phone) return fail("Please enter a valid 10-digit US cell number.", fd);
  const defaults: Record<string, number> = {};
  for (const d of AGENT_DEFAULT_KEYS) {
    const v = optNum(fd, `default_${d.key}`);
    if (v != null) defaults[d.key] = v;
  }
  run(
    `UPDATE agents SET name = ?, phone = ?, brokerage = ?, license_number = ?, market = ?,
     sms_opt_in = ?, email_opt_in = ?, defaults = ? WHERE id = ?`,
    name, phone, optStr(fd, "brokerage"), optStr(fd, "license_number"), optStr(fd, "market"),
    fd.get("sms_opt_in") ? 1 : 0, fd.get("email_opt_in") ? 1 : 0, JSON.stringify(defaults), agent.id,
  );
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}

// ── Clients ───────────────────────────────────────────────────────────────────

function clientValues(fd: FormData) {
  return [
    str(fd, "name"), optStr(fd, "email"), normalizePhone(str(fd, "phone")) ?? optStr(fd, "phone"),
    str(fd, "kind") || "buyer", str(fd, "stage") || "lead", optNum(fd, "budget"), optNum(fd, "preapproval_amount"),
    optStr(fd, "lender"), optStr(fd, "target_area"), optStr(fd, "property_address"),
    optStr(fd, "closing_date"), optStr(fd, "follow_up_date"), optStr(fd, "notes"),
  ] as const;
}

export async function saveClient(_: FormState, fd: FormData): Promise<FormState> {
  const agent = await requireAgent();
  if (!str(fd, "name")) return { error: "Client name is required." };
  const id = Number(fd.get("id") || 0);
  if (id) {
    const res = run(
      `UPDATE clients SET name = ?, email = ?, phone = ?, kind = ?, stage = ?, budget = ?, preapproval_amount = ?,
       lender = ?, target_area = ?, property_address = ?, closing_date = ?, follow_up_date = ?, notes = ?,
       updated_at = datetime('now') WHERE id = ? AND agent_id = ?`,
      ...clientValues(fd), id, agent.id,
    );
    if (!res.changes) return { error: "Client not found." };
    revalidatePath(`/clients/${id}`);
    redirect(`/clients/${id}`);
  }
  const res = run(
    `INSERT INTO clients (name, email, phone, kind, stage, budget, preapproval_amount, lender, target_area,
     property_address, closing_date, follow_up_date, notes, agent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ...clientValues(fd), agent.id,
  );
  redirect(`/clients/${res.lastInsertRowid}`);
}

export async function setClientStage(clientId: number, stage: string) {
  const agent = await requireAgent();
  run("UPDATE clients SET stage = ?, updated_at = datetime('now') WHERE id = ? AND agent_id = ?", stage, clientId, agent.id);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
}

export async function deleteClient(clientId: number) {
  const agent = await requireAgent();
  run("DELETE FROM clients WHERE id = ? AND agent_id = ?", clientId, agent.id);
  redirect("/clients");
}

// ── Saved breakdowns ──────────────────────────────────────────────────────────

export async function saveCalculation(input: { slug: string; inputs: Inputs; clientId: number | null; title: string }) {
  const agent = await requireAgent();
  const calc = getCalculator(input.slug);
  if (!calc) return { error: "Unknown calculator." };
  if (input.clientId && !one<Client>("SELECT id FROM clients WHERE id = ? AND agent_id = ?", input.clientId, agent.id)) {
    return { error: "Client not found." };
  }
  // Only keep known fields so arbitrary payloads can't be stored.
  const clean: Inputs = {};
  for (const f of calc.fields) {
    const v = input.inputs[f.key];
    clean[f.key] = f.kind === "select" ? String(v ?? f.default) : Number(v ?? f.default) || 0;
  }
  const token = crypto.randomBytes(12).toString("base64url");
  const res = run(
    "INSERT INTO calculations (agent_id, client_id, calc_type, title, inputs, share_token) VALUES (?, ?, ?, ?, ?, ?)",
    agent.id, input.clientId, calc.slug, (input.title || calc.title(clean)).slice(0, 120), JSON.stringify(clean), token,
  );
  if (input.clientId) {
    run("UPDATE clients SET updated_at = datetime('now') WHERE id = ?", input.clientId);
    revalidatePath(`/clients/${input.clientId}`);
  }
  revalidatePath("/dashboard");
  return { id: Number(res.lastInsertRowid), shareToken: token };
}

export async function deleteCalculation(id: number) {
  const agent = await requireAgent();
  const row = one<{ client_id: number | null }>("SELECT client_id FROM calculations WHERE id = ? AND agent_id = ?", id, agent.id);
  run("DELETE FROM calculations WHERE id = ? AND agent_id = ?", id, agent.id);
  if (row?.client_id) revalidatePath(`/clients/${row.client_id}`);
  revalidatePath("/dashboard");
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function markAllRead() {
  const agent = await requireAgent();
  run("UPDATE notifications SET read_at = datetime('now') WHERE agent_id = ? AND read_at IS NULL", agent.id);
  revalidatePath("/", "layout");
}

export async function sendBroadcast(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const title = str(fd, "title");
  const body = str(fd, "body");
  if (!title || !body) return { error: "Title and message are required." };
  const channels = (["in_app", "email", "sms"] as Channel[]).filter((c) => c === "in_app" || fd.get(c));
  const r = await broadcast({
    sentBy: admin.id, title, body, link: optStr(fd, "link") ?? undefined, channels,
    audience: str(fd, "audience") === "admins" ? "admins" : "all",
  });
  revalidatePath("/", "layout");
  return { ok: `Sent to ${r.recipients} agent${r.recipients === 1 ? "" : "s"} in-app${channels.includes("email") ? `, ${r.emailed} by email` : ""}${channels.includes("sms") ? `, ${r.texted} by text` : ""}.` };
}

export async function setAgentRole(agentId: number, role: "agent" | "admin") {
  const admin = await requireAdmin();
  if (agentId === admin.id) return;
  run("UPDATE agents SET role = ? WHERE id = ?", role, agentId);
  revalidatePath("/admin");
}
