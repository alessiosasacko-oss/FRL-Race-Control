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
  // Preview and background/server-action graphics use the same bundled fonts.
  outputFileTracingIncludes: { "/*": ["./assets/graphics/fonts/**/*"] },
  logging: {
    incomingRequests: {
      ignore: [
        /\/api\/auth\/callback\//,
        /\/api\/mobile\/v1\/auth\/discord\/callback/,
      ],
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
