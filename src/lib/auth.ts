import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { one, run, type Agent } from "./db";

export { hashPassword, verifyPassword } from "./password";

const COOKIE = "ap_session";
const SESSION_DAYS = 30;

export async function startSession(agentId: number) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  run("INSERT INTO sessions (token, agent_id, expires_at) VALUES (?, ?, ?)", token, agentId, expires.toISOString());
  run("UPDATE agents SET last_login_at = datetime('now') WHERE id = ?", agentId);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) run("DELETE FROM sessions WHERE token = ?", token);
  store.delete(COOKIE);
}

export async function currentAgent(): Promise<Agent | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const agent = one<Agent>(
    `SELECT a.* FROM sessions s JOIN agents a ON a.id = s.agent_id
     WHERE s.token = ? AND s.expires_at > ?`,
    token,
    new Date().toISOString(),
  );
  return agent ?? null;
}

export async function requireAgent(): Promise<Agent> {
  const agent = await currentAgent();
  if (!agent) redirect("/login");
  return agent;
}

export async function requireAdmin(): Promise<Agent> {
  const agent = await requireAgent();
  if (agent.role !== "admin") redirect("/dashboard");
  return agent;
}
