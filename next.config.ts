import type { NextConfig } from "next";

const supabaseHostname = (() => {
  try {
    return process.env.SUPABASE_URL
      ? new URL(process.env.SUPABASE_URL).hostname
      : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  serverExternalPackages: ["discord.js"],
  logging: {
    incomingRequests: {
      ignore: [/\/api\/auth\/callback\//],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
      },
      ...(supabaseHostname
        ? [{
            protocol: "https" as const,
            hostname: supabaseHostname,
            pathname: "/storage/v1/object/public/**",
          }]
        : []),
    ],
  },
};

export default nextConfig;
