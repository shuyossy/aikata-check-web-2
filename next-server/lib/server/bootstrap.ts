import { getAiTaskBootstrap } from "@/application/aiTask";
import { getLogger } from "./logger";

const logger = getLogger();

let isInitialized = false;

/**
 * サーバ初期化
 * Next.jsのinstrumentation.tsから呼び出される
 */
export async function initializeServer(): Promise<void> {
  if (isInitialized) {
    logger.info("サーバは既に初期化されています");
    return;
  }

  logger.info("サーバを初期化します");

  try {
    // AIタスクブートストラップを初期化
    const aiTaskBootstrap = getAiTaskBootstrap();
    await aiTaskBootstrap.initialize();

    isInitialized = true;
    logger.info("サーバの初期化が完了しました");
  } catch (error) {
    logger.error({ err: error }, "サーバの初期化に失敗しました");
    throw error;
  }
}

/**
 * サーバシャットダウン
 * シグナルハンドラやプロセス終了時に呼び出される
 */
export async function shutdownServer(): Promise<void> {
  if (!isInitialized) {
    return;
  }

  logger.info("サーバをシャットダウンします");

  try {
    // AIタスクブートストラップをシャットダウン
    const aiTaskBootstrap = getAiTaskBootstrap();
    await aiTaskBootstrap.shutdown();

    isInitialized = false;
    logger.info("サーバのシャットダウンが完了しました");
  } catch (error) {
    logger.error({ err: error }, "サーバのシャットダウン中にエラーが発生しました");
    throw error;
  }
}

/**
 * サーバが初期化済みかどうか
 */
export function isServerInitialized(): boolean {
  return isInitialized;
}
