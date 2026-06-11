import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow ID-photo uploads (passed through a Server Action) up to 8 MB.
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  // Forward the old brand domain to the new one (permanent 308), preserving path.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "ficcoproperties.com" }],
        destination: "https://38thaveproperties.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.ficcoproperties.com" }],
        destination: "https://38thaveproperties.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
