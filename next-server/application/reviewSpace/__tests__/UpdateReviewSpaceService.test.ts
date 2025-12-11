import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpdateReviewSpaceService } from "../UpdateReviewSpaceService";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { Project } from "@/domain/project";
import { ReviewSpace } from "@/domain/reviewSpace";

// 暗号化関数をモック
vi.mock("@/lib/server/encryption", () => ({
  encrypt: vi.fn((text: string) => `encrypted_${text}`),
  decrypt: vi.fn((text: string) => text.replace("encrypted_", "")),
}));

describe("UpdateReviewSpaceService", () => {
  let mockReviewSpaceRepository: IReviewSpaceRepository;
  let mockProjectRepository: IProjectRepository;
  let service: UpdateReviewSpaceService;

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
    service = new UpdateReviewSpaceService(
      mockReviewSpaceRepository,
      mockProjectRepository,
    );
  });

  describe("正常系", () => {
    it("名前を更新できる", async () => {
      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
        name: "コードレビュー",
      });

      expect(result.name).toBe("コードレビュー");
      expect(result.description).toBe("設計書のレビュー"); // 変更なし
      expect(mockReviewSpaceRepository.save).toHaveBeenCalledTimes(1);
    });

    it("説明を更新できる", async () => {
      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
        description: "新しい説明",
      });

      expect(result.name).toBe("設計書レビュー"); // 変更なし
      expect(result.description).toBe("新しい説明");
      expect(mockReviewSpaceRepository.save).toHaveBeenCalledTimes(1);
    });

    it("名前と説明を同時に更新できる", async () => {
      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
        name: "新しいスペース名",
        description: "新しい説明",
      });

      expect(result.name).toBe("新しいスペース名");
      expect(result.description).toBe("新しい説明");
      expect(mockReviewSpaceRepository.save).toHaveBeenCalledTimes(1);
    });

    it("説明をnullに更新できる", async () => {
      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
        description: null,
      });

      expect(result.description).toBeNull();
    });

    it("更新対象がない場合でも正常終了する", async () => {
      const result = await service.execute({
        reviewSpaceId: validReviewSpaceId,
        userId: validUserId,
      });

      expect(result.name).toBe("設計書レビュー");
      expect(result.description).toBe("設計書のレビュー");
      // saveは呼ばれるがデータは変わらない
      expect(mockReviewSpaceRepository.save).toHaveBeenCalledTimes(1);
    });
  });

  describe("異常系", () => {
    it("存在しないレビュースペースの場合はエラー", async () => {
      vi.mocked(mockReviewSpaceRepository.findById).mockResolvedValue(null);

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
          name: "新しい名前",
        }),
      ).rejects.toMatchObject({ messageCode: "REVIEW_SPACE_NOT_FOUND" });
    });

    it("プロジェクトが存在しない場合はエラー", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
          name: "新しい名前",
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_NOT_FOUND" });
    });

    it("プロジェクトにアクセス権がない場合はエラー", async () => {
      const otherUserId = "423e4567-e89b-12d3-a456-426614174003";

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: otherUserId,
          name: "新しい名前",
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_ACCESS_DENIED" });
    });

    it("名前が空の場合はエラー", async () => {
      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
          name: "",
        }),
      ).rejects.toMatchObject({ messageCode: "REVIEW_SPACE_NAME_EMPTY" });
    });

    it("名前が長すぎる場合はエラー", async () => {
      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
          name: "あ".repeat(101),
        }),
      ).rejects.toMatchObject({ messageCode: "REVIEW_SPACE_NAME_TOO_LONG" });
    });

    it("説明が長すぎる場合はエラー", async () => {
      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
          description: "あ".repeat(1001),
        }),
      ).rejects.toMatchObject({ messageCode: "REVIEW_SPACE_DESCRIPTION_TOO_LONG" });
    });

    it("リポジトリでエラーが発生した場合はスロー", async () => {
      vi.mocked(mockReviewSpaceRepository.save).mockRejectedValue(
        new Error("DB Error"),
      );

      await expect(
        service.execute({
          reviewSpaceId: validReviewSpaceId,
          userId: validUserId,
          name: "新しい名前",
        }),
      ).rejects.toThrow("DB Error");
    });
  });
});
