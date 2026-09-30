import { generateReminders } from "@/lib/notify";

/**
 * Hit this once a day (Vercel Cron, GitHub Actions, cron-job.org…) with
 * `Authorization: Bearer $CRON_SECRET` to create closing and follow-up reminders
 * for every agent, even ones who haven't logged in.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json({ created: generateReminders() });
}
