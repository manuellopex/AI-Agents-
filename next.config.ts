import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Static export only for GitHub Pages; dev/production server supports API routes
  // trailingSlash: Pages sirve /game/ desde game/index.html (no game.html)
  ...(isGitHubPages ? { output: "export" as const, trailingSlash: true } : {}),
  basePath: isGitHubPages ? "/AI-Agents-" : "",
  assetPrefix: isGitHubPages ? "/AI-Agents-/" : "",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
