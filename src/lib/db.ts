import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

// Single SQLite file for local/dev and small deployments. Swap for Postgres when
// you outgrow one server (see README → "Going to production").
const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "agentpal.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT NOT NULL,
  brokerage TEXT,
  license_number TEXT,
  market TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent',
  sms_opt_in INTEGER NOT NULL DEFAULT 0,
  email_opt_in INTEGER NOT NULL DEFAULT 1,
  defaults TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  kind TEXT NOT NULL DEFAULT 'buyer',
  stage TEXT NOT NULL DEFAULT 'lead',
  budget REAL,
  preapproval_amount REAL,
  lender TEXT,
  target_area TEXT,
  property_address TEXT,
  closing_date TEXT,
  follow_up_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS clients_agent ON clients(agent_id);
CREATE TABLE IF NOT EXISTS calculations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  calc_type TEXT NOT NULL,
  title TEXT NOT NULL,
  inputs TEXT NOT NULL,
  share_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS calculations_agent ON calculations(agent_id);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  kind TEXT NOT NULL DEFAULT 'info',
  dedupe_key TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(agent_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS notifications_agent ON notifications(agent_id, read_at);
CREATE TABLE IF NOT EXISTS broadcasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sent_by INTEGER NOT NULL REFERENCES agents(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  channels TEXT NOT NULL,
  recipients INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

const globalForDb = globalThis as unknown as { agentPalDb?: DatabaseSync };

function open(): DatabaseSync {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  // Wait instead of failing when another process (build worker, second instance) holds the lock.
  db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  return db;
}

export const db: DatabaseSync = globalForDb.agentPalDb ?? open();
if (process.env.NODE_ENV !== "production") globalForDb.agentPalDb = db;

export type Agent = {
  id: number;
  name: string;
  email: string;
  phone: string;
  brokerage: string | null;
  license_number: string | null;
  market: string | null;
  role: "agent" | "admin";
  sms_opt_in: number;
  email_opt_in: number;
  defaults: string;
  created_at: string;
  last_login_at: string | null;
};

export type Client = {
  id: number;
  agent_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  kind: "buyer" | "seller" | "both";
  stage: string;
  budget: number | null;
  preapproval_amount: number | null;
  lender: string | null;
  target_area: string | null;
  property_address: string | null;
  closing_date: string | null;
  follow_up_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Calculation = {
  id: number;
  agent_id: number;
  client_id: number | null;
  calc_type: string;
  title: string;
  inputs: string;
  share_token: string;
  created_at: string;
};

export type Notification = {
  id: number;
  agent_id: number;
  title: string;
  body: string;
  link: string | null;
  kind: string;
  read_at: string | null;
  created_at: string;
};

export function one<T>(sql: string, ...params: (string | number | null)[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function all<T>(sql: string, ...params: (string | number | null)[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function run(sql: string, ...params: (string | number | null)[]) {
  return db.prepare(sql).run(...params);
}
