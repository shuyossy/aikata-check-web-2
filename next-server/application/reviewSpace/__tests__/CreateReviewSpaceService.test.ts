import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateReviewSpaceService } from "../CreateReviewSpaceService";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { Project } from "@/domain/project";

// 暗号化関数をモック
vi.mock("@/lib/server/encryption", () => ({
  encrypt: vi.fn((text: string) => `encrypted_${text}`),
  decrypt: vi.fn((text: string) => text.replace("encrypted_", "")),
}));

describe("CreateReviewSpaceService", () => {
  let mockReviewSpaceRepository: IReviewSpaceRepository;
  let mockProjectRepository: IProjectRepository;
  let service: CreateReviewSpaceService;

  const validProjectId = "123e4567-e89b-12d3-a456-426614174000";
  const validUserId = "223e4567-e89b-12d3-a456-426614174001";

  const mockProject = Project.reconstruct({
    id: validProjectId,
    name: "テストプロジェクト",
    description: "テスト説明",
    encryptedApiKey: null,
    members: [{ userId: validUserId, createdAt: new Date() }],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    mockReviewSpaceRepository = {
      findById: vi.fn(),
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
    service = new CreateReviewSpaceService(
      mockReviewSpaceRepository,
      mockProjectRepository,
    );
  });

  describe("正常系", () => {
    it("レビュースペースを作成できる", async () => {
      const result = await service.execute({
        projectId: validProjectId,
        name: "設計書レビュー",
        description: "システム設計書のレビューを実施します",
        userId: validUserId,
      });

      expect(result.name).toBe("設計書レビュー");
      expect(result.description).toBe("システム設計書のレビューを実施します");
      expect(result.projectId).toBe(validProjectId);
      expect(mockReviewSpaceRepository.save).toHaveBeenCalledTimes(1);
    });

    it("説明なしでレビュースペースを作成できる", async () => {
      const result = await service.execute({
        projectId: validProjectId,
        name: "コードレビュー",
        userId: validUserId,
      });

      expect(result.name).toBe("コードレビュー");
      expect(result.description).toBeNull();
    });

    it("save()が正しい引数で呼ばれる", async () => {
      await service.execute({
        projectId: validProjectId,
        name: "テストスペース",
        description: "テスト説明",
        userId: validUserId,
      });

      expect(mockReviewSpaceRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          _name: expect.objectContaining({ _value: "テストスペース" }),
          _description: expect.objectContaining({ _value: "テスト説明" }),
        }),
      );
    });
  });

  describe("異常系", () => {
    it("存在しないプロジェクトの場合はエラー", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      await expect(
        service.execute({
          projectId: validProjectId,
          name: "テストスペース",
          userId: validUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_NOT_FOUND" });
    });

    it("プロジェクトにアクセス権がない場合はエラー", async () => {
      const otherUserId = "323e4567-e89b-12d3-a456-426614174002";

      await expect(
        service.execute({
          projectId: validProjectId,
          name: "テストスペース",
          userId: otherUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_ACCESS_DENIED" });
    });

    it("スペース名が空の場合はエラー", async () => {
      await expect(
        service.execute({
          projectId: validProjectId,
          name: "",
          userId: validUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "REVIEW_SPACE_NAME_EMPTY" });
    });

    it("スペース名が長すぎる場合はエラー", async () => {
      await expect(
        service.execute({
          projectId: validProjectId,
          name: "あ".repeat(101),
          userId: validUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "REVIEW_SPACE_NAME_TOO_LONG" });
    });

    it("説明が長すぎる場合はエラー", async () => {
      await expect(
        service.execute({
          projectId: validProjectId,
          name: "テスト",
          description: "あ".repeat(1001),
          userId: validUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "REVIEW_SPACE_DESCRIPTION_TOO_LONG" });
    });

    it("リポジトリでエラーが発生した場合はスロー", async () => {
      vi.mocked(mockReviewSpaceRepository.save).mockRejectedValue(
        new Error("DB Error"),
      );

      await expect(
        service.execute({
          projectId: validProjectId,
          name: "テストスペース",
          userId: validUserId,
        }),
      ).rejects.toThrow("DB Error");
    });
  });
});
