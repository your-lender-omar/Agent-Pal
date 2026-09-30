import { usd, pct } from "../format";
import { monthlyPI } from "./math";
import { num, type Calculator, type Inputs } from "./types";

const LOAN_TYPES = [
  { value: "conventional", label: "Conventional" },
  { value: "fha", label: "FHA" },
  { value: "va", label: "VA" },
  { value: "cash", label: "Cash" },
];

const loanLabel = (value: string) => LOAN_TYPES.find((l) => l.value === value)?.label ?? value;

/** Max seller concession as a % of price, by loan program and down payment. */
export function concessionLimitPct(loanType: string, downPct: number): number | null {
  if (loanType === "cash") return null;
  if (loanType === "fha") return 6;
  if (loanType === "va") return 4;
  if (downPct < 10) return 3;
  if (downPct <= 25) return 6;
  return 9;
}

type LoanCosts = {
  baseLoan: number;
  loan: number;
  upfrontFee: number;
  upfrontFeeLabel: string;
  monthlyMI: number;
  miLabel: string;
};

function loanCosts(loanType: string, price: number, downPct: number, pmiRate: number): LoanCosts {
  const baseLoan = loanType === "cash" ? 0 : price * (1 - downPct / 100);
  if (loanType === "fha") {
    const upfrontFee = baseLoan * 0.0175;
    const loan = baseLoan + upfrontFee;
    return { baseLoan, loan, upfrontFee, upfrontFeeLabel: "FHA upfront MIP (1.75%, financed)", monthlyMI: (loan * 0.0055) / 12, miLabel: "FHA mortgage insurance" };
  }
  if (loanType === "va") {
    const feePct = downPct >= 10 ? 1.25 : downPct >= 5 ? 1.5 : 2.15;
    const upfrontFee = baseLoan * (feePct / 100);
    return { baseLoan, loan: baseLoan + upfrontFee, upfrontFee, upfrontFeeLabel: `VA funding fee (${feePct}%, financed)`, monthlyMI: 0, miLabel: "" };
  }
  const monthlyMI = loanType === "conventional" && downPct < 20 ? (baseLoan * (pmiRate / 100)) / 12 : 0;
  return { baseLoan, loan: baseLoan, upfrontFee: 0, upfrontFeeLabel: "", monthlyMI, miLabel: "PMI" };
}

