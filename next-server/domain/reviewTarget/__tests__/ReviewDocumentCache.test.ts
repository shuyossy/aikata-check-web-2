import { describe, it, expect } from "vitest";
import {
  ReviewDocumentCache,
  PROCESS_MODE,
  CreateReviewDocumentCacheParams,
  ReconstructReviewDocumentCacheParams,
} from "../ReviewDocumentCache";

describe("ReviewDocumentCache", () => {
  const validReviewTargetId = "550e8400-e29b-41d4-a716-446655440000";

  describe("正常系", () => {
    describe("create", () => {
      it("テキストモードでドキュメントキャッシュを作成できる", () => {
        const params: CreateReviewDocumentCacheParams = {
          reviewTargetId: validReviewTargetId,
          fileName: "document.txt",
          processMode: "text",
          cachePath: "/cache/doc.txt",
        };

        const cache = ReviewDocumentCache.create(params);

        expect(cache.reviewTargetId.value).toBe(validReviewTargetId);
        expect(cache.fileName).toBe("document.txt");
        expect(cache.processMode).toBe(PROCESS_MODE.TEXT);
        expect(cache.cachePath).toBe("/cache/doc.txt");
        expect(cache.isTextMode()).toBe(true);
        expect(cache.isImageMode()).toBe(false);
      });

      it("画像モードでドキュメントキャッシュを作成できる", () => {
        const params: CreateReviewDocumentCacheParams = {
          reviewTargetId: validReviewTargetId,
          fileName: "document.pdf",
          processMode: "image",
          cachePath: "/cache/images/doc",
        };

        const cache = ReviewDocumentCache.create(params);

        expect(cache.processMode).toBe(PROCESS_MODE.IMAGE);
        expect(cache.isTextMode()).toBe(false);
        expect(cache.isImageMode()).toBe(true);
      });

      it("キャッシュパスがnullでも作成できる", () => {
        const params: CreateReviewDocumentCacheParams = {
          reviewTargetId: validReviewTargetId,
          fileName: "document.txt",
          processMode: "text",
          cachePath: null,
        };

        const cache = ReviewDocumentCache.create(params);

        expect(cache.cachePath).toBeNull();
        expect(cache.hasCache()).toBe(false);
      });
    });

    describe("reconstruct", () => {
      it("DBから取得したデータを復元できる", () => {
        const createdAt = new Date("2024-01-01T00:00:00Z");
        const params: ReconstructReviewDocumentCacheParams = {
          id: "660e8400-e29b-41d4-a716-446655440001",
          reviewTargetId: validReviewTargetId,
          fileName: "document.txt",
          processMode: "text",
          cachePath: "/cache/doc.txt",
          createdAt,
        };

        const cache = ReviewDocumentCache.reconstruct(params);

        expect(cache.id.value).toBe("660e8400-e29b-41d4-a716-446655440001");
        expect(cache.reviewTargetId.value).toBe(validReviewTargetId);
        expect(cache.fileName).toBe("document.txt");
        expect(cache.processMode).toBe(PROCESS_MODE.TEXT);
        expect(cache.cachePath).toBe("/cache/doc.txt");
        expect(cache.createdAt).toBe(createdAt);
      });
    });

    describe("withCachePath", () => {
      it("キャッシュパスを設定した新しいインスタンスを返す", () => {
        const params: CreateReviewDocumentCacheParams = {
          reviewTargetId: validReviewTargetId,
          fileName: "document.txt",
          processMode: "text",
          cachePath: null,
        };

        const cache = ReviewDocumentCache.create(params);
        const updatedCache = cache.withCachePath("/new/cache/path.txt");

        // 元のインスタンスは変更されない（不変性）
        expect(cache.cachePath).toBeNull();
        // 新しいインスタンスは更新されている
        expect(updatedCache.cachePath).toBe("/new/cache/path.txt");
        expect(updatedCache.hasCache()).toBe(true);
        // 他のプロパティは同じ
        expect(updatedCache.fileName).toBe(cache.fileName);
        expect(updatedCache.processMode).toBe(cache.processMode);
      });
    });

    describe("hasCache", () => {
      it("キャッシュパスが設定されている場合はtrueを返す", () => {
        const params: CreateReviewDocumentCacheParams = {
          reviewTargetId: validReviewTargetId,
          fileName: "document.txt",
          processMode: "text",
          cachePath: "/cache/doc.txt",
        };

        const cache = ReviewDocumentCache.create(params);

        expect(cache.hasCache()).toBe(true);
      });

      it("キャッシュパスがnullの場合はfalseを返す", () => {
        const params: CreateReviewDocumentCacheParams = {
          reviewTargetId: validReviewTargetId,
          fileName: "document.txt",
          processMode: "text",
          cachePath: null,
        };

        const cache = ReviewDocumentCache.create(params);

        expect(cache.hasCache()).toBe(false);
      });

      it("キャッシュパスが空文字の場合はfalseを返す", () => {
        const params: ReconstructReviewDocumentCacheParams = {
          id: "660e8400-e29b-41d4-a716-446655440001",
          reviewTargetId: validReviewTargetId,
          fileName: "document.txt",
          processMode: "text",
          cachePath: "",
          createdAt: new Date(),
        };

        const cache = ReviewDocumentCache.reconstruct(params);

        expect(cache.hasCache()).toBe(false);
      });
    });

    describe("toDto", () => {
      it("DTOに変換できる", () => {
        const createdAt = new Date("2024-01-01T00:00:00Z");
        const params: ReconstructReviewDocumentCacheParams = {
          id: "660e8400-e29b-41d4-a716-446655440001",
          reviewTargetId: validReviewTargetId,
          fileName: "document.txt",
          processMode: "text",
          cachePath: "/cache/doc.txt",
          createdAt,
        };

        const cache = ReviewDocumentCache.reconstruct(params);
        const dto = cache.toDto();

        expect(dto).toEqual({
          id: "660e8400-e29b-41d4-a716-446655440001",
          reviewTargetId: validReviewTargetId,
          fileName: "document.txt",
          processMode: "text",
          cachePath: "/cache/doc.txt",
          createdAt,
        });
      });
    });
  });

  describe("異常系", () => {
    describe("create", () => {
      it("ファイル名が空の場合エラーをスローする", () => {
        const params: CreateReviewDocumentCacheParams = {
          reviewTargetId: validReviewTargetId,
          fileName: "",
          processMode: "text",
          cachePath: null,
        };

        expect(() => ReviewDocumentCache.create(params)).toThrow();
      });

      it("ファイル名がスペースのみの場合エラーをスローする", () => {
        const params: CreateReviewDocumentCacheParams = {
          reviewTargetId: validReviewTargetId,
          fileName: "   ",
          processMode: "text",
          cachePath: null,
        };

        expect(() => ReviewDocumentCache.create(params)).toThrow();
      });

      it("無効な処理モードの場合エラーをスローする", () => {
        const params: CreateReviewDocumentCacheParams = {
          reviewTargetId: validReviewTargetId,
          fileName: "document.txt",
          processMode: "invalid",
          cachePath: null,
        };

        expect(() => ReviewDocumentCache.create(params)).toThrow();
      });

      it("無効なレビュー対象IDの場合エラーをスローする", () => {
        const params: CreateReviewDocumentCacheParams = {
          reviewTargetId: "invalid-uuid",
          fileName: "document.txt",
          processMode: "text",
          cachePath: null,
        };

        expect(() => ReviewDocumentCache.create(params)).toThrow();
      });
    });
  });
});
