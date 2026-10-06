import type { NextConfig } from "next";

// GitHub Codespaces serves the dev server from https://<name>-3000.<domain> (usually app.github.dev),
// while the request reaches Next.js as localhost:3000. Without these entries Next.js rejects every
// form submit (login, signup, save) as a cross-site request. Only applied in a codespace or in dev.
const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || "app.github.dev";
const trustCodespaces = Boolean(process.env.CODESPACES) || process.env.NODE_ENV !== "production";
const codespaceOrigins = trustCodespaces ? [`**.${forwardingDomain}`, "**.app.github.dev", "**.github.dev"] : [];

const nextConfig: NextConfig = {
  allowedDevOrigins: codespaceOrigins,
  experimental: {
    serverActions: { allowedOrigins: codespaceOrigins },
  },
};

export default nextConfig;
