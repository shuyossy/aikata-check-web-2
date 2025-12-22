/**
 * Next.js Instrumentation
 * サーバ起動時に一度だけ実行される
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // サーバサイドでのみ実行
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initializeServer, shutdownServer } =
      await import("@/lib/server/bootstrap");

    // サーバ初期化
    await initializeServer();

    // シャットダウン時のクリーンアップ
    const handleShutdown = async (signal: string) => {
      console.log(`${signal} signal received. Shutting down gracefully...`);
      try {
        await shutdownServer();
        process.exit(0);
      } catch {
        process.exit(1);
      }
    };

    // シグナルハンドラを登録
    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    process.on("SIGINT", () => handleShutdown("SIGINT"));
  }
}
