import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removed output: 'export' to enable dynamic routes and server features
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  images: {
    unoptimized: true
  },
  // Remove assetPrefix and basePath for most hosting platforms
  // assetPrefix: process.env.NODE_ENV === 'production' ? '/AiravatL-admin' : '',
  // basePath: process.env.NODE_ENV === 'production' ? '/AiravatL-admin' : '',
  // Note: ESLint config moved out of next.config.ts in Next.js 16
  // Configure ESLint in .eslintrc.json or eslint.config.js instead
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
