import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListReviewSpaceCheckListItemsService } from "../ListReviewSpaceCheckListItemsService";
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

describe("ListReviewSpaceCheckListItemsService", () => {
  let mockCheckListItemRepository: ICheckListItemRepository;
  let mockReviewSpaceRepository: IReviewSpaceRepository;
  let mockProjectRepository: IProjectRepository;
  let service: ListReviewSpaceCheckListItemsService;

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

  const mockCheckListItem1 = CheckListItem.reconstruct({
    id: "423e4567-e89b-12d3-a456-426614174003",
    reviewSpaceId: validReviewSpaceId,
    content: "要件定義書との整合性が確保されているか",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  });

  const mockCheckListItem2 = CheckListItem.reconstruct({
    id: "523e4567-e89b-12d3-a456-426614174004",
    reviewSpaceId: validReviewSpaceId,
    content: "セキュリティ要件が考慮されているか",
    createdAt: new Date("2024-01-02"),
    updatedAt: new Date("2024-01-02"),
  });

  beforeEach(() => {
    mockCheckListItemRepository = {
      findById: vi.fn(),
      findByReviewSpaceId: vi
        .fn()
        .mockResolvedValue([mockCheckListItem1, mockCheckListItem2]),
      countByReviewSpaceId: vi.fn().mockResolvedValue(2),
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
    service = new ListReviewSpaceCheckListItemsService(
      mockCheckListItemRepository,
      mockReviewSpaceRepository,
      mockProjectRepository,
    );
  });

  describe("正常系", () => {
    it("チェック項目一覧を取得できる", async () => {
      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
      });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("チェック項目の情報が正しくDTOに変換される", async () => {
      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
      });

      expect(result.items[0].content).toBe(
        "要件定義書との整合性が確保されているか",
      );
      expect(result.items[1].content).toBe("セキュリティ要件が考慮されているか");
    });

    it("ページネーションが正しく適用される", async () => {
      await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
        page: 2,
        limit: 10,
      });

      expect(
        mockCheckListItemRepository.findByReviewSpaceId,
      ).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          limit: 10,
          offset: 10,
        }),
      );
    });

    it("空の結果を正しく返す", async () => {
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockResolvedValue([]);
      vi.mocked(mockCheckListItemRepository.countByReviewSpaceId).mockResolvedValue(0);

      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
      });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
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

    it("リポジトリでエラーが発生した場合はスロー", async () => {
      vi.mocked(mockCheckListItemRepository.findByReviewSpaceId).mockRejectedValue(
        new Error("DB Error"),
      );

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
        }),
      ).rejects.toThrow("DB Error");
    });
  });
});
