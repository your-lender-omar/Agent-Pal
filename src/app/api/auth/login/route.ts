import { checkLogin, seeOther } from "@/lib/accounts";
import { startSession } from "@/lib/auth";

// Plain form POST (no Server Actions), so login works behind any proxy, including GitHub Codespaces.
export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const id = checkLogin(email, String(form.get("password") ?? ""));
  if (!id) return seeOther(`/login?error=1&email=${encodeURIComponent(email)}`);
  await startSession(id);
  return seeOther("/dashboard");
}
