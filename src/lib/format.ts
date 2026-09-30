export const usd = (n: number, cents = false) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents ? 2 : 0,
    minimumFractionDigits: cents ? 2 : 0,
  }).format(Number.isFinite(n) ? n : 0);

export const pct = (n: number, digits = 2) => {
  const s = (Number.isFinite(n) ? n : 0).toFixed(digits);
  return `${s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s}%`;
};

/** Normalizes US numbers to E.164 (+15551234567); returns null if it can't. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function prettyPhone(e164: string | null): string {
  if (!e164) return "";
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

export function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${isoDate}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86400_000);
}

export function shortDate(isoDate: string | null): string {
  if (!isoDate) return "—";
  const d = new Date(isoDate.length === 10 ? `${isoDate}T00:00:00` : isoDate.replace(" ", "T") + (isoDate.includes("Z") ? "" : "Z"));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
