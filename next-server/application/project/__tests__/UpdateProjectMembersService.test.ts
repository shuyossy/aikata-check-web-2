import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpdateProjectMembersService } from "../UpdateProjectMembersService";
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

describe("UpdateProjectMembersService", () => {
  let mockProjectRepository: IProjectRepository;
  let mockUserRepository: IUserRepository;
  let service: UpdateProjectMembersService;

  const validProjectId = "323e4567-e89b-12d3-a456-426614174002";
  const validMemberId = "123e4567-e89b-12d3-a456-426614174000";
  const validMemberId2 = "223e4567-e89b-12d3-a456-426614174001";
  const validMemberId3 = "423e4567-e89b-12d3-a456-426614174003";

  const createMockProject = (memberIds: string[] = [validMemberId]) => {
    return Project.reconstruct({
      id: validProjectId,
      name: "テストプロジェクト",
      description: "テスト説明",
      encryptedApiKey: null,
      members: memberIds.map((userId) => ({
        userId,
        createdAt: new Date(),
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  const createMockUser = (
    id: string,
    employeeId: string,
    displayName: string,
  ) =>
    User.reconstruct({
      id,
      employeeId,
      displayName,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

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
      findByIds: vi.fn(),
      searchUsers: vi.fn(),
      countSearchUsers: vi.fn(),
      save: vi.fn(),
    };
    service = new UpdateProjectMembersService(
      mockProjectRepository,
      mockUserRepository,
    );
  });

  describe("正常系", () => {
    it("メンバーを追加できる", async () => {
      const mockProject = createMockProject([validMemberId]);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject);
      vi.mocked(mockUserRepository.findByIds).mockResolvedValue([
        createMockUser(validMemberId, "EMP001", "テストユーザー1"),
        createMockUser(validMemberId2, "EMP002", "テストユーザー2"),
      ]);

      const result = await service.execute({
        projectId: validProjectId,
        userId: validMemberId,
        memberIds: [validMemberId, validMemberId2],
      });

      expect(result.members).toHaveLength(2);
      expect(mockProjectRepository.save).toHaveBeenCalledTimes(1);
    });

    it("メンバーを削除できる", async () => {
      const mockProject = createMockProject([validMemberId, validMemberId2]);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject);
      vi.mocked(mockUserRepository.findByIds).mockResolvedValue([
        createMockUser(validMemberId, "EMP001", "テストユーザー1"),
      ]);

      const result = await service.execute({
        projectId: validProjectId,
        userId: validMemberId,
        memberIds: [validMemberId],
      });

      expect(result.members).toHaveLength(1);
      expect(result.members[0].userId).toBe(validMemberId);
    });

    it("メンバーを置換できる", async () => {
      const mockProject = createMockProject([validMemberId, validMemberId2]);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject);
      vi.mocked(mockUserRepository.findByIds).mockResolvedValue([
        createMockUser(validMemberId, "EMP001", "テストユーザー1"),
        createMockUser(validMemberId3, "EMP003", "テストユーザー3"),
      ]);

      const result = await service.execute({
        projectId: validProjectId,
        userId: validMemberId,
        memberIds: [validMemberId, validMemberId3],
      });

      expect(result.members).toHaveLength(2);
      const memberUserIds = result.members.map((m) => m.userId);
      expect(memberUserIds).toContain(validMemberId);
      expect(memberUserIds).toContain(validMemberId3);
      expect(memberUserIds).not.toContain(validMemberId2);
    });

    it("ユーザ情報が正しくマッピングされる", async () => {
      const mockProject = createMockProject([validMemberId]);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject);
      vi.mocked(mockUserRepository.findByIds).mockResolvedValue([
        createMockUser(validMemberId, "EMP001", "山田太郎"),
      ]);

      const result = await service.execute({
        projectId: validProjectId,
        userId: validMemberId,
        memberIds: [validMemberId],
      });

      expect(result.members[0].displayName).toBe("山田太郎");
      expect(result.members[0].employeeId).toBe("EMP001");
    });
  });

  describe("異常系", () => {
    it("プロジェクトが存在しない場合はエラー", async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      await expect(
        service.execute({
          projectId: validProjectId,
          userId: validMemberId,
          memberIds: [validMemberId],
        }),
      ).rejects.toThrow();
    });

    it("メンバーでないユーザがアクセスした場合はエラー", async () => {
      const mockProject = createMockProject([validMemberId]);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject);

      await expect(
        service.execute({
          projectId: validProjectId,
          userId: validMemberId2, // メンバーでないユーザ
          memberIds: [validMemberId],
        }),
      ).rejects.toThrow();
    });

    it("メンバーリストが空の場合はエラー", async () => {
      const mockProject = createMockProject([validMemberId]);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject);

      await expect(
        service.execute({
          projectId: validProjectId,
          userId: validMemberId,
          memberIds: [], // 空のメンバーリスト
        }),
      ).rejects.toThrow();
    });

    it("リポジトリでエラーが発生した場合はスロー", async () => {
      const mockProject = createMockProject([validMemberId]);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject);
      vi.mocked(mockProjectRepository.save).mockRejectedValue(
        new Error("DB Error"),
      );

      await expect(
        service.execute({
          projectId: validProjectId,
          userId: validMemberId,
          memberIds: [validMemberId],
        }),
      ).rejects.toThrow("DB Error");
    });

    it("ユーザ取得でエラーが発生した場合はスロー", async () => {
      const mockProject = createMockProject([validMemberId]);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject);
      vi.mocked(mockUserRepository.findByIds).mockRejectedValue(
        new Error("User Fetch Error"),
      );

      await expect(
        service.execute({
          projectId: validProjectId,
          userId: validMemberId,
          memberIds: [validMemberId],
        }),
      ).rejects.toThrow("User Fetch Error");
    });
  });
});
