import { createAgent, seeOther } from "@/lib/accounts";
import { startSession } from "@/lib/auth";

// Plain form POST (no Server Actions), so signup works behind any proxy, including GitHub Codespaces.
export async function POST(request: Request) {
  const form = await request.formData();
  const field = (k: string) => String(form.get(k) ?? "");
  const result = createAgent({
    name: field("name"),
    email: field("email"),
    phone: field("phone"),
    password: field("password"),
    brokerage: field("brokerage"),
    market: field("market"),
    smsOptIn: Boolean(form.get("sms_opt_in")),
  });
  if ("error" in result) {
    // Send the visitor back with what they typed (never the password) so the form isn't wiped.
    const back = new URLSearchParams({ error: result.error });
    for (const k of ["name", "email", "phone", "brokerage", "market"]) if (field(k)) back.set(k, field(k));
    if (form.get("sms_opt_in")) back.set("sms_opt_in", "1");
    return seeOther(`/signup?${back}`);
  }
  await startSession(result.id);
  return seeOther("/dashboard");
}
