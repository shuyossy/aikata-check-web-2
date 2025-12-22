import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExportReviewResultsToCsvService } from "../ExportReviewResultsToCsvService";
import { IReviewResultRepository } from "@/application/shared/port/repository/IReviewResultRepository";
import { IReviewTargetRepository } from "@/application/shared/port/repository/IReviewTargetRepository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { Project } from "@/domain/project";
import { ReviewSpace } from "@/domain/reviewSpace";
import { ReviewTarget } from "@/domain/reviewTarget";
import { ReviewResult } from "@/domain/reviewResult";

// 暗号化関数をモック
vi.mock("@/lib/server/encryption", () => ({
  encrypt: vi.fn((text: string) => `encrypted_${text}`),
  decrypt: vi.fn((text: string) => text.replace("encrypted_", "")),
}));

describe("ExportReviewResultsToCsvService", () => {
  let mockReviewResultRepository: IReviewResultRepository;
  let mockReviewTargetRepository: IReviewTargetRepository;
  let mockReviewSpaceRepository: IReviewSpaceRepository;
  let mockProjectRepository: IProjectRepository;
  let service: ExportReviewResultsToCsvService;

  const validProjectId = "123e4567-e89b-12d3-a456-426614174000";
  const validReviewSpaceId = "223e4567-e89b-12d3-a456-426614174001";
  const validReviewTargetId = "323e4567-e89b-12d3-a456-426614174002";
  const validUserId = "423e4567-e89b-12d3-a456-426614174003";

  const mockProject = Project.reconstruct({
    id: validProjectId,
    name: "テストプロジェクト",
    description: "テスト説明",
    encryptedApiKey: null,
    members: [{ userId: validUserId, createdAt: new Date() }],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const mockReviewSpace = ReviewSpace.reconstruct({
    id: validReviewSpaceId,
    projectId: validProjectId,
    name: "テストスペース",
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const mockReviewTarget = ReviewTarget.reconstruct({
    id: validReviewTargetId,
    reviewSpaceId: validReviewSpaceId,
    name: "テストレビュー対象",
    status: "completed",
    reviewSettings: null,
    reviewType: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const createMockReviewResultSuccess = (
    checkListItemContent: string,
    evaluation: string,
    comment: string,
  ) => {
    return ReviewResult.reconstruct({
      id: crypto.randomUUID(),
      reviewTargetId: validReviewTargetId,
      checkListItemContent,
      evaluation,
      comment,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  const createMockReviewResultError = (
    checkListItemContent: string,
    errorMessage: string,
  ) => {
    return ReviewResult.reconstruct({
      id: crypto.randomUUID(),
      reviewTargetId: validReviewTargetId,
      checkListItemContent,
      evaluation: null,
      comment: null,
      errorMessage,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  beforeEach(() => {
    mockReviewResultRepository = {
      findById: vi.fn(),
      findByReviewTargetId: vi.fn().mockResolvedValue([]),
      countByReviewTargetId: vi.fn().mockResolvedValue(0),
      save: vi.fn(),
      saveMany: vi.fn(),
      delete: vi.fn(),
      deleteByReviewTargetId: vi.fn(),
    };
    mockReviewTargetRepository = {
      findById: vi.fn().mockResolvedValue(mockReviewTarget),
      findByReviewSpaceId: vi.fn(),
      countByReviewSpaceId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
    mockReviewSpaceRepository = {
      findById: vi.fn().mockResolvedValue(mockReviewSpace),
      findByProjectId: vi.fn(),
      countByProjectId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      updateChecklistGenerationError: vi.fn(),
    };
    mockProjectRepository = {
      findById: vi.fn().mockResolvedValue(mockProject),
      findByMemberId: vi.fn(),
      countByMemberId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
    service = new ExportReviewResultsToCsvService(
      mockReviewResultRepository,
      mockReviewTargetRepository,
      mockReviewSpaceRepository,
      mockProjectRepository,
    );
  });

  describe("正常系", () => {
    it("レビュー結果をCSV形式でエクスポートできる", async () => {
      const mockResults = [
        createMockReviewResultSuccess("チェック項目1", "A", "コメント1"),
        createMockReviewResultSuccess("チェック項目2", "B", "コメント2"),
        createMockReviewResultSuccess("チェック項目3", "C", "コメント3"),
      ];
      vi.mocked(
        mockReviewResultRepository.countByReviewTargetId,
      ).mockResolvedValue(3);
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(mockResults);

      const result = await service.execute({
        reviewTargetId: validReviewTargetId,
        userId: validUserId,
      });

      expect(result.exportedCount).toBe(3);
      // UTF-8 BOM + ヘッダー行 + データ行
      expect(result.csvContent).toBe(
        "\uFEFFチェック項目,評定,コメント\nチェック項目1,A,コメント1\nチェック項目2,B,コメント2\nチェック項目3,C,コメント3",
      );
    });

    it("ヘッダー行が含まれる（チェック項目,評定,コメント）", async () => {
      const mockResults = [
        createMockReviewResultSuccess("項目1", "A", "コメント"),
      ];
      vi.mocked(
        mockReviewResultRepository.countByReviewTargetId,
      ).mockResolvedValue(1);
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(mockResults);

      const result = await service.execute({
        reviewTargetId: validReviewTargetId,
        userId: validUserId,
      });

      const lines = result.csvContent.split("\n");
      // BOMを除いたヘッダー行
      expect(lines[0]).toBe("\uFEFFチェック項目,評定,コメント");
    });

    it("エラーレビュー結果が正しく出力される（評定=エラー、コメント=エラーメッセージ）", async () => {
      const mockResults = [
        createMockReviewResultSuccess("正常項目", "A", "正常コメント"),
        createMockReviewResultError(
          "エラー項目",
          "レビュー処理中にエラーが発生しました",
        ),
      ];
      vi.mocked(
        mockReviewResultRepository.countByReviewTargetId,
      ).mockResolvedValue(2);
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(mockResults);

      const result = await service.execute({
        reviewTargetId: validReviewTargetId,
        userId: validUserId,
      });

      expect(result.csvContent).toContain("正常項目,A,正常コメント");
      expect(result.csvContent).toContain(
        "エラー項目,エラー,レビュー処理中にエラーが発生しました",
      );
    });

    it("改行を含むコメントが正しくエスケープされる", async () => {
      const mockResults = [
        createMockReviewResultSuccess("項目1", "A", "コメント1\n改行あり"),
      ];
      vi.mocked(
        mockReviewResultRepository.countByReviewTargetId,
      ).mockResolvedValue(1);
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(mockResults);

      const result = await service.execute({
        reviewTargetId: validReviewTargetId,
        userId: validUserId,
      });

      // 改行を含む項目はダブルクォートで囲まれる
      expect(result.csvContent).toContain('"コメント1\n改行あり"');
    });

    it("カンマを含むコメントが正しくエスケープされる", async () => {
      const mockResults = [
        createMockReviewResultSuccess("項目1", "A", "コメント1,カンマあり"),
      ];
      vi.mocked(
        mockReviewResultRepository.countByReviewTargetId,
      ).mockResolvedValue(1);
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(mockResults);

      const result = await service.execute({
        reviewTargetId: validReviewTargetId,
        userId: validUserId,
      });

      // カンマを含む項目はダブルクォートで囲まれる
      expect(result.csvContent).toContain('"コメント1,カンマあり"');
    });

    it("ダブルクォートを含むコメントが正しくエスケープされる", async () => {
      const mockResults = [
        createMockReviewResultSuccess("項目1", "A", 'コメント1"クォートあり'),
      ];
      vi.mocked(
        mockReviewResultRepository.countByReviewTargetId,
      ).mockResolvedValue(1);
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(mockResults);

      const result = await service.execute({
        reviewTargetId: validReviewTargetId,
        userId: validUserId,
      });

      // ダブルクォートはエスケープされ、全体がダブルクォートで囲まれる
      expect(result.csvContent).toContain('"コメント1""クォートあり"');
    });

    it("UTF-8 BOMが付与される", async () => {
      const mockResults = [
        createMockReviewResultSuccess("項目1", "A", "コメント1"),
      ];
      vi.mocked(
        mockReviewResultRepository.countByReviewTargetId,
      ).mockResolvedValue(1);
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(mockResults);

      const result = await service.execute({
        reviewTargetId: validReviewTargetId,
        userId: validUserId,
      });

      expect(result.csvContent.startsWith("\uFEFF")).toBe(true);
    });

    it("複合的な特殊文字を含むコメントが正しくエスケープされる", async () => {
      const mockResults = [
        createMockReviewResultSuccess(
          "項目1",
          "A",
          'コメント,カンマと"クォート"と\n改行',
        ),
      ];
      vi.mocked(
        mockReviewResultRepository.countByReviewTargetId,
      ).mockResolvedValue(1);
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(mockResults);

      const result = await service.execute({
        reviewTargetId: validReviewTargetId,
        userId: validUserId,
      });

      // 複合的な特殊文字が正しくエスケープされる
      expect(result.csvContent).toContain(
        '"コメント,カンマと""クォート""と\n改行"',
      );
    });

    it("単一のレビュー結果をエクスポートできる", async () => {
      const mockResults = [
        createMockReviewResultSuccess("単一項目", "A", "単一コメント"),
      ];
      vi.mocked(
        mockReviewResultRepository.countByReviewTargetId,
      ).mockResolvedValue(1);
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(mockResults);

      const result = await service.execute({
        reviewTargetId: validReviewTargetId,
        userId: validUserId,
      });

      expect(result.exportedCount).toBe(1);
      expect(result.csvContent).toBe(
        "\uFEFFチェック項目,評定,コメント\n単一項目,A,単一コメント",
      );
    });

    it("評定とコメントが空の場合も正しく出力される", async () => {
      const mockResults = [
        ReviewResult.reconstruct({
          id: crypto.randomUUID(),
          reviewTargetId: validReviewTargetId,
          checkListItemContent: "空の項目",
          evaluation: null,
          comment: null,
          errorMessage: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ];
      vi.mocked(
        mockReviewResultRepository.countByReviewTargetId,
      ).mockResolvedValue(1);
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(mockResults);

      const result = await service.execute({
        reviewTargetId: validReviewTargetId,
        userId: validUserId,
      });

      expect(result.csvContent).toBe(
        "\uFEFFチェック項目,評定,コメント\n空の項目,,",
      );
    });

    it("上限件数（10000件）ちょうどでもエクスポートできる", async () => {
      // 10000件のモックデータを生成
      const mockResults = Array.from({ length: 10000 }, (_, i) =>
        createMockReviewResultSuccess(`項目${i + 1}`, "A", `コメント${i + 1}`),
      );
      vi.mocked(
        mockReviewResultRepository.countByReviewTargetId,
      ).mockResolvedValue(10000);
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockResolvedValue(mockResults);

      const result = await service.execute({
        reviewTargetId: validReviewTargetId,
        userId: validUserId,
      });

      expect(result.exportedCount).toBe(10000);
      expect(result.csvContent.startsWith("\uFEFF")).toBe(true);
      // 最初と最後の項目が含まれることを確認
      expect(result.csvContent).toContain("項目1");
      expect(result.csvContent).toContain("項目10000");
    });
  });

  describe("異常系", () => {
    it("存在しないレビュー対象の場合はエラー", async () => {
      vi.mocked(mockReviewTargetRepository.findById).mockResolvedValue(null);

      await expect(
        service.execute({
          reviewTargetId: validReviewTargetId,
          userId: validUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "REVIEW_TARGET_NOT_FOUND" });
    });

    it("存在しないレビュースペースの場合はエラー", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(null);

      await expect(
        service.execute({
          reviewTargetId: validReviewTargetId,
          userId: validUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "REVIEW_SPACE_NOT_FOUND" });
    });

    it("存在しないプロジェクトの場合はエラー", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      await expect(
        service.execute({
          reviewTargetId: validReviewTargetId,
          userId: validUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_NOT_FOUND" });
    });

    it("プロジェクトにアクセス権がない場合はエラー", async () => {
      const otherUserId = "623e4567-e89b-12d3-a456-426614174005";

      await expect(
        service.execute({
          reviewTargetId: validReviewTargetId,
          userId: otherUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_ACCESS_DENIED" });
    });

    it("レビュー結果が0件の場合はエラー", async () => {
      vi.mocked(
        mockReviewResultRepository.countByReviewTargetId,
      ).mockResolvedValue(0);

      await expect(
        service.execute({
          reviewTargetId: validReviewTargetId,
          userId: validUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "REVIEW_RESULT_EXPORT_NO_ITEMS" });
    });

    it("レビュー結果が上限（10000件）を超える場合はエラー", async () => {
      vi.mocked(
        mockReviewResultRepository.countByReviewTargetId,
      ).mockResolvedValue(10001);

      await expect(
        service.execute({
          reviewTargetId: validReviewTargetId,
          userId: validUserId,
        }),
      ).rejects.toMatchObject({
        messageCode: "REVIEW_RESULT_EXPORT_TOO_MANY_ITEMS",
      });
    });

    it("リポジトリでエラーが発生した場合はスロー", async () => {
      vi.mocked(
        mockReviewResultRepository.countByReviewTargetId,
      ).mockResolvedValue(1);
      vi.mocked(
        mockReviewResultRepository.findByReviewTargetId,
      ).mockRejectedValue(new Error("DB Error"));

      await expect(
        service.execute({
          reviewTargetId: validReviewTargetId,
          userId: validUserId,
        }),
      ).rejects.toThrow("DB Error");
    });
  });
});
