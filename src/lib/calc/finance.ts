import { usd, pct } from "../format";
import { addMonths, amortize, balanceAfter, monthlyPI, monthYear, yearsMonths } from "./math";
import { num, type Calculator } from "./types";

export const rentVsBuy: Calculator = {
  slug: "rent-vs-buy",
  name: "Rent vs Buy",
  blurb: "The year buying beats renting, including equity, appreciation and selling costs.",
  audience: "buyer",
  popular: true,
  fields: [
    { key: "rent", label: "Current rent (monthly)", kind: "money", default: 2200 },
    { key: "rentIncrease", label: "Rent increase per year", kind: "percent", default: 4 },
    { key: "price", label: "Home price", kind: "money", default: 400000 },
    { key: "downPct", label: "Down payment", kind: "percent", default: 10 },
    { key: "rate", label: "Interest rate", kind: "percent", default: 6.5, step: 0.125 },
    { key: "termYears", label: "Term", kind: "years", default: 30 },
    { key: "taxRate", label: "Property taxes (annual % of price)", kind: "percent", default: 1.2, step: 0.01 },
    { key: "insuranceRate", label: "Insurance (annual % of price)", kind: "percent", default: 0.35, step: 0.01 },
    { key: "hoaMonthly", label: "HOA (monthly)", kind: "money", default: 0 },
    { key: "maintenancePct", label: "Maintenance (annual % of price)", kind: "percent", default: 1 },
    { key: "appreciation", label: "Home appreciation per year", kind: "percent", default: 3 },
    { key: "years", label: "How long they'll stay", kind: "years", default: 7 },
  ],
  title: (v) => `Rent vs buy · ${usd(num(v, "rent"))} rent vs ${usd(num(v, "price"))}`,
  compute(v) {
    const price = num(v, "price");
    const d = num(v, "downPct") / 100;
    const loan = price * (1 - d);
    const rate = num(v, "rate");
    const term = num(v, "termYears") || 30;
    const pi = monthlyPI(loan, rate, term);
    const pmi = d < 0.2 ? (loan * 0.005) / 12 : 0;
    const horizon = Math.max(1, Math.round(num(v, "years")));
    const buyClosing = price * 0.025;
    const sellCostPct = 0.07;

    let rentPaid = 0;
    let ownPaid = price * d + buyClosing;
    let breakEven: number | null = null;
    let atHorizon = { rentCost: 0, ownCost: 0, equity: 0, value: 0 };
    for (let y = 1; y <= Math.max(horizon, 30); y++) {
      rentPaid += num(v, "rent") * 12 * Math.pow(1 + num(v, "rentIncrease") / 100, y - 1);
      const value = price * Math.pow(1 + num(v, "appreciation") / 100, y);
      const yearlyCarry =
        pi * 12 + (y <= 11 ? pmi * 12 : 0) + num(v, "hoaMonthly") * 12 +
        (value * (num(v, "taxRate") + num(v, "insuranceRate") + num(v, "maintenancePct"))) / 100;
      ownPaid += yearlyCarry;
      const bal = balanceAfter(loan, rate, term, y * 12);
      const equityIfSold = value * (1 - sellCostPct) - bal;
      const ownNet = ownPaid - equityIfSold;
      if (breakEven == null && ownNet < rentPaid) breakEven = y;
      if (y === horizon) atHorizon = { rentCost: rentPaid, ownCost: ownNet, equity: equityIfSold, value };
    }
    const diff = atHorizon.rentCost - atHorizon.ownCost;
    const buyWins = diff > 0;
    const firstMonthOwn = pi + pmi + num(v, "hoaMonthly") + (price * (num(v, "taxRate") + num(v, "insuranceRate") + num(v, "maintenancePct"))) / 100 / 12;

    return {
      headline: {
        label: `After ${horizon} years`,
        value: `${buyWins ? "Buying" : "Renting"} saves ${usd(Math.abs(diff))}`,
        sub: breakEven ? `Buying breaks even in year ${breakEven}` : "Buying doesn't break even within 30 years",
      },
      sections: [
        {
          title: `Over ${horizon} years`,
          rows: [
            { label: "Total rent paid", value: usd(atHorizon.rentCost) },
            { label: "Home value at sale", value: usd(atHorizon.value) },
            { label: "Equity after selling costs", value: usd(atHorizon.equity) },
            { label: "Net cost of owning", value: usd(atHorizon.ownCost) },
            { label: buyWins ? "Buying comes out ahead by" : "Renting comes out ahead by", value: usd(Math.abs(diff)), strong: true },
          ],
        },
        {
          title: "Month one",
          rows: [
            { label: "Rent", value: usd(num(v, "rent")) },
            { label: "Owning (incl. maintenance)", value: usd(firstMonthOwn) },
          ],
        },
      ],
      breakdown: [
        breakEven
          ? `Buying starts beating renting in year ${breakEven}. If your client stays ${horizon} years, ${buyWins ? "buying" : "renting"} leaves them about ${usd(Math.abs(diff))} better off.`
          : `At these numbers, renting stays cheaper for 30 years. Try a lower price or a longer stay.`,
        `After ${horizon} years they'd have about ${usd(atHorizon.equity)} in equity after selling costs, versus ${usd(0)} from rent.`,
        `Month one, owning costs about ${usd(firstMonthOwn - num(v, "rent"))} ${firstMonthOwn >= num(v, "rent") ? "more" : "less"} than renting, but rent keeps rising and the mortgage payment doesn't.`,
      ],
    };
  },
};

