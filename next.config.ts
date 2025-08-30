import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removed output: 'export' to fix dynamic routes
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  images: {
    unoptimized: true
  },
  assetPrefix: process.env.NODE_ENV === 'production' ? '/AiravatL-admin' : '',
  basePath: process.env.NODE_ENV === 'production' ? '/AiravatL-admin' : '',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
