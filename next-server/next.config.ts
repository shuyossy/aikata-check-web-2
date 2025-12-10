import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // @ts-expect-error Turbopack types are not yet included in Next.js types
    turbopack: {
      resolve: {
        external: [
          "thread-stream", // Exclude thread-stream from Turbopack's bundling
          // Add other packages here if needed
        ],
      },
    },
  },
};

export default nextConfig;
