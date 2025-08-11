import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { tsconfigPaths: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;