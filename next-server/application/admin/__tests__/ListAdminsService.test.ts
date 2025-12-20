import { describe, it, expect, beforeEach, vi } from "vitest";
import { ListAdminsService } from "../ListAdminsService";
import { IUserRepository } from "@/application/shared/port/repository";
import { User } from "@/domain/user";

describe("ListAdminsService", () => {
  let mockUserRepository: IUserRepository;
  let listAdminsService: ListAdminsService;

  const fixedDate = new Date("2024-01-01T00:00:00.000Z");
  // 有効なUUID形式
  const validAdminId1 = "550e8400-e29b-41d4-a716-446655440001";
  const validAdminId2 = "550e8400-e29b-41d4-a716-446655440002";

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

    listAdminsService = new ListAdminsService(mockUserRepository);
  });

  describe("execute - 正常系", () => {
    it("管理者一覧を取得できる", async () => {
      // Arrange
      const admins = [
        User.reconstruct({
          id: validAdminId1,
          employeeId: "EMP001",
          displayName: "管理者1",
          isAdmin: true,
          createdAt: fixedDate,
          updatedAt: fixedDate,
        }),
        User.reconstruct({
          id: validAdminId2,
          employeeId: "EMP002",
          displayName: "管理者2",
          isAdmin: true,
          createdAt: fixedDate,
          updatedAt: fixedDate,
        }),
      ];
      vi.mocked(mockUserRepository.findAllAdmins).mockResolvedValue(admins);

      // Act
      const result = await listAdminsService.execute();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(validAdminId1);
      expect(result[0].displayName).toBe("管理者1");
      expect(result[0].isAdmin).toBe(true);
      expect(result[1].id).toBe(validAdminId2);
      expect(mockUserRepository.findAllAdmins).toHaveBeenCalledTimes(1);
    });

    it("管理者がいない場合は空配列を返す", async () => {
      // Arrange
      vi.mocked(mockUserRepository.findAllAdmins).mockResolvedValue([]);

      // Act
      const result = await listAdminsService.execute();

      // Assert
      expect(result).toHaveLength(0);
    });
  });
});
