import * as fs from "fs/promises";
import * as path from "path";
import { getLogger } from "./logger";

const logger = getLogger();

/**
 * レビューキャッシュの保存先ディレクトリを取得する
 * 環境変数REVIEW_CACHE_DIRが設定されていればそれを使用、なければデフォルト値
 */
const getCacheBaseDir = (): string => {
  return process.env.REVIEW_CACHE_DIR || "./review_cache";
};

/**
 * レビュードキュメントキャッシュを管理するヘルパークラス
 * リトライ時にドキュメントの再処理を省略するために使用
 */
export class ReviewCacheHelper {
  /**
   * キャッシュベースディレクトリを取得する
   */
  static getCacheBaseDir(): string {
    return getCacheBaseDir();
  }

  /**
   * レビュー対象IDに基づくキャッシュディレクトリを取得する
   */
  static getCacheDir(reviewTargetId: string): string {
    return path.join(getCacheBaseDir(), reviewTargetId);
  }

  /**
   * テキストキャッシュを保存する
   * @param reviewTargetId レビュー対象ID
   * @param cacheId キャッシュID
   * @param content テキスト内容
   * @returns 保存先のファイルパス
   */
  static async saveTextCache(
    reviewTargetId: string,
    cacheId: string,
    content: string,
  ): Promise<string> {
    const cacheDir = ReviewCacheHelper.getCacheDir(reviewTargetId);
    await fs.mkdir(cacheDir, { recursive: true });

    const filePath = path.join(cacheDir, `${cacheId}.txt`);
    await fs.writeFile(filePath, content, "utf-8");

    logger.debug({ reviewTargetId, cacheId, filePath }, "テキストキャッシュを保存しました");
    return filePath;
  }

  /**
   * 画像キャッシュを保存する
   * @param reviewTargetId レビュー対象ID
   * @param cacheId キャッシュID
   * @param imageDataArray Base64エンコードされた画像データの配列
   * @returns 保存先のディレクトリパス
   */
  static async saveImageCache(
    reviewTargetId: string,
    cacheId: string,
    imageDataArray: string[],
  ): Promise<string> {
    const cacheDir = path.join(
      ReviewCacheHelper.getCacheDir(reviewTargetId),
      cacheId,
    );
    await fs.mkdir(cacheDir, { recursive: true });

    for (let i = 0; i < imageDataArray.length; i++) {
      const imageData = imageDataArray[i];
      const imagePath = path.join(cacheDir, `page_${i + 1}.png`);
      const buffer = Buffer.from(imageData, "base64");
      await fs.writeFile(imagePath, buffer);
    }

    logger.debug(
      { reviewTargetId, cacheId, cacheDir, imageCount: imageDataArray.length },
      "画像キャッシュを保存しました",
    );
    return cacheDir;
  }

  /**
   * テキストキャッシュを読み込む
   * @param cachePath キャッシュファイルのパス
   * @returns テキスト内容
   */
  static async loadTextCache(cachePath: string): Promise<string> {
    const content = await fs.readFile(cachePath, "utf-8");
    logger.debug({ cachePath }, "テキストキャッシュを読み込みました");
    return content;
  }

  /**
   * 画像キャッシュを読み込む
   * @param cacheDir キャッシュディレクトリのパス
   * @returns Base64エンコードされた画像データの配列
   */
  static async loadImageCache(cacheDir: string): Promise<string[]> {
    const files = await fs.readdir(cacheDir);
    const pngFiles = files
      .filter((f) => f.endsWith(".png"))
      .sort((a, b) => {
        // page_1.png, page_2.png, ... の順にソート
        const numA = parseInt(a.match(/page_(\d+)\.png/)?.[1] || "0");
        const numB = parseInt(b.match(/page_(\d+)\.png/)?.[1] || "0");
        return numA - numB;
      });

    const imageDataArray: string[] = [];
    for (const file of pngFiles) {
      const filePath = path.join(cacheDir, file);
      const buffer = await fs.readFile(filePath);
      imageDataArray.push(buffer.toString("base64"));
    }

    logger.debug(
      { cacheDir, imageCount: imageDataArray.length },
      "画像キャッシュを読み込みました",
    );
    return imageDataArray;
  }

  /**
   * レビュー対象のキャッシュディレクトリを削除する
   * @param reviewTargetId レビュー対象ID
   */
  static async deleteCacheDirectory(reviewTargetId: string): Promise<void> {
    const cacheDir = ReviewCacheHelper.getCacheDir(reviewTargetId);
    try {
      await fs.rm(cacheDir, { recursive: true, force: true });
      logger.debug({ reviewTargetId, cacheDir }, "キャッシュディレクトリを削除しました");
    } catch (error) {
      // ディレクトリが存在しない場合は無視
      logger.debug(
        { reviewTargetId, cacheDir, error },
        "キャッシュディレクトリの削除に失敗しましたが、無視します",
      );
    }
  }

  /**
   * キャッシュが存在するか確認する
   * @param cachePath キャッシュファイル/ディレクトリのパス
   */
  static async exists(cachePath: string): Promise<boolean> {
    try {
      await fs.access(cachePath);
      return true;
    } catch {
      return false;
    }
  }
}
