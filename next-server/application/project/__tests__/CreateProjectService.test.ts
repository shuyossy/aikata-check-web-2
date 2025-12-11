import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateProjectService } from "../CreateProjectService";
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

describe("CreateProjectService", () => {
  let mockProjectRepository: IProjectRepository;
  let mockUserRepository: IUserRepository;
  let service: CreateProjectService;

  const validMemberId = "123e4567-e89b-12d3-a456-426614174000";

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
    service = new CreateProjectService(
      mockProjectRepository,
      mockUserRepository,
    );
  });

  describe("正常系", () => {
    it("プロジェクトを作成できる", async () => {
      const result = await service.execute({
        name: "テストプロジェクト",
        description: "テスト説明",
        apiKey: "sk-test123",
        memberIds: [validMemberId],
      });

      expect(result.name).toBe("テストプロジェクト");
      expect(result.description).toBe("テスト説明");
      expect(result.hasApiKey).toBe(true);
      expect(result.members).toHaveLength(1);
      expect(mockProjectRepository.save).toHaveBeenCalledTimes(1);
    });

    it("説明とAPIキーなしでプロジェクトを作成できる", async () => {
      const result = await service.execute({
        name: "テストプロジェクト",
        memberIds: [validMemberId],
      });

      expect(result.name).toBe("テストプロジェクト");
      expect(result.description).toBeNull();
      expect(result.hasApiKey).toBe(false);
    });

    it("複数メンバーでプロジェクトを作成できる", async () => {
      const memberId2 = "223e4567-e89b-12d3-a456-426614174001";

      vi.mocked(mockUserRepository.findByIds).mockResolvedValue([
        User.reconstruct({
          id: validMemberId,
          employeeId: "EMP001",
          displayName: "テストユーザー1",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        User.reconstruct({
          id: memberId2,
          employeeId: "EMP002",
          displayName: "テストユーザー2",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ]);

      const result = await service.execute({
        name: "テストプロジェクト",
        memberIds: [validMemberId, memberId2],
      });

      expect(result.members).toHaveLength(2);
    });

    it("save()が正しい引数で呼ばれる", async () => {
      await service.execute({
        name: "テストプロジェクト",
        description: "テスト説明",
        apiKey: "sk-test123",
        memberIds: [validMemberId],
      });

      expect(mockProjectRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          _name: expect.objectContaining({ _value: "テストプロジェクト" }),
          _description: expect.objectContaining({ _value: "テスト説明" }),
        }),
      );
    });

    it("ユーザ情報が正しくマッピングされる", async () => {
      vi.mocked(mockUserRepository.findByIds).mockResolvedValue([
        User.reconstruct({
          id: validMemberId,
          employeeId: "EMP999",
          displayName: "マッピングテストユーザー",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ]);

      const result = await service.execute({
        name: "テストプロジェクト",
        memberIds: [validMemberId],
      });

      expect(result.members[0].displayName).toBe("マッピングテストユーザー");
      expect(result.members[0].employeeId).toBe("EMP999");
    });
  });

  describe("異常系", () => {
    it("プロジェクト名が空の場合はエラー", async () => {
      await expect(
        service.execute({
          name: "",
          memberIds: [validMemberId],
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_NAME_EMPTY" });
    });

    it("メンバーが空の場合はエラー", async () => {
      await expect(
        service.execute({
          name: "テストプロジェクト",
          memberIds: [],
        }),
      ).rejects.toMatchObject({ messageCode: "PROJECT_MEMBER_USER_NOT_FOUND" });
    });

    it("リポジトリでエラーが発生した場合はスロー", async () => {
      vi.mocked(mockProjectRepository.save).mockRejectedValue(
        new Error("DB Error"),
      );

      await expect(
        service.execute({
          name: "テストプロジェクト",
          memberIds: [validMemberId],
        }),
      ).rejects.toThrow("DB Error");
    });
  });
});
