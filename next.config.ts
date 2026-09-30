import type { NextConfig } from "next";

// GitHub Codespaces serves the dev server from <name>-3000.app.github.dev.
// Allow that origin only inside a codespace, never in production.
const codespaceOrigins = process.env.CODESPACES ? ["*.app.github.dev"] : [];

const nextConfig: NextConfig = {
  allowedDevOrigins: codespaceOrigins,
  experimental: {
    serverActions: { allowedOrigins: codespaceOrigins },
  },
};

export default nextConfig;
