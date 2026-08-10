import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Keep the local development toolbar out of screenshots and demos.
  // Production builds never ship the toolbar in the first place.
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
