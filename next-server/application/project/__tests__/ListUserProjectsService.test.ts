import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListUserProjectsService } from "../ListUserProjectsService";
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

describe("ListUserProjectsService", () => {
  let mockProjectRepository: IProjectRepository;
  let mockUserRepository: IUserRepository;
  let service: ListUserProjectsService;

  const validMemberId = "123e4567-e89b-12d3-a456-426614174000";

  const createMockProject = (id: string, name: string) => {
    const now = new Date();
    return Project.reconstruct({
      id,
      name,
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
    service = new ListUserProjectsService(
      mockProjectRepository,
      mockUserRepository,
    );
  });

  describe("正常系", () => {
    it("プロジェクト一覧を取得できる", async () => {
      const mockProjects = [
        createMockProject(
          "323e4567-e89b-12d3-a456-426614174002",
          "プロジェクト1",
        ),
        createMockProject(
          "423e4567-e89b-12d3-a456-426614174003",
          "プロジェクト2",
        ),
      ];
      vi.mocked(mockProjectRepository.findByMemberId).mockResolvedValue(
        mockProjects,
      );
      vi.mocked(mockProjectRepository.countByMemberId).mockResolvedValue(2);

      const result = await service.execute({
        userId: validMemberId,
      });

      expect(result.projects).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(12);
    });

    it("検索キーワードで絞り込める", async () => {
      vi.mocked(mockProjectRepository.findByMemberId).mockResolvedValue([]);
      vi.mocked(mockProjectRepository.countByMemberId).mockResolvedValue(0);

      await service.execute({
        userId: validMemberId,
        search: "テスト",
      });

      expect(mockProjectRepository.findByMemberId).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ search: "テスト" }),
      );
    });

    it("ページネーションが機能する", async () => {
      vi.mocked(mockProjectRepository.findByMemberId).mockResolvedValue([]);
      vi.mocked(mockProjectRepository.countByMemberId).mockResolvedValue(50);

      const result = await service.execute({
        userId: validMemberId,
        page: 3,
        limit: 10,
      });

      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      expect(mockProjectRepository.findByMemberId).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ offset: 20, limit: 10 }),
      );
    });

    it("空の結果を返せる", async () => {
      vi.mocked(mockProjectRepository.findByMemberId).mockResolvedValue([]);
      vi.mocked(mockProjectRepository.countByMemberId).mockResolvedValue(0);

      const result = await service.execute({
        userId: validMemberId,
      });

      expect(result.projects).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("limitの上限が適用される", async () => {
      vi.mocked(mockProjectRepository.findByMemberId).mockResolvedValue([]);
      vi.mocked(mockProjectRepository.countByMemberId).mockResolvedValue(0);

      await service.execute({
        userId: validMemberId,
        limit: 200, // 上限100を超える値
      });

      expect(mockProjectRepository.findByMemberId).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ limit: 100 }),
      );
    });

    it("ページ番号が0以下の場合は1に正規化される", async () => {
      vi.mocked(mockProjectRepository.findByMemberId).mockResolvedValue([]);
      vi.mocked(mockProjectRepository.countByMemberId).mockResolvedValue(0);

      const result = await service.execute({
        userId: validMemberId,
        page: 0,
      });

      expect(result.page).toBe(1);
      expect(mockProjectRepository.findByMemberId).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ offset: 0 }),
      );
    });

    it("limitが0以下の場合は1に正規化される", async () => {
      vi.mocked(mockProjectRepository.findByMemberId).mockResolvedValue([]);
      vi.mocked(mockProjectRepository.countByMemberId).mockResolvedValue(0);

      const result = await service.execute({
        userId: validMemberId,
        limit: -5,
      });

      expect(result.limit).toBe(1);
    });
  });

  describe("異常系", () => {
    it("プロジェクトリポジトリでエラーが発生した場合はスロー", async () => {
      vi.mocked(mockProjectRepository.findByMemberId).mockRejectedValue(
        new Error("DB Error"),
      );

      await expect(
        service.execute({
          userId: validMemberId,
        }),
      ).rejects.toThrow("DB Error");
    });

    it("カウント処理でエラーが発生した場合はスロー", async () => {
      vi.mocked(mockProjectRepository.findByMemberId).mockResolvedValue([]);
      vi.mocked(mockProjectRepository.countByMemberId).mockRejectedValue(
        new Error("Count Error"),
      );

      await expect(
        service.execute({
          userId: validMemberId,
        }),
      ).rejects.toThrow("Count Error");
    });

    it("ユーザ情報取得でエラーが発生した場合はスロー", async () => {
      vi.mocked(mockProjectRepository.findByMemberId).mockResolvedValue([
        createMockProject(
          "323e4567-e89b-12d3-a456-426614174002",
          "プロジェクト1",
        ),
      ]);
      vi.mocked(mockProjectRepository.countByMemberId).mockResolvedValue(1);
      vi.mocked(mockUserRepository.findByIds).mockRejectedValue(
        new Error("User Fetch Error"),
      );

      await expect(
        service.execute({
          userId: validMemberId,
        }),
      ).rejects.toThrow("User Fetch Error");
    });
  });
});
