import type { NextConfig } from "next";

// GitHub Codespaces serves the app from https://<name>-3000.app.github.dev while the request reaches
// Next.js as localhost:3000, so Next.js would reject every form (login, signup, save) as cross-site.
// Allowing these origins is always on: it doesn't depend on detecting a codespace (which failed in
// practice), and it grants nothing in production because the session cookie is SameSite=Lax, so a
// cross-site page can't submit forms as a logged-in agent.
const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || "app.github.dev";
const codespaceOrigins = [...new Set([`**.${forwardingDomain}`, "**.app.github.dev", "**.github.dev"])];

const nextConfig: NextConfig = {
  allowedDevOrigins: codespaceOrigins,
  experimental: {
    serverActions: { allowedOrigins: codespaceOrigins },
  },
};

export default nextConfig;
