import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sql.js"],
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