export const buyer: Calculator = {
  slug: "buyer",
  name: "Buyer Breakdown",
  blurb: "Monthly payment + cash to close in one screen. The one you'll use every day.",
  audience: "buyer",
  popular: true,
  fields: [
    { key: "price", label: "Home price", kind: "money", default: 400000 },
    { key: "loanType", label: "Loan type", kind: "select", default: "conventional", options: LOAN_TYPES },
    { key: "downPct", label: "Down payment", kind: "percent", default: 10, showIf: (v) => v.loanType !== "cash" },
    { key: "rate", label: "Interest rate", kind: "percent", default: 6.5, step: 0.125, showIf: (v) => v.loanType !== "cash" },
    { key: "termYears", label: "Term", kind: "years", default: 30, showIf: (v) => v.loanType !== "cash" },
    { key: "taxRate", label: "Property taxes (annual % of price)", kind: "percent", default: 1.2, step: 0.01 },
    { key: "insuranceRate", label: "Homeowners insurance (annual % of price)", kind: "percent", default: 0.35, step: 0.01 },
    { key: "hoaMonthly", label: "HOA (monthly)", kind: "money", default: 0 },
    { key: "pmiRate", label: "PMI rate (annual %)", kind: "percent", default: 0.5, help: "Only applies to conventional loans under 20% down.", showIf: (v) => v.loanType === "conventional" && num(v, "downPct") < 20 },
    { key: "closingCostPct", label: "Closing costs (% of price)", kind: "percent", default: 2.5, help: "Lender, title, escrow, and prepaids." },
    { key: "brokerFeePct", label: "Buyer broker fee", kind: "percent", default: 0, help: "Leave 0 if the seller is covering it." },
    { key: "sellerConcession", label: "Seller concession / credit", kind: "money", default: 0 },
  ],
  title: (v) => `Buyer · ${usd(num(v, "price"))} ${loanLabel(String(v.loanType))}`,
  compute(v: Inputs) {
    const price = num(v, "price");
    const loanType = String(v.loanType);
    const isCash = loanType === "cash";
    const downPct = isCash ? 100 : num(v, "downPct");
    const rate = num(v, "rate");
    const term = num(v, "termYears") || 30;

    const lc = loanCosts(loanType, price, downPct, num(v, "pmiRate"));
    const down = price - lc.baseLoan;
    const pi = isCash ? 0 : monthlyPI(lc.loan, rate, term);
    const tax = (price * num(v, "taxRate")) / 100 / 12;
    const ins = (price * num(v, "insuranceRate")) / 100 / 12;
    const hoa = num(v, "hoaMonthly");
    const monthly = pi + tax + ins + lc.monthlyMI + hoa;

    const closing = (price * num(v, "closingCostPct")) / 100;
    const brokerFee = (price * num(v, "brokerFeePct")) / 100;
    const requestedCredit = num(v, "sellerConcession");
    const limitPct = concessionLimitPct(loanType, downPct);
    const limit = limitPct == null ? Infinity : (price * limitPct) / 100;
    // Credits can't exceed the program cap or the buyer's actual closing costs.
    const credit = Math.min(requestedCredit, limit, closing + brokerFee);
    const cashToClose = down + closing + brokerFee - credit;

    const warnings: string[] = [];
    if (requestedCredit > credit) {
      warnings.push(
        limit < closing + brokerFee
          ? `${loanLabel(loanType)} caps seller concessions at ${limitPct}% (${usd(limit)}) with ${pct(downPct)} down. Only ${usd(credit)} of the credit counts.`
          : `Seller credit can't exceed the buyer's closing costs (${usd(closing + brokerFee)}). Only ${usd(credit)} counts. Consider a price reduction for the rest.`,
      );
    }
    if (loanType === "fha" && downPct < 3.5) warnings.push("FHA requires at least 3.5% down.");
    if (loanType === "conventional" && downPct < 3) warnings.push("Conventional loans generally require at least 3% down.");

    const breakdown = [
      isCash
        ? `Paying cash, your client needs about ${usd(cashToClose)} at closing, then roughly ${usd(monthly)}/mo for taxes, insurance${hoa ? " and HOA" : ""}.`
        : `All-in monthly payment is about ${usd(monthly)}. ${usd(pi)} goes to the loan, ${usd(tax + ins)} to taxes and insurance${lc.monthlyMI ? `, and ${usd(lc.monthlyMI)} to mortgage insurance` : ""}${hoa ? `, and ${usd(hoa)} to HOA` : ""}.`,
      `Cash to close is about ${usd(cashToClose)}: ${usd(down)} down plus ${usd(closing + brokerFee)} in costs${credit ? `, minus a ${usd(credit)} seller credit` : ""}.`,
    ];
    if (lc.monthlyMI && loanType === "conventional") {
      breakdown.push(`PMI drops off once they reach 20% equity. Putting 20% down (${usd(price * 0.2)}) would remove it today.`);
    }
    if (!isCash) {
      const perEighth = monthlyPI(lc.loan, rate + 0.125, term) - pi;
      breakdown.push(`Every 1/8% change in rate moves the payment by about ${usd(perEighth)}/mo.`);
    }
    if (limitPct != null && credit < limit) {
      breakdown.push(`There's still room to ask for up to ${usd(Math.min(limit, closing + brokerFee) - credit)} more in seller credits under this loan program.`);
    }

    return {
      headline: { label: isCash ? "Cash to close" : "Monthly payment", value: usd(isCash ? cashToClose : monthly), sub: isCash ? `${usd(monthly)}/mo carrying cost` : `${usd(cashToClose)} cash to close` },
      sections: [
        {
          title: "Monthly",
          rows: [
            ...(isCash ? [] : [{ label: `Principal & interest (${pct(rate, 3)}, ${term} yr)`, value: usd(pi) }]),
            { label: "Property taxes", value: usd(tax) },
            { label: "Homeowners insurance", value: usd(ins) },
            ...(lc.monthlyMI ? [{ label: lc.miLabel, value: usd(lc.monthlyMI) }] : []),
            ...(hoa ? [{ label: "HOA", value: usd(hoa) }] : []),
            { label: "Total monthly", value: usd(monthly), strong: true },
          ],
        },
        {
          title: "Cash to close",
          rows: [
            { label: `Down payment (${pct(downPct)})`, value: usd(down) },
            { label: "Closing costs", value: usd(closing) },
            ...(brokerFee ? [{ label: "Buyer broker fee", value: usd(brokerFee) }] : []),
            ...(credit ? [{ label: "Seller credit", value: `−${usd(credit)}` }] : []),
            { label: "Estimated cash to close", value: usd(cashToClose), strong: true },
          ],
        },
        ...(isCash
          ? []
          : [
              {
                title: "Loan",
                rows: [
                  { label: "Base loan amount", value: usd(lc.baseLoan) },
                  ...(lc.upfrontFee ? [{ label: lc.upfrontFeeLabel, value: usd(lc.upfrontFee) }] : []),
                  { label: "Total loan amount", value: usd(lc.loan), strong: true },
                  ...(limitPct != null ? [{ label: "Max seller concession", value: `${limitPct}% · ${usd(limit)}` }] : []),
                ],
              },
            ]),
      ],
      breakdown,
      warnings,
    };
  },
};

