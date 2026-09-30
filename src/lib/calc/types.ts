export type FieldKind = "money" | "percent" | "number" | "years" | "select";

export type Field = {
  key: string;
  label: string;
  kind: FieldKind;
  default: number | string;
  options?: { value: string; label: string }[];
  help?: string;
  step?: number;
  /** Only show this field when the predicate passes (e.g. hide down payment for cash). */
  showIf?: (v: Inputs) => boolean;
};

export type Inputs = Record<string, number | string>;

export type Row = { label: string; value: string; strong?: boolean };

export type CalcResult = {
  headline: { label: string; value: string; sub?: string };
  sections: { title: string; rows: Row[] }[];
  /** Plain-English bullets an agent can read to a client as-is. */
  breakdown: string[];
  warnings?: string[];
};

export type Calculator = {
  slug: string;
  name: string;
  blurb: string;
  audience: "buyer" | "seller" | "finance";
  popular?: boolean;
  fields: Field[];
  compute: (v: Inputs) => CalcResult;
  title: (v: Inputs) => string;
};

/** Settings keys an agent can override once in Settings so every calculator starts with their market's numbers. */
export const AGENT_DEFAULT_KEYS = [
  { key: "rate", label: "Interest rate", kind: "percent", fallback: 6.5 },
  { key: "taxRate", label: "Property tax rate (annual, % of price)", kind: "percent", fallback: 1.2 },
  { key: "insuranceRate", label: "Homeowners insurance (annual, % of price)", kind: "percent", fallback: 0.35 },
  { key: "closingCostPct", label: "Buyer closing costs (% of price)", kind: "percent", fallback: 2.5 },
  { key: "listingPct", label: "Listing-side commission", kind: "percent", fallback: 2.5 },
  { key: "buyerAgentPct", label: "Buyer-agent commission", kind: "percent", fallback: 2.5 },
  { key: "titleEscrowPct", label: "Seller title & escrow (% of price)", kind: "percent", fallback: 1 },
  { key: "transferTaxPct", label: "Seller transfer tax (% of price)", kind: "percent", fallback: 0.1 },
] as const;

export type AgentDefaults = Partial<Record<(typeof AGENT_DEFAULT_KEYS)[number]["key"], number>>;

export function num(v: Inputs, key: string): number {
  const n = Number(v[key]);
  return Number.isFinite(n) ? n : 0;
}
