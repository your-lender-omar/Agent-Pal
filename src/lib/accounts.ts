import "server-only";
import { BUILT_IN_ADMIN } from "./admin-config";
import { hashPassword, verifyPassword } from "./password";
import { one, run, syncAdminLogin } from "./db";
import { normalizePhone } from "./format";
import { notifyInApp } from "./notify";

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/** Returns the agent id on success, or null if the email/password don't match. */
export function checkLogin(rawEmail: string, password: string): number | null {
  const email = rawEmail.trim().toLowerCase();
  syncAdminLogin(email, password);
  const row = one<{ id: number; password_hash: string }>("SELECT id, password_hash FROM agents WHERE email = ?", email);
  return row && verifyPassword(password, row.password_hash) ? row.id : null;
}

export type SignupInput = {
  name: string;
  email: string;
  phone: string;
  password: string;
  brokerage?: string;
  market?: string;
  smsOptIn: boolean;
};

export function createAgent(input: SignupInput): { id: number } | { error: string } {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = normalizePhone(input.phone);
  if (!name) return { error: "Please enter your name." };
  if (!isEmail(email)) return { error: "Please enter a valid email." };
  if (!phone) return { error: "Please enter a valid 10-digit US cell number." };
  if (input.password.length < 8) return { error: "Password must be at least 8 characters." };
  if (one("SELECT id FROM agents WHERE email = ?", email)) return { error: "An account with that email already exists. Try logging in." };

  // With an admin login configured, signups are always agents. Otherwise the very first account is the admin.
  const isFirst = !process.env.ADMIN_EMAIL && !BUILT_IN_ADMIN && !one("SELECT id FROM agents LIMIT 1");
  const res = run(
    `INSERT INTO agents (name, email, phone, brokerage, market, password_hash, role, sms_opt_in, email_opt_in)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    name, email, phone, input.brokerage?.trim() || null, input.market?.trim() || null,
    hashPassword(input.password), isFirst ? "admin" : "agent", input.smsOptIn ? 1 : 0,
  );
  const id = Number(res.lastInsertRowid);
  notifyInApp(id, {
    title: `Welcome, ${name.split(" ")[0]}!`,
    body: "Add your first client, then run a Buyer Breakdown. You can save it to their profile and text them a link.",
    link: "/clients/new",
    kind: "welcome",
  });
  return { id };
}

/**
 * Redirect with a relative Location so it works behind any proxy or tunnel (Codespaces sees the app as
 * localhost, so an absolute URL built from the request would point the browser at the wrong place).
 */
export function seeOther(location: string) {
  return new Response(null, { status: 303, headers: { Location: location } });
}