export const buydown: Calculator = {
  slug: "buydown",
  name: "Points Buydown",
  blurb: "Is paying points worth it? Cost, monthly savings and break-even month.",
  audience: "finance",
  fields: [
    { key: "loanAmount", label: "Loan amount", kind: "money", default: 360000 },
    { key: "rate", label: "Rate without points", kind: "percent", default: 6.5, step: 0.125 },
    { key: "points", label: "Points purchased", kind: "number", default: 1, step: 0.25 },
    { key: "reductionPerPoint", label: "Rate drop per point", kind: "percent", default: 0.25, step: 0.125 },
    { key: "termYears", label: "Term", kind: "years", default: 30 },
    { key: "yearsKept", label: "Years they'll keep the loan", kind: "years", default: 7 },
  ],
  title: (v) => `Buydown · ${num(v, "points")} pts on ${usd(num(v, "loanAmount"))}`,
  compute(v) {
    const loan = num(v, "loanAmount");
    const rate = num(v, "rate");
    const newRate = Math.max(0, rate - num(v, "points") * num(v, "reductionPerPoint"));
    const term = num(v, "termYears") || 30;
    const cost = (loan * num(v, "points")) / 100;
    const before = monthlyPI(loan, rate, term);
    const after = monthlyPI(loan, newRate, term);
    const savings = before - after;
    const beMonths = savings > 0 ? Math.ceil(cost / savings) : Infinity;
    const keptMonths = Math.round(num(v, "yearsKept") * 12);
    const netAtKept = savings * keptMonths - cost;
    return {
      headline: { label: "Break-even", value: Number.isFinite(beMonths) ? yearsMonths(beMonths) : "Never", sub: `${usd(savings)}/mo savings for ${usd(cost)} upfront` },
      sections: [
        {
          title: "Comparison",
          rows: [
            { label: `Payment at ${pct(rate, 3)}`, value: usd(before) },
            { label: `Payment at ${pct(newRate, 3)}`, value: usd(after) },
            { label: "Monthly savings", value: usd(savings), strong: true },
            { label: "Cost of points", value: usd(cost) },
            { label: `Net after ${num(v, "yearsKept")} years`, value: `${netAtKept >= 0 ? "+" : "−"}${usd(Math.abs(netAtKept))}`, strong: true },
          ],
        },
      ],
      breakdown: [
        `Paying ${usd(cost)} for ${num(v, "points")} point${num(v, "points") === 1 ? "" : "s"} drops the rate to ${pct(newRate, 3)} and saves ${usd(savings)}/mo.`,
        Number.isFinite(beMonths)
          ? `It pays for itself after ${yearsMonths(beMonths)}. ${keptMonths >= beMonths ? `If they keep the loan ${num(v, "yearsKept")} years, they come out ${usd(netAtKept)} ahead.` : `If they sell or refinance before then, the points lose money.`}`
          : "The points don't reduce the payment, so they never pay off.",
        "Tip: ask the seller to pay for points as a concession. It often helps more than a price cut.",
      ],
    };
  },
};

