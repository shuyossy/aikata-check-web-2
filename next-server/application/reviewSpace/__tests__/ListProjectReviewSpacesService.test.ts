import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListProjectReviewSpacesService } from "../ListProjectReviewSpacesService";
import { IReviewSpaceRepository } from "@/application/shared/port/repository/IReviewSpaceRepository";
import { IProjectRepository } from "@/application/shared/port/repository";
import { Project } from "@/domain/project";
import { ReviewSpace } from "@/domain/reviewSpace";

// 暗号化関数をモック
vi.mock("@/lib/server/encryption", () => ({
  encrypt: vi.fn((text: string) => `encrypted_${text}`),
  decrypt: vi.fn((text: string) => text.replace("encrypted_", "")),
}));

describe("ListProjectReviewSpacesService", () => {
  let mockReviewSpaceRepository: IReviewSpaceRepository;
  let mockProjectRepository: IProjectRepository;
  let service: ListProjectReviewSpacesService;

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

  const mockReviewSpace1 = ReviewSpace.reconstruct({
    id: "323e4567-e89b-12d3-a456-426614174002",
    projectId: validProjectId,
    name: "設計書レビュー",
    description: "設計書のレビュー",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-06-01"),
  });

  const mockReviewSpace2 = ReviewSpace.reconstruct({
    id: "423e4567-e89b-12d3-a456-426614174003",
    projectId: validProjectId,
    name: "コードレビュー",
    description: null,
    createdAt: new Date("2024-02-01"),
    updatedAt: new Date("2024-05-01"),
  });

  beforeEach(() => {
    mockReviewSpaceRepository = {
      findById: vi.fn(),
      findByProjectId: vi.fn().mockResolvedValue([mockReviewSpace1, mockReviewSpace2]),
      countByProjectId: vi.fn().mockResolvedValue(2),
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
    service = new ListProjectReviewSpacesService(
      mockReviewSpaceRepository,
      mockProjectRepository,
    );
  });

  describe("正常系", () => {
    it("レビュースペース一覧を取得できる", async () => {
      const result = await service.execute({
        projectId: validProjectId,
        userId: validUserId,
      });

      expect(result.spaces).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(12);
    });

    it("レビュースペースの情報が正しくDTOに変換される", async () => {
      const result = await service.execute({
        projectId: validProjectId,
        userId: validUserId,
      });

      expect(result.spaces[0].name).toBe("設計書レビュー");
      expect(result.spaces[0].description).toBe("設計書のレビュー");
      expect(result.spaces[1].name).toBe("コードレビュー");
      expect(result.spaces[1].description).toBeNull();
    });

    it("ページネーションが正しく適用される", async () => {
      await service.execute({
        projectId: validProjectId,
        userId: validUserId,
        page: 2,
        limit: 5,
      });

      expect(mockReviewSpaceRepository.findByProjectId).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          limit: 5,
          offset: 5,
        }),
      );
    });

    it("検索キーワードが正しく適用される", async () => {
      await service.execute({
        projectId: validProjectId,
        userId: validUserId,
        search: "設計",
      });

      expect(mockReviewSpaceRepository.findByProjectId).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          search: "設計",
        }),
      );
      expect(mockReviewSpaceRepository.countByProjectId).toHaveBeenCalledWith(
        expect.anything(),
        "設計",
      );
    });

    it("空の結果を正しく返す", async () => {
      vi.mocked(mockReviewSpaceRepository.findByProjectId).mockResolvedValue([]);
      vi.mocked(mockReviewSpaceRepository.countByProjectId).mockResolvedValue(0);

      const result = await service.execute({
        projectId: validProjectId,
        userId: validUserId,
      });

      expect(result.spaces).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("異常系", () => {
    it("存在しないプロジェクトの場合はエラー", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      await expect(
        service.execute({
          projectId: validProjectId,
          userId: validUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_NOT_FOUND" });
    });

    it("プロジェクトにアクセス権がない場合はエラー", async () => {
      const otherUserId = "523e4567-e89b-12d3-a456-426614174004";

      await expect(
        service.execute({
          projectId: validProjectId,
          userId: otherUserId,
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_ACCESS_DENIED" });
    });

    it("リポジトリでエラーが発生した場合はスロー", async () => {
      vi.mocked(mockReviewSpaceRepository.findByProjectId).mockRejectedValue(
        new Error("DB Error"),
      );

      await expect(
        service.execute({
          projectId: validProjectId,
          userId: validUserId,
        }),
      ).rejects.toThrow("DB Error");
    });
  });
});
