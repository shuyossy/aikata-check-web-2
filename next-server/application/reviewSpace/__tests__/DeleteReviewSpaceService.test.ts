import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeleteReviewSpaceService } from "../DeleteReviewSpaceService";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { Project } from "@/domain/project";
import { ReviewSpace } from "@/domain/reviewSpace";

// 暗号化関数をモック
vi.mock("@/lib/server/encryption", () => ({
  encrypt: vi.fn((text: string) => `encrypted_${text}`),
  decrypt: vi.fn((text: string) => text.replace("encrypted_", "")),
}));

describe("DeleteReviewSpaceService", () => {
  let mockReviewSpaceRepository: IReviewSpaceRepository;
  let mockProjectRepository: IProjectRepository;
  let service: DeleteReviewSpaceService;

  const validProjectId = "123e4567-e89b-12d3-a456-426614174000";
  const validUserId = "223e4567-e89b-12d3-a456-426614174001";
  const validReviewSpaceId = "323e4567-e89b-12d3-a456-426614174002";

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
    name: "設計書レビュー",
    description: "設計書のレビュー",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-06-01"),
  });

  beforeEach(() => {
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
    service = new DeleteReviewSpaceService(
      mockReviewSpaceRepository,
      mockProjectRepository,
    );
  });

  describe("正常系", () => {
    it("レビュースペースを削除できる", async () => {
      await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
      });

      expect(mockReviewSpaceRepository.delete).toHaveBeenCalledTimes(1);
      expect(mockReviewSpaceRepository.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          _value: validReviewSpaceId,
        }),
      );
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
      ).rejects.toThrow();
    });

    it("プロジェクトが存在しない場合はエラー", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
        }),
      ).rejects.toThrow();
    });

    it("プロジェクトにアクセス権がない場合はエラー", async () => {
      const otherUserId = "423e4567-e89b-12d3-a456-426614174003";

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: otherUserId,
        }),
      ).rejects.toThrow();
    });

    it("リポジトリでエラーが発生した場合はスロー", async () => {
      vi.mocked(mockReviewSpaceRepository.delete).mockRejectedValue(
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
