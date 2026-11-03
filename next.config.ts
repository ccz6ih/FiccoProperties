import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // nodemailer opens real TCP sockets, so it has to run as a native Node
  // require rather than be bundled into the server build. It isn't on Next's
  // auto-externalised list, so it's named here.
  serverExternalPackages: ["nodemailer"],
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
