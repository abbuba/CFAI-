import type { NextConfig } from "next";

const repoBasePath = "/CFAI-";
const useGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: useGitHubPages ? "export" : undefined,
  basePath: useGitHubPages ? repoBasePath : "",
  assetPrefix: useGitHubPages ? repoBasePath : undefined,
  trailingSlash: useGitHubPages,
  images: {
    unoptimized: useGitHubPages,
  },
};

export default nextConfig;
