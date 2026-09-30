/** Monthly principal & interest payment. rate is an annual percent (6.5 = 6.5%). */
export function monthlyPI(principal: number, ratePct: number, years: number): number {
  const n = Math.round(years * 12);
  if (principal <= 0 || n <= 0) return 0;
  const r = ratePct / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

/** Loan balance remaining after `months` payments. */
export function balanceAfter(principal: number, ratePct: number, years: number, months: number): number {
  const r = ratePct / 100 / 12;
  const pmt = monthlyPI(principal, ratePct, years);
  if (r === 0) return Math.max(0, principal - pmt * months);
  const grown = principal * Math.pow(1 + r, months);
  return Math.max(0, grown - pmt * ((Math.pow(1 + r, months) - 1) / r));
}

export function amortize(principal: number, ratePct: number, years: number, extraMonthly = 0) {
  const r = ratePct / 100 / 12;
  const pmt = monthlyPI(principal, ratePct, years);
  let balance = principal;
  let months = 0;
  let interest = 0;
  const cap = Math.round(years * 12) + 1;
  while (balance > 0.005 && months < cap) {
    const i = balance * r;
    interest += i;
    balance = balance + i - Math.min(balance + i, pmt + extraMonthly);
    months++;
  }
  return { payment: pmt, months, interest };
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function monthYear(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function yearsMonths(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y} yr${y === 1 ? "" : "s"}` : "", m ? `${m} mo` : ""].filter(Boolean).join(" ") || "0 mo";
}
