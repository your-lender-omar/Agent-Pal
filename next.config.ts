import { execSync } from "node:child_process";
import type { NextConfig } from "next";

// GitHub Codespaces serves the app from https://<name>-3000.app.github.dev while the request reaches
// Next.js as localhost:3000, and after Codespaces' sign-in redirects the browser may send `Origin: null`.
// Next.js would reject every form (login, signup, save) as cross-site in both cases, so allow them.
// This grants nothing to other sites: the session cookie is SameSite=Lax, so a cross-site page can't
// submit forms as a logged-in agent.
const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || "app.github.dev";
const allowedOrigins = [...new Set([`**.${forwardingDomain}`, "**.app.github.dev", "**.github.dev", "null"])];

// Shown on the login page and error page so a screenshot tells us which version is running.
let version = "dev";
try {
  version = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
} catch {}

const nextConfig: NextConfig = {
  allowedDevOrigins: allowedOrigins.filter((o) => o !== "null"),
  experimental: {
    serverActions: { allowedOrigins },
  },
  env: { NEXT_PUBLIC_APP_VERSION: version },
};

export default nextConfig;
