import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lilithimage.lilithcdn.com", pathname: "/allgames-official-web/rok/**", search: "" },
    ],
  },
  // Keep the local development toolbar out of screenshots and demos.
  // Production builds never ship the toolbar in the first place.
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