export const refi: Calculator = {
  slug: "refi",
  name: "Refinance",
  blurb: "New payment, monthly savings and how long until the refi pays off.",
  audience: "finance",
  fields: [
    { key: "balance", label: "Current loan balance", kind: "money", default: 320000 },
    { key: "currentRate", label: "Current rate", kind: "percent", default: 7.5, step: 0.125 },
    { key: "remainingYears", label: "Years left on current loan", kind: "years", default: 28 },
    { key: "rate", label: "New rate", kind: "percent", default: 6.25, step: 0.125 },
    { key: "newTerm", label: "New term", kind: "years", default: 30 },
    { key: "closingCosts", label: "Refi closing costs", kind: "money", default: 6000 },
  ],
  title: (v) => `Refi · ${pct(num(v, "currentRate"), 3)} → ${pct(num(v, "rate"), 3)}`,
  compute(v) {
    const bal = num(v, "balance");
    const cur = monthlyPI(bal, num(v, "currentRate"), num(v, "remainingYears"));
    const next = monthlyPI(bal, num(v, "rate"), num(v, "newTerm"));
    const savings = cur - next;
    const beMonths = savings > 0 ? Math.ceil(num(v, "closingCosts") / savings) : Infinity;
    const curInterest = amortize(bal, num(v, "currentRate"), num(v, "remainingYears")).interest;
    const newInterest = amortize(bal, num(v, "rate"), num(v, "newTerm")).interest;
    return {
      headline: { label: "Monthly savings", value: usd(savings), sub: Number.isFinite(beMonths) ? `Breaks even in ${yearsMonths(beMonths)}` : "Doesn't break even" },
      sections: [
        {
          title: "Payments",
          rows: [
            { label: "Current payment (P&I)", value: usd(cur) },
            { label: "New payment (P&I)", value: usd(next) },
            { label: "Monthly savings", value: usd(savings), strong: true },
          ],
        },
        {
          title: "Lifetime",
          rows: [
            { label: "Interest left on current loan", value: usd(curInterest) },
            { label: "Interest on new loan", value: usd(newInterest) },
            { label: "Lifetime interest difference", value: `${newInterest <= curInterest ? "−" : "+"}${usd(Math.abs(newInterest - curInterest))}`, strong: true },
          ],
        },
      ],
      breakdown: [
        `Refinancing saves about ${usd(savings)}/mo${Number.isFinite(beMonths) ? ` and covers its ${usd(num(v, "closingCosts"))} cost in ${yearsMonths(beMonths)}` : ""}.`,
        newInterest > curInterest
          ? `Heads up: resetting to a ${num(v, "newTerm")}-year term means paying ${usd(newInterest - curInterest)} more interest over the life of the loan, even though the payment is lower.`
          : `They also save ${usd(curInterest - newInterest)} in total interest.`,
      ],
    };
  },
};

export const extraPayment: Calculator = {
  slug: "extra-payment",
  name: "Extra Payment",
  blurb: "How much interest and time your buyer saves by paying a little extra each month.",
  audience: "finance",
  fields: [
    { key: "loanAmount", label: "Loan amount", kind: "money", default: 360000 },
    { key: "rate", label: "Interest rate", kind: "percent", default: 6.5, step: 0.125 },
    { key: "termYears", label: "Term", kind: "years", default: 30 },
    { key: "extraMonthly", label: "Extra toward principal (monthly)", kind: "money", default: 200 },
  ],
  title: (v) => `Extra payment · ${usd(num(v, "extraMonthly"))}/mo`,
  compute(v) {
    const base = amortize(num(v, "loanAmount"), num(v, "rate"), num(v, "termYears"));
    const extra = amortize(num(v, "loanAmount"), num(v, "rate"), num(v, "termYears"), num(v, "extraMonthly"));
    const saved = base.interest - extra.interest;
    const monthsSaved = base.months - extra.months;
    const now = new Date();
    return {
      headline: { label: "Interest saved", value: usd(saved), sub: `Paid off ${yearsMonths(monthsSaved)} early` },
      sections: [
        {
          title: "Comparison",
          rows: [
            { label: "Regular payment (P&I)", value: usd(base.payment) },
            { label: "With extra", value: usd(base.payment + num(v, "extraMonthly")) },
            { label: "Payoff (regular)", value: monthYear(addMonths(now, base.months)) },
            { label: "Payoff (with extra)", value: monthYear(addMonths(now, extra.months)), strong: true },
            { label: "Total interest (regular)", value: usd(base.interest) },
            { label: "Total interest (with extra)", value: usd(extra.interest) },
            { label: "Interest saved", value: usd(saved), strong: true },
          ],
        },
      ],
      breakdown: [
        `An extra ${usd(num(v, "extraMonthly"))}/mo pays the loan off ${yearsMonths(monthsSaved)} early and saves ${usd(saved)} in interest.`,
        `Every extra dollar they put in saves about ${usd(saved / Math.max(1, num(v, "extraMonthly") * extra.months), true)} in interest.`,
      ],
    };
  },
};
