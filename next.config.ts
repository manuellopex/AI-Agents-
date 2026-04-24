import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  // GitHub Pages serves from /AI-Agents- subdirectory
  basePath: process.env.GITHUB_PAGES ? "/AI-Agents-" : "",
  assetPrefix: process.env.GITHUB_PAGES ? "/AI-Agents-/" : "",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
