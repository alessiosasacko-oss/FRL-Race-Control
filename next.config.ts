import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["discord.js"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
      },
    ],
  },
};

export default nextConfig;
