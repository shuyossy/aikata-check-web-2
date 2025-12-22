import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExportCheckListToCsvService } from "../ExportCheckListToCsvService";
import { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { Project } from "@/domain/project";
import { ReviewSpace } from "@/domain/reviewSpace";
import { CheckListItem } from "@/domain/checkListItem";

// 暗号化関数をモック
vi.mock("@/lib/server/encryption", () => ({
  encrypt: vi.fn((text: string) => `encrypted_${text}`),
  decrypt: vi.fn((text: string) => text.replace("encrypted_", "")),
}));

describe("ExportCheckListToCsvService", () => {
  let mockCheckListItemRepository: ICheckListItemRepository;
  let mockReviewSpaceRepository: IReviewSpaceRepository;
  let mockProjectRepository: IProjectRepository;
  let service: ExportCheckListToCsvService;

  const validProjectId = "123e4567-e89b-12d3-a456-426614174000";
  const validReviewSpaceId = "223e4567-e89b-12d3-a456-426614174001";
  const validUserId = "323e4567-e89b-12d3-a456-426614174002";

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

  const createMockCheckListItem = (content: string) => {
    return CheckListItem.reconstruct({
      id: crypto.randomUUID(),
      reviewSpaceId: validReviewSpaceId,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  beforeEach(() => {
    mockCheckListItemRepository = {
      findById: vi.fn(),
      findByIds: vi.fn().mockResolvedValue([]),
      findByReviewSpaceId: vi.fn().mockResolvedValue([]),
      countByReviewSpaceId: vi.fn().mockResolvedValue(0),
      save: vi.fn(),
      bulkSave: vi.fn(),
      bulkInsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      deleteByReviewSpaceId: vi.fn(),
    };
    mockReviewSpaceRepository = {
      findById: vi.fn().mockResolvedValue(mockReviewSpace),
      findByProjectId: vi.fn(),
      countByProjectId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
    mockProjectRepository = {
      findById: vi.fn().mockResolvedValue(mockProject),
      findByMemberId: vi.fn(),
      countByMemberId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
    service = new ExportCheckListToCsvService(
      mockCheckListItemRepository,
      mockReviewSpaceRepository,
      mockProjectRepository,
    );
  });

  describe("正常系", () => {
    it("チェック項目をCSV形式でエクスポートできる", async () => {
      const mockItems = [
        createMockCheckListItem("項目1"),
        createMockCheckListItem("項目2"),
        createMockCheckListItem("項目3"),
      ];
      vi.mocked(
        mockCheckListItemRepository.countByReviewSpaceId,
      ).mockResolvedValue(3);
      vi.mocked(
        mockCheckListItemRepository.findByReviewSpaceId,
      ).mockResolvedValue(mockItems);

      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
      });

      expect(result.exportedCount).toBe(3);
      // UTF-8 BOM + 各行
      expect(result.csvContent).toBe("\uFEFF項目1\n項目2\n項目3");
    });

    it("改行を含むチェック項目が正しくエスケープされる", async () => {
      const mockItems = [
        createMockCheckListItem("項目1\n改行あり"),
        createMockCheckListItem("項目2"),
      ];
      vi.mocked(
        mockCheckListItemRepository.countByReviewSpaceId,
      ).mockResolvedValue(2);
      vi.mocked(
        mockCheckListItemRepository.findByReviewSpaceId,
      ).mockResolvedValue(mockItems);

      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
      });

      expect(result.exportedCount).toBe(2);
      // 改行を含む項目はダブルクォートで囲まれる
      expect(result.csvContent).toBe('\uFEFF"項目1\n改行あり"\n項目2');
    });

    it("カンマを含むチェック項目が正しくエスケープされる", async () => {
      const mockItems = [
        createMockCheckListItem("項目1,カンマあり"),
        createMockCheckListItem("項目2"),
      ];
      vi.mocked(
        mockCheckListItemRepository.countByReviewSpaceId,
      ).mockResolvedValue(2);
      vi.mocked(
        mockCheckListItemRepository.findByReviewSpaceId,
      ).mockResolvedValue(mockItems);

      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
      });

      expect(result.exportedCount).toBe(2);
      // カンマを含む項目はダブルクォートで囲まれる
      expect(result.csvContent).toBe('\uFEFF"項目1,カンマあり"\n項目2');
    });

    it("ダブルクォートを含むチェック項目が正しくエスケープされる", async () => {
      const mockItems = [
        createMockCheckListItem('項目1"クォートあり'),
        createMockCheckListItem("項目2"),
      ];
      vi.mocked(
        mockCheckListItemRepository.countByReviewSpaceId,
      ).mockResolvedValue(2);
      vi.mocked(
        mockCheckListItemRepository.findByReviewSpaceId,
      ).mockResolvedValue(mockItems);

      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
      });

      expect(result.exportedCount).toBe(2);
      // ダブルクォートはエスケープされ、全体がダブルクォートで囲まれる
      expect(result.csvContent).toBe('\uFEFF"項目1""クォートあり"\n項目2');
    });

    it("UTF-8 BOMが付与される", async () => {
      const mockItems = [createMockCheckListItem("項目1")];
      vi.mocked(
        mockCheckListItemRepository.countByReviewSpaceId,
      ).mockResolvedValue(1);
      vi.mocked(
        mockCheckListItemRepository.findByReviewSpaceId,
      ).mockResolvedValue(mockItems);

      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
      });

      expect(result.csvContent.startsWith("\uFEFF")).toBe(true);
    });

    it("複合的な特殊文字を含むチェック項目が正しくエスケープされる", async () => {
      const mockItems = [
        createMockCheckListItem('項目1,カンマと"クォート"と\n改行'),
      ];
      vi.mocked(
        mockCheckListItemRepository.countByReviewSpaceId,
      ).mockResolvedValue(1);
      vi.mocked(
        mockCheckListItemRepository.findByReviewSpaceId,
      ).mockResolvedValue(mockItems);

      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
      });

      // 複合的な特殊文字が正しくエスケープされる
      expect(result.csvContent).toBe(
        '\uFEFF"項目1,カンマと""クォート""と\n改行"',
      );
    });

    it("単一のチェック項目をエクスポートできる", async () => {
      const mockItems = [createMockCheckListItem("単一項目")];
      vi.mocked(
        mockCheckListItemRepository.countByReviewSpaceId,
      ).mockResolvedValue(1);
      vi.mocked(
        mockCheckListItemRepository.findByReviewSpaceId,
      ).mockResolvedValue(mockItems);

      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
      });

      expect(result.exportedCount).toBe(1);
      expect(result.csvContent).toBe("\uFEFF単一項目");
    });

    it("上限件数（10000件）ちょうどでもエクスポートできる", async () => {
      // 10000件のモックデータを生成
      const mockItems = Array.from({ length: 10000 }, (_, i) =>
        createMockCheckListItem(`項目${i + 1}`),
      );
      vi.mocked(
        mockCheckListItemRepository.countByReviewSpaceId,
      ).mockResolvedValue(10000);
      vi.mocked(
        mockCheckListItemRepository.findByReviewSpaceId,
      ).mockResolvedValue(mockItems);

      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
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
    it("存在しないレビュースペースの場合はエラー", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(null);

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "REVIEW_SPACE_NOT_FOUND" });
    });

    it("存在しないプロジェクトの場合はエラー", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_NOT_FOUND" });
    });

    it("プロジェクトにアクセス権がない場合はエラー", async () => {
      const otherUserId = "623e4567-e89b-12d3-a456-426614174005";

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: otherUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_ACCESS_DENIED" });
    });

    it("チェック項目が0件の場合はエラー", async () => {
      vi.mocked(
        mockCheckListItemRepository.countByReviewSpaceId,
      ).mockResolvedValue(0);

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "CHECK_LIST_EXPORT_NO_ITEMS" });
    });

    it("チェック項目が上限（10000件）を超える場合はエラー", async () => {
      vi.mocked(
        mockCheckListItemRepository.countByReviewSpaceId,
      ).mockResolvedValue(10001);

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
        }),
      ).rejects.toMatchObject({
        messageCode: "CHECK_LIST_EXPORT_TOO_MANY_ITEMS",
      });
    });

    it("リポジトリでエラーが発生した場合はスロー", async () => {
      vi.mocked(
        mockCheckListItemRepository.countByReviewSpaceId,
      ).mockResolvedValue(1);
      vi.mocked(
        mockCheckListItemRepository.findByReviewSpaceId,
      ).mockRejectedValue(new Error("DB Error"));

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
        }),
      ).rejects.toThrow("DB Error");
    });
  });
});
