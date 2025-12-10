import { describe, it, expect, vi, beforeEach } from "vitest";
import { SearchUsersService } from "../SearchUsersService";
import { IUserRepository } from "@/application/shared/port/repository";
import { User } from "@/domain/user";

describe("SearchUsersService", () => {
  let mockUserRepository: IUserRepository;
  let service: SearchUsersService;

  const validMemberId = "123e4567-e89b-12d3-a456-426614174000";
  const validMemberId2 = "223e4567-e89b-12d3-a456-426614174001";

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
    mockUserRepository = {
      findByEmployeeId: vi.fn(),
      findById: vi.fn(),
      findByIds: vi.fn(),
      searchUsers: vi.fn(),
      countSearchUsers: vi.fn(),
      save: vi.fn(),
    };
    service = new SearchUsersService(mockUserRepository);
  });

  describe("正常系", () => {
    it("検索キーワードでユーザを検索できる", async () => {
      vi.mocked(mockUserRepository.searchUsers).mockResolvedValue([
        createMockUser(validMemberId, "EMP001", "山田太郎"),
      ]);
      vi.mocked(mockUserRepository.countSearchUsers).mockResolvedValue(1);

      const result = await service.execute({
        query: "山田",
      });

      expect(result.users).toHaveLength(1);
      expect(result.users[0].displayName).toBe("山田太郎");
      expect(result.total).toBe(1);
      expect(mockUserRepository.searchUsers).toHaveBeenCalledWith("山田", {
        limit: 10,
        offset: 0,
      });
    });

    it("複数のユーザを検索できる", async () => {
      vi.mocked(mockUserRepository.searchUsers).mockResolvedValue([
        createMockUser(validMemberId, "EMP001", "山田太郎"),
        createMockUser(validMemberId2, "EMP002", "山田花子"),
      ]);
      vi.mocked(mockUserRepository.countSearchUsers).mockResolvedValue(2);

      const result = await service.execute({
        query: "山田",
      });

      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("検索結果が0件の場合は空配列を返す", async () => {
      vi.mocked(mockUserRepository.searchUsers).mockResolvedValue([]);
      vi.mocked(mockUserRepository.countSearchUsers).mockResolvedValue(0);

      const result = await service.execute({
        query: "存在しないユーザ",
      });

      expect(result.users).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("ページ番号を指定して検索できる", async () => {
      vi.mocked(mockUserRepository.searchUsers).mockResolvedValue([
        createMockUser(validMemberId, "EMP001", "テストユーザー"),
      ]);
      vi.mocked(mockUserRepository.countSearchUsers).mockResolvedValue(15);

      const result = await service.execute({
        query: "テスト",
        page: 2,
        limit: 10,
      });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(mockUserRepository.searchUsers).toHaveBeenCalledWith("テスト", {
        limit: 10,
        offset: 10,
      });
    });

    it("limit数を指定して検索できる", async () => {
      vi.mocked(mockUserRepository.searchUsers).mockResolvedValue([
        createMockUser(validMemberId, "EMP001", "テストユーザー"),
      ]);
      vi.mocked(mockUserRepository.countSearchUsers).mockResolvedValue(100);

      const result = await service.execute({
        query: "テスト",
        limit: 5,
      });

      expect(result.limit).toBe(5);
      expect(mockUserRepository.searchUsers).toHaveBeenCalledWith("テスト", {
        limit: 5,
        offset: 0,
      });
    });
  });

  describe("ページネーション正規化", () => {
    it("ページ番号が0以下の場合は1に正規化される", async () => {
      vi.mocked(mockUserRepository.searchUsers).mockResolvedValue([]);
      vi.mocked(mockUserRepository.countSearchUsers).mockResolvedValue(0);

      const result = await service.execute({
        query: "テスト",
        page: 0,
      });

      expect(result.page).toBe(1);
      expect(mockUserRepository.searchUsers).toHaveBeenCalledWith("テスト", {
        limit: 10,
        offset: 0,
      });
    });

    it("負のページ番号は1に正規化される", async () => {
      vi.mocked(mockUserRepository.searchUsers).mockResolvedValue([]);
      vi.mocked(mockUserRepository.countSearchUsers).mockResolvedValue(0);

      const result = await service.execute({
        query: "テスト",
        page: -5,
      });

      expect(result.page).toBe(1);
    });

    it("limitが最大値を超える場合は最大値に制限される", async () => {
      vi.mocked(mockUserRepository.searchUsers).mockResolvedValue([]);
      vi.mocked(mockUserRepository.countSearchUsers).mockResolvedValue(0);

      const result = await service.execute({
        query: "テスト",
        limit: 1000, // 最大値50を超える
      });

      expect(result.limit).toBe(50); // MAX_LIMITは50
      expect(mockUserRepository.searchUsers).toHaveBeenCalledWith("テスト", {
        limit: 50,
        offset: 0,
      });
    });

    it("limitが0以下の場合は1に正規化される", async () => {
      vi.mocked(mockUserRepository.searchUsers).mockResolvedValue([]);
      vi.mocked(mockUserRepository.countSearchUsers).mockResolvedValue(0);

      const result = await service.execute({
        query: "テスト",
        limit: 0,
      });

      expect(result.limit).toBe(1);
    });
  });

  describe("異常系", () => {
    it("リポジトリでエラーが発生した場合はスロー", async () => {
      vi.mocked(mockUserRepository.searchUsers).mockRejectedValue(
        new Error("Search Error"),
      );

      await expect(
        service.execute({
          query: "テスト",
        }),
      ).rejects.toThrow("Search Error");
    });

    it("カウント処理でエラーが発生した場合はスロー", async () => {
      vi.mocked(mockUserRepository.searchUsers).mockResolvedValue([]);
      vi.mocked(mockUserRepository.countSearchUsers).mockRejectedValue(
        new Error("Count Error"),
      );

      await expect(
        service.execute({
          query: "テスト",
        }),
      ).rejects.toThrow("Count Error");
    });
  });
});
