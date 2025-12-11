import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeleteProjectService } from "../DeleteProjectService";
import { IProjectRepository } from "@/application/shared/port/repository";
import { Project } from "@/domain/project";

// 暗号化関数をモック
vi.mock("@/lib/server/encryption", () => ({
  encrypt: vi.fn((text: string) => `encrypted_${text}`),
  decrypt: vi.fn((text: string) => text.replace("encrypted_", "")),
}));

describe("DeleteProjectService", () => {
  let mockProjectRepository: IProjectRepository;
  let service: DeleteProjectService;

  const validProjectId = "323e4567-e89b-12d3-a456-426614174002";
  const validMemberId = "123e4567-e89b-12d3-a456-426614174000";
  const nonMemberId = "223e4567-e89b-12d3-a456-426614174001";

  const createMockProject = () => {
    const now = new Date();
    return Project.reconstruct({
      id: validProjectId,
      name: "テストプロジェクト",
      description: null,
      encryptedApiKey: null,
      members: [{ userId: validMemberId, createdAt: now }],
      createdAt: now,
      updatedAt: now,
    });
  };

  beforeEach(() => {
    mockProjectRepository = {
      findById: vi.fn(),
      findByMemberId: vi.fn(),
      countByMemberId: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
    service = new DeleteProjectService(mockProjectRepository);
  });

  describe("正常系", () => {
    it("プロジェクトを削除できる", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        createMockProject(),
      );

      await service.execute({
        projectId: validProjectId,
        userId: validMemberId,
      });

      expect(mockProjectRepository.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe("異常系", () => {
    it("プロジェクトが存在しない場合はエラー", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      await expect(
        service.execute({
          projectId: validProjectId,
          userId: validMemberId,
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_NOT_FOUND" });
    });

    it("メンバーでないユーザは削除できない", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        createMockProject(),
      );

      await expect(
        service.execute({
          projectId: validProjectId,
          userId: nonMemberId,
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_ACCESS_DENIED" });
    });

    it("プロジェクトIDが不正な形式の場合はエラー", async () => {
      await expect(
        service.execute({
          projectId: "invalid-id",
          userId: validMemberId,
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_ID_INVALID_FORMAT" });
    });
  });
});
