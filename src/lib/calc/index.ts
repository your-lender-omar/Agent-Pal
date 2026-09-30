import { affordability, buyer } from "./buyer";
import { buydown, extraPayment, refi, rentVsBuy } from "./finance";
import { sellerNet, sellToNet } from "./seller";
import type { AgentDefaults, Calculator, Inputs } from "./types";

export const CALCULATORS: Calculator[] = [buyer, sellerNet, affordability, rentVsBuy, sellToNet, buydown, refi, extraPayment];

export function getCalculator(slug: string): Calculator | undefined {
  return CALCULATORS.find((c) => c.slug === slug);
}

/** Field defaults, overridden by the agent's saved market defaults, then by any explicit inputs. */
export function initialInputs(calc: Calculator, agentDefaults: AgentDefaults = {}, overrides: Inputs = {}): Inputs {
  const out: Inputs = {};
  for (const f of calc.fields) {
    const agentValue = agentDefaults[f.key as keyof AgentDefaults];
    out[f.key] = overrides[f.key] ?? agentValue ?? f.default;
  }
  return out;
}

export * from "./types";
