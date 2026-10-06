import { seeOther } from "@/lib/accounts";
import { endSession } from "@/lib/auth";

export async function POST() {
  await endSession();
  return seeOther("/");
}
