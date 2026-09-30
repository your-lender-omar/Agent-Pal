import { usd, pct } from "../format";
import { num, type Calculator, type Inputs } from "./types";

const costFields = [
  { key: "payoff", label: "Mortgage payoff", kind: "money" as const, default: 0 },
  { key: "listingPct", label: "Listing-side commission", kind: "percent" as const, default: 2.5 },
  { key: "buyerAgentPct", label: "Buyer-agent commission (if seller pays)", kind: "percent" as const, default: 2.5 },
  { key: "titleEscrowPct", label: "Title & escrow (% of price)", kind: "percent" as const, default: 1 },
  { key: "transferTaxPct", label: "Transfer tax (% of price)", kind: "percent" as const, default: 0.1, step: 0.01 },
  { key: "concessions", label: "Seller concessions / credits", kind: "money" as const, default: 0 },
  { key: "repairs", label: "Repairs & prep", kind: "money" as const, default: 0 },
  { key: "otherCosts", label: "Other (prorated taxes, HOA, attorney)", kind: "money" as const, default: 0 },
];

function sellerCosts(v: Inputs, price: number) {
  const commission = (price * (num(v, "listingPct") + num(v, "buyerAgentPct"))) / 100;
  const title = (price * num(v, "titleEscrowPct")) / 100;
  const transfer = (price * num(v, "transferTaxPct")) / 100;
  const fixed = num(v, "concessions") + num(v, "repairs") + num(v, "otherCosts");
  return { commission, title, transfer, fixed, total: commission + title + transfer + fixed };
}

function costRows(v: Inputs, price: number) {
  const c = sellerCosts(v, price);
  return [
    { label: `Commissions (${pct(num(v, "listingPct") + num(v, "buyerAgentPct"))})`, value: `−${usd(c.commission)}` },
    { label: "Title & escrow", value: `−${usd(c.title)}` },
    { label: "Transfer tax", value: `−${usd(c.transfer)}` },
    ...(num(v, "concessions") ? [{ label: "Concessions", value: `−${usd(num(v, "concessions"))}` }] : []),
    ...(num(v, "repairs") ? [{ label: "Repairs & prep", value: `−${usd(num(v, "repairs"))}` }] : []),
    ...(num(v, "otherCosts") ? [{ label: "Other costs", value: `−${usd(num(v, "otherCosts"))}` }] : []),
    { label: "Total selling costs", value: `−${usd(c.total)}`, strong: true },
  ];
}

export const sellerNet: Calculator = {
  slug: "seller-net",
  name: "Seller Net Sheet",
  blurb: "What your seller walks away with after commissions, title, taxes and payoff.",
  audience: "seller",
  popular: true,
  fields: [{ key: "price", label: "Sale price", kind: "money", default: 450000 }, ...costFields],
  title: (v) => `Seller net · ${usd(num(v, "price"))}`,
  compute(v) {
    const price = num(v, "price");
    const c = sellerCosts(v, price);
    const payoff = num(v, "payoff");
    const net = price - c.total - payoff;
    const per10k = 10000 * (1 - (num(v, "listingPct") + num(v, "buyerAgentPct") + num(v, "titleEscrowPct") + num(v, "transferTaxPct")) / 100);
    return {
      headline: { label: "Estimated net proceeds", value: usd(net), sub: `${pct((net / (price || 1)) * 100, 1)} of sale price` },
      sections: [
        { title: "Sale", rows: [{ label: "Sale price", value: usd(price), strong: true }] },
        { title: "Costs", rows: costRows(v, price) },
        {
          title: "Bottom line",
          rows: [
            { label: "Mortgage payoff", value: `−${usd(payoff)}` },
            { label: "Estimated net to seller", value: usd(net), strong: true },
          ],
        },
      ],
      breakdown: [
        `At ${usd(price)}, your seller should walk away with about ${usd(net)}.`,
        `Total selling costs are about ${usd(c.total)} (${pct((c.total / (price || 1)) * 100, 1)} of the price), with commissions the biggest piece at ${usd(c.commission)}.`,
        `Every $10,000 change in sale price changes their net by about ${usd(per10k)}.`,
      ],
      warnings: net < 0 ? ["Net is negative: the seller would need to bring money to closing (short sale territory)."] : [],
    };
  },
};

export const sellToNet: Calculator = {
  slug: "sell-to-net",
  name: "Sell to Net",
  blurb: "Start with the number your seller needs and work backwards to a list price.",
  audience: "seller",
  fields: [{ key: "desiredNet", label: "Seller's desired net", kind: "money", default: 150000 }, ...costFields],
  title: (v) => `Sell to net · ${usd(num(v, "desiredNet"))}`,
  compute(v) {
    const pctSum = (num(v, "listingPct") + num(v, "buyerAgentPct") + num(v, "titleEscrowPct") + num(v, "transferTaxPct")) / 100;
    const fixed = num(v, "concessions") + num(v, "repairs") + num(v, "otherCosts");
    const need = num(v, "desiredNet") + num(v, "payoff") + fixed;
    const price = pctSum < 1 ? need / (1 - pctSum) : 0;
    const listAt = Math.ceil(price / 1000) * 1000;
    return {
      headline: { label: "Minimum sale price", value: usd(listAt), sub: `to net ${usd(num(v, "desiredNet"))}` },
      sections: [
        { title: "Costs at that price", rows: costRows(v, price) },
        {
          title: "Bottom line",
          rows: [
            { label: "Mortgage payoff", value: `−${usd(num(v, "payoff"))}` },
            { label: "Seller nets", value: usd(num(v, "desiredNet")), strong: true },
          ],
        },
      ],
      breakdown: [
        `To put ${usd(num(v, "desiredNet"))} in your seller's pocket, the home needs to sell for at least ${usd(listAt)}.`,
        `Remember, that's the sale price, not the list price. Leave room for negotiation.`,
        `About ${pct(pctSum * 100, 1)} of the price goes to percentage-based costs, plus ${usd(fixed)} in fixed costs.`,
      ],
    };
  },
};
