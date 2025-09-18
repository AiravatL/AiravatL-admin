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
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