export const affordability: Calculator = {
  slug: "affordability",
  name: "What Can I Afford?",
  blurb: "Turn a comfortable monthly payment (or income) into a max purchase price.",
  audience: "buyer",
  popular: true,
  fields: [
    { key: "monthlyBudget", label: "Comfortable monthly payment", kind: "money", default: 3000, help: "All-in: loan, taxes, insurance, PMI, HOA." },
    { key: "annualIncome", label: "Household income (annual, optional)", kind: "money", default: 0 },
    { key: "monthlyDebts", label: "Other monthly debts (car, cards, loans)", kind: "money", default: 0, showIf: (v) => num(v, "annualIncome") > 0 },
    { key: "dti", label: "Max debt-to-income", kind: "percent", default: 43, showIf: (v) => num(v, "annualIncome") > 0 },
    { key: "downPct", label: "Down payment", kind: "percent", default: 10 },
    { key: "rate", label: "Interest rate", kind: "percent", default: 6.5, step: 0.125 },
    { key: "termYears", label: "Term", kind: "years", default: 30 },
    { key: "taxRate", label: "Property taxes (annual % of price)", kind: "percent", default: 1.2, step: 0.01 },
    { key: "insuranceRate", label: "Homeowners insurance (annual % of price)", kind: "percent", default: 0.35, step: 0.01 },
    { key: "hoaMonthly", label: "Expected HOA (monthly)", kind: "money", default: 0 },
    { key: "pmiRate", label: "PMI rate (annual %)", kind: "percent", default: 0.5, showIf: (v) => num(v, "downPct") < 20 },
  ],
  title: (v) => `Affordability · ${usd(num(v, "monthlyBudget"))}/mo`,
  compute(v) {
    const d = num(v, "downPct") / 100;
    const rate = num(v, "rate");
    const term = num(v, "termYears") || 30;
    const hoa = num(v, "hoaMonthly");
    // Monthly cost is linear in price, so solve directly: payment = price × coef + HOA.
    const piPerDollar = monthlyPI(1, rate, term) * (1 - d);
    const coef = piPerDollar + num(v, "taxRate") / 100 / 12 + num(v, "insuranceRate") / 100 / 12 + (d < 0.2 ? ((1 - d) * num(v, "pmiRate")) / 100 / 12 : 0);

    const budget = num(v, "monthlyBudget");
    const income = num(v, "annualIncome");
    const incomeCap = income > 0 ? (income / 12) * (num(v, "dti") / 100) - num(v, "monthlyDebts") : Infinity;
    const payment = Math.max(0, Math.min(budget, incomeCap));
    const price = coef > 0 ? Math.max(0, (payment - hoa) / coef) : 0;
    const limitedByIncome = incomeCap < budget;

    const down = price * d;
    const loan = price - down;
    const bumpPrice = coef > 0 ? 100 / coef : 0;

    return {
      headline: { label: "Max purchase price", value: usd(Math.floor(price / 1000) * 1000), sub: `at ${usd(payment)}/mo all-in` },
      sections: [
        {
          title: "At that price",
          rows: [
            { label: `Down payment (${pct(d * 100)})`, value: usd(down) },
            { label: "Loan amount", value: usd(loan) },
            { label: "Principal & interest", value: usd(monthlyPI(loan, rate, term)) },
            { label: "Taxes + insurance", value: usd((price * (num(v, "taxRate") + num(v, "insuranceRate"))) / 100 / 12) },
            ...(d < 0.2 ? [{ label: "PMI", value: usd((loan * num(v, "pmiRate")) / 100 / 12) }] : []),
            ...(hoa ? [{ label: "HOA", value: usd(hoa) }] : []),
            { label: "Total monthly", value: usd(payment), strong: true },
          ],
        },
        ...(income > 0
          ? [
              {
                title: "Income check",
                rows: [
                  { label: "Gross monthly income", value: usd(income / 12) },
                  { label: `Max housing payment at ${pct(num(v, "dti"))} DTI`, value: usd(Math.max(0, incomeCap)) },
                  { label: "Limited by", value: limitedByIncome ? "Income / DTI" : "Comfort budget", strong: true },
                ],
              },
            ]
          : []),
      ],
      breakdown: [
        `With ${usd(payment)}/mo all-in and ${pct(d * 100)} down, your client can shop up to about ${usd(Math.floor(price / 1000) * 1000)}.`,
        `They'll need about ${usd(down)} for the down payment, plus closing costs.`,
        `Every extra $100/mo in budget adds roughly ${usd(bumpPrice)} of buying power.`,
        ...(limitedByIncome ? [`Their income, not their comfort budget, is the limiting factor. Paying down ${usd(budget - incomeCap)}/mo of other debt would unlock their full budget.`] : []),
      ],
      warnings: payment <= hoa ? ["The budget doesn't cover the HOA. Increase the budget or lower the HOA."] : [],
    };
  },
};
