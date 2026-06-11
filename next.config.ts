import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow ID-photo uploads (passed through a Server Action) up to 8 MB.
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
