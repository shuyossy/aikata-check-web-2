import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetProjectService } from "../GetProjectService";
import {
  IProjectRepository,
  IUserRepository,
} from "@/application/shared/port/repository";
import { Project } from "@/domain/project";
import { User } from "@/domain/user";

// 暗号化関数をモック
vi.mock("@/lib/server/encryption", () => ({
  encrypt: vi.fn((text: string) => `encrypted_${text}`),
  decrypt: vi.fn((text: string) => text.replace("encrypted_", "")),
}));

describe("GetProjectService", () => {
  let mockProjectRepository: IProjectRepository;
  let mockUserRepository: IUserRepository;
  let service: GetProjectService;

  const validProjectId = "323e4567-e89b-12d3-a456-426614174002";
  const validMemberId = "123e4567-e89b-12d3-a456-426614174000";
  const nonMemberId = "223e4567-e89b-12d3-a456-426614174001";

  const createMockProject = () => {
    const now = new Date();
    return Project.reconstruct({
      id: validProjectId,
      name: "テストプロジェクト",
      description: "テスト説明",
      encryptedApiKey: "encrypted_key",
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
    mockUserRepository = {
      findByEmployeeId: vi.fn(),
      findById: vi.fn(),
      findByIds: vi.fn().mockResolvedValue([
        User.reconstruct({
          id: validMemberId,
          employeeId: "EMP001",
          displayName: "テストユーザー",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ]),
      searchUsers: vi.fn(),
      countSearchUsers: vi.fn(),
      save: vi.fn(),
    };
    service = new GetProjectService(mockProjectRepository, mockUserRepository);
  });

  describe("正常系", () => {
    it("プロジェクトを取得できる", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        createMockProject(),
      );

      const result = await service.execute({
        projectId: validProjectId,
        userId: validMemberId,
      });

      expect(result.id).toBe(validProjectId);
      expect(result.name).toBe("テストプロジェクト");
      expect(result.description).toBe("テスト説明");
      expect(result.hasApiKey).toBe(true);
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
      ).rejects.toThrow();
    });

    it("メンバーでないユーザはアクセスできない", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        createMockProject(),
      );

      await expect(
        service.execute({
          projectId: validProjectId,
          userId: nonMemberId,
        }),
      ).rejects.toThrow();
    });

    it("プロジェクトIDが不正な形式の場合はエラー", async () => {
      await expect(
        service.execute({
          projectId: "invalid-id",
          userId: validMemberId,
        }),
      ).rejects.toThrow();
    });
  });
});
