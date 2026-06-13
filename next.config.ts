import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Uploads pass through Server Actions — allow multi-page receipt scans/PDFs.
    serverActions: {
      bodySizeLimit: "25mb",
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
