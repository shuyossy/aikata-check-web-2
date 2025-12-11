import { describe, it, expect, vi, beforeEach } from "vitest";
import { BulkDeleteCheckListItemsService } from "../BulkDeleteCheckListItemsService";
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

describe("BulkDeleteCheckListItemsService", () => {
  let mockCheckListItemRepository: ICheckListItemRepository;
  let mockReviewSpaceRepository: IReviewSpaceRepository;
  let mockProjectRepository: IProjectRepository;
  let service: BulkDeleteCheckListItemsService;

  const validProjectId = "123e4567-e89b-12d3-a456-426614174000";
  const validReviewSpaceId = "223e4567-e89b-12d3-a456-426614174001";
  const validUserId = "323e4567-e89b-12d3-a456-426614174002";
  const validCheckListItemId1 = "423e4567-e89b-12d3-a456-426614174003";
  const validCheckListItemId2 = "523e4567-e89b-12d3-a456-426614174004";

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

  const mockCheckListItem1 = CheckListItem.reconstruct({
    id: validCheckListItemId1,
    reviewSpaceId: validReviewSpaceId,
    content: "チェック項目1",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const mockCheckListItem2 = CheckListItem.reconstruct({
    id: validCheckListItemId2,
    reviewSpaceId: validReviewSpaceId,
    content: "チェック項目2",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    mockCheckListItemRepository = {
      findById: vi
        .fn()
        .mockImplementation((id) => {
          if (id.value === validCheckListItemId1) {
            return Promise.resolve(mockCheckListItem1);
          }
          if (id.value === validCheckListItemId2) {
            return Promise.resolve(mockCheckListItem2);
          }
          return Promise.resolve(null);
        }),
      findByIds: vi.fn().mockImplementation((ids) => {
        const items: CheckListItem[] = [];
        for (const id of ids) {
          if (id.value === validCheckListItemId1) {
            items.push(mockCheckListItem1);
          }
          if (id.value === validCheckListItemId2) {
            items.push(mockCheckListItem2);
          }
        }
        return Promise.resolve(items);
      }),
      findByReviewSpaceId: vi.fn().mockResolvedValue([]),
      countByReviewSpaceId: vi.fn().mockResolvedValue(0),
      save: vi.fn(),
      bulkSave: vi.fn(),
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
    service = new BulkDeleteCheckListItemsService(
      mockCheckListItemRepository,
      mockReviewSpaceRepository,
      mockProjectRepository,
    );
  });

  describe("正常系", () => {
    it("複数のチェック項目を一括削除できる", async () => {
      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
        checkListItemIds: [validCheckListItemId1, validCheckListItemId2],
      });

      expect(result.deletedCount).toBe(2);
      expect(mockCheckListItemRepository.deleteMany).toHaveBeenCalledTimes(1);
    });

    it("単一のチェック項目を削除できる", async () => {
      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
        checkListItemIds: [validCheckListItemId1],
      });

      expect(result.deletedCount).toBe(1);
    });

    it("空の配列の場合は0件削除として成功する", async () => {
      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
        checkListItemIds: [],
      });

      expect(result.deletedCount).toBe(0);
      expect(mockCheckListItemRepository.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe("異常系", () => {
    it("存在しないレビュースペースの場合はエラー", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(null);

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
          checkListItemIds: [validCheckListItemId1],
        }),
      ).rejects.toMatchObject({ messageCode: "REVIEW_SPACE_NOT_FOUND" });
    });

    it("存在しないプロジェクトの場合はエラー", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
          checkListItemIds: [validCheckListItemId1],
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_NOT_FOUND" });
    });

    it("プロジェクトにアクセス権がない場合はエラー", async () => {
      const otherUserId = "623e4567-e89b-12d3-a456-426614174005";

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: otherUserId,
          checkListItemIds: [validCheckListItemId1],
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_ACCESS_DENIED" });
    });

    it("存在しないチェック項目IDの場合はエラー", async () => {
      const nonExistentId = "723e4567-e89b-12d3-a456-426614174006";
      // findByIdsが空配列を返す場合（存在しないIDが含まれている）
      vi.mocked(mockCheckListItemRepository.findByIds).mockResolvedValue([]);

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
          checkListItemIds: [nonExistentId],
        }),
      ).rejects.toMatchObject({ messageCode: "CHECK_LIST_ITEM_NOT_FOUND" });
    });

    it("異なるレビュースペースのチェック項目の場合はエラー", async () => {
      const otherReviewSpaceId = "823e4567-e89b-12d3-a456-426614174007";
      const otherCheckListItem = CheckListItem.reconstruct({
        id: "923e4567-e89b-12d3-a456-426614174008",
        reviewSpaceId: otherReviewSpaceId,
        content: "他のスペースのチェック項目",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      // findByIdsが異なるレビュースペースのアイテムを返す
      vi.mocked(mockCheckListItemRepository.findByIds).mockResolvedValue([
        otherCheckListItem,
      ]);

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
          checkListItemIds: ["923e4567-e89b-12d3-a456-426614174008"],
        }),
      ).rejects.toMatchObject({ messageCode: "REVIEW_SPACE_ACCESS_DENIED" });
    });

    it("無効なUUID形式の場合はエラー", async () => {
      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
          checkListItemIds: ["invalid-uuid"],
        }),
      ).rejects.toMatchObject({
        messageCode: "CHECK_LIST_ITEM_ID_INVALID_FORMAT",
      });
    });

    it("リポジトリでエラーが発生した場合はスロー", async () => {
      vi.mocked(mockCheckListItemRepository.deleteMany).mockRejectedValue(
        new Error("DB Error"),
      );

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
          checkListItemIds: [validCheckListItemId1],
        }),
      ).rejects.toThrow("DB Error");
    });
  });
});
