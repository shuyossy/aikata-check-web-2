import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { ReviewCacheHelper } from "../reviewCacheHelper";

// fs/promisesをモック
vi.mock("fs/promises");

describe("ReviewCacheHelper", () => {
  const testReviewTargetId = "550e8400-e29b-41d4-a716-446655440000";
  const testCacheId = "660e8400-e29b-41d4-a716-446655440001";
  const originalEnv = process.env.REVIEW_CACHE_DIR;

  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトのキャッシュディレクトリを使用
    delete process.env.REVIEW_CACHE_DIR;
  });

  afterEach(() => {
    // 環境変数を元に戻す
    if (originalEnv !== undefined) {
      process.env.REVIEW_CACHE_DIR = originalEnv;
    } else {
      delete process.env.REVIEW_CACHE_DIR;
    }
  });

  describe("getCacheBaseDir", () => {
    it("環境変数が設定されていない場合はデフォルト値を返す", () => {
      const baseDir = ReviewCacheHelper.getCacheBaseDir();
      expect(baseDir).toBe("./review_cache");
    });

    it("環境変数が設定されている場合はその値を返す", () => {
      process.env.REVIEW_CACHE_DIR = "/custom/cache/dir";
      const baseDir = ReviewCacheHelper.getCacheBaseDir();
      expect(baseDir).toBe("/custom/cache/dir");
    });
  });

  describe("getCacheDir", () => {
    it("レビュー対象IDに基づくディレクトリパスを返す", () => {
      const cacheDir = ReviewCacheHelper.getCacheDir(testReviewTargetId);
      expect(cacheDir).toBe(path.join("./review_cache", testReviewTargetId));
    });
  });

  describe("saveTextCache", () => {
    it("テキストキャッシュを保存してファイルパスを返す", async () => {
      const content = "テスト用のテキストコンテンツ";
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await ReviewCacheHelper.saveTextCache(
        testReviewTargetId,
        testCacheId,
        content,
      );

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join("./review_cache", testReviewTargetId),
        { recursive: true },
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join("./review_cache", testReviewTargetId, `${testCacheId}.txt`),
        content,
        "utf-8",
      );
      expect(result).toBe(
        path.join("./review_cache", testReviewTargetId, `${testCacheId}.txt`),
      );
    });

    it("空のテキスト内容でも保存できる", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await ReviewCacheHelper.saveTextCache(
        testReviewTargetId,
        testCacheId,
        "",
      );

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join("./review_cache", testReviewTargetId, `${testCacheId}.txt`),
        "",
        "utf-8",
      );
      expect(result).toBe(
        path.join("./review_cache", testReviewTargetId, `${testCacheId}.txt`),
      );
    });
  });

  describe("saveImageCache", () => {
    it("Data URL形式の画像データからプレフィックスを削除してBase64デコードして保存する", async () => {
      // 実際のBase64エンコードされた画像データ（Data URL形式）
      const imageData1 =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const imageData2 =
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof";
      const imageDataArray = [imageData1, imageData2];
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await ReviewCacheHelper.saveImageCache(
        testReviewTargetId,
        testCacheId,
        imageDataArray,
      );

      const expectedDir = path.join(
        "./review_cache",
        testReviewTargetId,
        testCacheId,
      );
      expect(fs.mkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledTimes(2);

      // Data URLプレフィックスが削除されてBase64デコードされていることを確認
      const expectedBuffer1 = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      );
      const expectedBuffer2 = Buffer.from(
        "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof",
        "base64",
      );
      expect(fs.writeFile).toHaveBeenNthCalledWith(
        1,
        path.join(expectedDir, "page_1.png"),
        expectedBuffer1,
      );
      expect(fs.writeFile).toHaveBeenNthCalledWith(
        2,
        path.join(expectedDir, "page_2.png"),
        expectedBuffer2,
      );
      expect(result).toBe(expectedDir);
    });

    it("プレフィックスがない純粋なBase64データもそのまま処理される", async () => {
      // プレフィックスなしのBase64データ（フォールバック対応）
      const imageDataArray = ["base64data1", "base64data2"];
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await ReviewCacheHelper.saveImageCache(
        testReviewTargetId,
        testCacheId,
        imageDataArray,
      );

      const expectedDir = path.join(
        "./review_cache",
        testReviewTargetId,
        testCacheId,
      );
      expect(fs.mkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
      expect(result).toBe(expectedDir);
    });

    it("空の画像配列でもディレクトリが作成される", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await ReviewCacheHelper.saveImageCache(
        testReviewTargetId,
        testCacheId,
        [],
      );

      const expectedDir = path.join(
        "./review_cache",
        testReviewTargetId,
        testCacheId,
      );
      expect(fs.mkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });
      expect(fs.writeFile).not.toHaveBeenCalled(); // 画像がないのでwriteFileは呼ばれない
      expect(result).toBe(expectedDir);
    });
  });

  describe("loadTextCache", () => {
    it("テキストキャッシュを読み込む", async () => {
      const expectedContent = "テスト用のテキストコンテンツ";
      const cachePath = "/cache/test.txt";
      vi.mocked(fs.readFile).mockResolvedValue(expectedContent);

      const result = await ReviewCacheHelper.loadTextCache(cachePath);

      expect(fs.readFile).toHaveBeenCalledWith(cachePath, "utf-8");
      expect(result).toBe(expectedContent);
    });
  });

  describe("loadImageCache", () => {
    it("画像キャッシュを読み込んでData URL形式のBase64データの配列を返す", async () => {
      const cacheDir = "/cache/images";
      const files = ["page_1.png", "page_2.png", "page_3.png"];
      const buffer1 = Buffer.from("image1");
      const buffer2 = Buffer.from("image2");
      const buffer3 = Buffer.from("image3");

      vi.mocked(fs.readdir).mockResolvedValue(files as unknown as never[]);
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(buffer1 as unknown as never)
        .mockResolvedValueOnce(buffer2 as unknown as never)
        .mockResolvedValueOnce(buffer3 as unknown as never);

      const result = await ReviewCacheHelper.loadImageCache(cacheDir);

      expect(fs.readdir).toHaveBeenCalledWith(cacheDir);
      expect(fs.readFile).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(3);
      // Data URLプレフィックスが付加されていることを確認
      expect(result[0]).toBe(
        `data:image/png;base64,${buffer1.toString("base64")}`,
      );
      expect(result[1]).toBe(
        `data:image/png;base64,${buffer2.toString("base64")}`,
      );
      expect(result[2]).toBe(
        `data:image/png;base64,${buffer3.toString("base64")}`,
      );
    });

    it("ファイルが番号順にソートされる", async () => {
      const cacheDir = "/cache/images";
      // 順序がバラバラなファイル
      const files = ["page_10.png", "page_2.png", "page_1.png"];
      const buffer = Buffer.from("image");

      vi.mocked(fs.readdir).mockResolvedValue(files as unknown as never[]);
      vi.mocked(fs.readFile).mockResolvedValue(buffer as unknown as never);

      await ReviewCacheHelper.loadImageCache(cacheDir);

      // readFileの呼び出し順序を確認
      expect(fs.readFile).toHaveBeenNthCalledWith(
        1,
        path.join(cacheDir, "page_1.png"),
      );
      expect(fs.readFile).toHaveBeenNthCalledWith(
        2,
        path.join(cacheDir, "page_2.png"),
      );
      expect(fs.readFile).toHaveBeenNthCalledWith(
        3,
        path.join(cacheDir, "page_10.png"),
      );
    });
  });

  describe("deleteCacheDirectory", () => {
    it("キャッシュディレクトリを削除する", async () => {
      vi.mocked(fs.rm).mockResolvedValue(undefined);

      await ReviewCacheHelper.deleteCacheDirectory(testReviewTargetId);

      expect(fs.rm).toHaveBeenCalledWith(
        path.join("./review_cache", testReviewTargetId),
        { recursive: true, force: true },
      );
    });

    it("ディレクトリが存在しない場合でもエラーにならない", async () => {
      vi.mocked(fs.rm).mockRejectedValue(new Error("ENOENT"));

      // エラーがスローされないことを確認
      await expect(
        ReviewCacheHelper.deleteCacheDirectory(testReviewTargetId),
      ).resolves.not.toThrow();
    });
  });

  describe("exists", () => {
    it("パスが存在する場合はtrueを返す", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await ReviewCacheHelper.exists("/cache/test.txt");

      expect(result).toBe(true);
    });

    it("パスが存在しない場合はfalseを返す", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

      const result = await ReviewCacheHelper.exists("/cache/nonexistent.txt");

      expect(result).toBe(false);
    });
  });
});
