import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ListAllUsersService,
  ListAllUsersQuery,
} from "../ListAllUsersService";
import { IUserRepository } from "@/application/shared/port/repository";
import { User } from "@/domain/user";

describe("ListAllUsersService", () => {
  let mockUserRepository: IUserRepository;
  let listAllUsersService: ListAllUsersService;

  const fixedDate = new Date("2024-01-01T00:00:00.000Z");
  // 有効なUUID形式
  const validUserId1 = "550e8400-e29b-41d4-a716-446655440001";
  const validAdminId1 = "550e8400-e29b-41d4-a716-446655440002";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);

    mockUserRepository = {
      findByEmployeeId: vi.fn(),
      findById: vi.fn(),
      findByIds: vi.fn(),
      searchUsers: vi.fn(),
      countSearchUsers: vi.fn(),
      save: vi.fn(),
      findAllAdmins: vi.fn(),
      countAdmins: vi.fn(),
      findAll: vi.fn(),
      countAll: vi.fn(),
    };

    listAllUsersService = new ListAllUsersService(mockUserRepository);
  });

  describe("execute - 正常系", () => {
    it("全ユーザ一覧を取得できる", async () => {
      // Arrange
      const users = [
        User.reconstruct({
          id: validUserId1,
          employeeId: "EMP001",
          displayName: "ユーザ1",
          isAdmin: false,
          createdAt: fixedDate,
          updatedAt: fixedDate,
        }),
        User.reconstruct({
          id: validAdminId1,
          employeeId: "EMP002",
          displayName: "管理者1",
          isAdmin: true,
          createdAt: fixedDate,
          updatedAt: fixedDate,
        }),
      ];
      vi.mocked(mockUserRepository.findAll).mockResolvedValue(users);
      vi.mocked(mockUserRepository.countAll).mockResolvedValue(2);

      // Act
      const result = await listAllUsersService.execute({});

      // Assert
      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.users[0].displayName).toBe("ユーザ1");
      expect(result.users[0].isAdmin).toBe(false);
      expect(result.users[1].displayName).toBe("管理者1");
      expect(result.users[1].isAdmin).toBe(true);
    });

    it("検索クエリ、ページネーションで絞り込みができる", async () => {
      // Arrange
      const query: ListAllUsersQuery = {
        query: "山田",
        limit: 10,
        offset: 0,
      };
      const users = [
        User.reconstruct({
          id: validUserId1,
          employeeId: "EMP001",
          displayName: "山田太郎",
          isAdmin: false,
          createdAt: fixedDate,
          updatedAt: fixedDate,
        }),
      ];
      vi.mocked(mockUserRepository.findAll).mockResolvedValue(users);
      vi.mocked(mockUserRepository.countAll).mockResolvedValue(1);

      // Act
      const result = await listAllUsersService.execute(query);

      // Assert
      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockUserRepository.findAll).toHaveBeenCalledWith({
        query: "山田",
        limit: 10,
        offset: 0,
      });
      expect(mockUserRepository.countAll).toHaveBeenCalledWith("山田");
    });

    it("ユーザがいない場合は空配列を返す", async () => {
      // Arrange
      vi.mocked(mockUserRepository.findAll).mockResolvedValue([]);
      vi.mocked(mockUserRepository.countAll).mockResolvedValue(0);

      // Act
      const result = await listAllUsersService.execute({});

      // Assert
      expect(result.users).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
