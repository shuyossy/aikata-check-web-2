import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpdateProjectService } from "../UpdateProjectService";
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

describe("UpdateProjectService", () => {
  let mockProjectRepository: IProjectRepository;
  let mockUserRepository: IUserRepository;
  let service: UpdateProjectService;

  const validProjectId = "323e4567-e89b-12d3-a456-426614174002";
  const validMemberId = "123e4567-e89b-12d3-a456-426614174000";
  const nonMemberId = "223e4567-e89b-12d3-a456-426614174001";

  const createMockProject = () => {
    const now = new Date();
    return Project.reconstruct({
      id: validProjectId,
      name: "元の名前",
      description: "元の説明",
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
    service = new UpdateProjectService(mockProjectRepository, mockUserRepository);
  });

  describe("正常系", () => {
    it("プロジェクト名を更新できる", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        createMockProject(),
      );

      const result = await service.execute({
        projectId: validProjectId,
        userId: validMemberId,
        name: "新しい名前",
      });

      expect(result.name).toBe("新しい名前");
      expect(result.description).toBe("元の説明");
      expect(mockProjectRepository.save).toHaveBeenCalledTimes(1);
    });

    it("プロジェクト説明を更新できる", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        createMockProject(),
      );

      const result = await service.execute({
        projectId: validProjectId,
        userId: validMemberId,
        description: "新しい説明",
      });

      expect(result.name).toBe("元の名前");
      expect(result.description).toBe("新しい説明");
    });

    it("APIキーを更新できる", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        createMockProject(),
      );

      const result = await service.execute({
        projectId: validProjectId,
        userId: validMemberId,
        apiKey: "new-api-key",
      });

      expect(result.hasApiKey).toBe(true);
    });

    it("複数フィールドを同時に更新できる", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        createMockProject(),
      );

      const result = await service.execute({
        projectId: validProjectId,
        userId: validMemberId,
        name: "新しい名前",
        description: "新しい説明",
        apiKey: "new-key",
      });

      expect(result.name).toBe("新しい名前");
      expect(result.description).toBe("新しい説明");
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
          name: "新しい名前",
        }),
      ).rejects.toThrow();
    });

    it("メンバーでないユーザは更新できない", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        createMockProject(),
      );

      await expect(
        service.execute({
          projectId: validProjectId,
          userId: nonMemberId,
          name: "新しい名前",
        }),
      ).rejects.toThrow();
    });

    it("プロジェクト名が空の場合はエラー", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        createMockProject(),
      );

      await expect(
        service.execute({
          projectId: validProjectId,
          userId: validMemberId,
          name: "",
        }),
      ).rejects.toThrow();
    });
  });
});
