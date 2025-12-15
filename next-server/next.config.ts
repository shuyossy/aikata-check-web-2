import type { NextConfig } from "next";
import { fileUploadConfig } from "./lib/server/fileUploadConfig";

const nextConfig: NextConfig = {
  /* config options here */
  // Instrumentation hook（サーバ起動時の初期化処理）を有効化
  instrumentationHook: true,
  experimental: {
    // Server Actionsのbody size limitを設定（デフォルトは1MB）
    serverActions: {
      bodySizeLimit: `${fileUploadConfig.maxFileSizeMB}mb` as `${number}mb`,
    },
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
  // Webpack設定（unpdf用）
  webpack: (config) => {
    // canvasモジュールを無効化（unpdfで推奨される設定）
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    return config;
  },
};

export default nextConfig;
