import { describe, it, expect, vi, beforeEach } from "vitest";
import { BulkSaveCheckListItemsService } from "../BulkSaveCheckListItemsService";
import { ICheckListItemRepository } from "@/application/shared/port/repository/ICheckListItemRepository";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { Project } from "@/domain/project";
import { ReviewSpace } from "@/domain/reviewSpace";

// 暗号化関数をモック
vi.mock("@/lib/server/encryption", () => ({
  encrypt: vi.fn((text: string) => `encrypted_${text}`),
  decrypt: vi.fn((text: string) => text.replace("encrypted_", "")),
}));

describe("BulkSaveCheckListItemsService", () => {
  let mockCheckListItemRepository: ICheckListItemRepository;
  let mockReviewSpaceRepository: IReviewSpaceRepository;
  let mockProjectRepository: IProjectRepository;
  let service: BulkSaveCheckListItemsService;

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
    service = new BulkSaveCheckListItemsService(
      mockCheckListItemRepository,
      mockReviewSpaceRepository,
      mockProjectRepository,
    );
  });

  describe("正常系", () => {
    it("チェック項目を一括保存できる", async () => {
      const contents = [
        "要件定義書との整合性が確保されているか",
        "セキュリティ要件が考慮されているか",
        "パフォーマンス要件が満たされているか",
      ];

      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
        contents,
      });

      expect(result.savedCount).toBe(3);
      expect(mockCheckListItemRepository.bulkSave).toHaveBeenCalledTimes(1);

      // bulkSaveの第2引数（チェック項目配列）を取得
      const savedItems = vi.mocked(mockCheckListItemRepository.bulkSave).mock
        .calls[0][1];

      // 順序が保持されていることを検証
      expect(savedItems).toHaveLength(3);
      expect(savedItems[0].content.value).toBe(contents[0]);
      expect(savedItems[1].content.value).toBe(contents[1]);
      expect(savedItems[2].content.value).toBe(contents[2]);
    });

    it("空の配列でも保存できる（全削除）", async () => {
      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
        contents: [],
      });

      expect(result.savedCount).toBe(0);
      expect(mockCheckListItemRepository.bulkSave).toHaveBeenCalledWith(
        expect.anything(),
        [],
      );
    });

    it("大量のチェック項目を保存できる", async () => {
      const contents = Array.from(
        { length: 100 },
        (_, i) => `チェック項目${i + 1}`,
      );

      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
        contents,
      });

      expect(result.savedCount).toBe(100);
    });
  });

  describe("異常系", () => {
    it("存在しないレビュースペースの場合はエラー", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(null);

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
          contents: ["テスト項目"],
        }),
      ).rejects.toMatchObject({ messageCode: "REVIEW_SPACE_NOT_FOUND" });
    });

    it("存在しないプロジェクトの場合はエラー", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
          contents: ["テスト項目"],
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_NOT_FOUND" });
    });

    it("プロジェクトにアクセス権がない場合はエラー", async () => {
      const otherUserId = "623e4567-e89b-12d3-a456-426614174005";

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: otherUserId,
          contents: ["テスト項目"],
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_ACCESS_DENIED" });
    });

    it("空のチェック項目内容がある場合はエラー", async () => {
      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
          contents: ["有効な項目", "", "別の有効な項目"],
        }),
      ).rejects.toMatchObject({ messageCode: "CHECK_LIST_ITEM_CONTENT_EMPTY" });
    });

    it("リポジトリでエラーが発生した場合はスロー", async () => {
      vi.mocked(mockCheckListItemRepository.bulkSave).mockRejectedValue(
        new Error("DB Error"),
      );

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
          contents: ["テスト項目"],
        }),
      ).rejects.toThrow("DB Error");
    });
  });
});
