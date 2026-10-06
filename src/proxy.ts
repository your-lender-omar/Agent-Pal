import { NextResponse, type NextRequest } from "next/server";

/**
 * GitHub Codespaces (and other local tunnels) forward requests so the app sees Host: localhost:3000,
 * while the browser's Origin is the public address, `null` after Codespaces' sign-in redirect, or
 * something else again. Next.js's cross-site check for form submissions can't tell that apart from an
 * attack and rejects every login ("Minified React error #441"). Only when the app is reached as
 * localhost, drop the Origin header so that check is skipped. On a real domain (Railway, etc.)
 * nothing changes. The session cookie is SameSite=Lax either way, so other sites still can't post
 * forms as a logged-in agent.
 */
export function proxy(request: NextRequest) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].trim();
  const hostname = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (!isLocal || !request.headers.has("origin")) return NextResponse.next();

  const headers = new Headers(request.headers);
  headers.delete("origin");
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Only form submissions (Server Actions) carry this header.
  matcher: [{ source: "/:path*", has: [{ type: "header", key: "next-action" }] }],
};
