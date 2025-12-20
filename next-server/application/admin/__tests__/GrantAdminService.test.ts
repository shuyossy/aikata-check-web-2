import { describe, it, expect, beforeEach, vi } from "vitest";
import { GrantAdminService, GrantAdminCommand } from "../GrantAdminService";
import { IUserRepository } from "@/application/shared/port/repository";
import { User } from "@/domain/user";

describe("GrantAdminService", () => {
  let mockUserRepository: IUserRepository;
  let grantAdminService: GrantAdminService;

  const fixedDate = new Date("2024-01-01T00:00:00.000Z");
  // 有効なUUID形式
  const validUserId = "550e8400-e29b-41d4-a716-446655440000";
  const validAdminId = "550e8400-e29b-41d4-a716-446655440001";

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

    grantAdminService = new GrantAdminService(mockUserRepository);
  });

  describe("execute - 正常系", () => {
    it("一般ユーザに管理者権限を付与できる", async () => {
      // Arrange
      const user = User.reconstruct({
        id: validUserId,
        employeeId: "EMP001",
        displayName: "山田太郎",
        isAdmin: false,
        createdAt: fixedDate,
        updatedAt: fixedDate,
      });
      const command: GrantAdminCommand = { targetUserId: validUserId };
      vi.mocked(mockUserRepository.findById).mockResolvedValue(user);
      vi.mocked(mockUserRepository.save).mockResolvedValue(undefined);

      // Act
      const result = await grantAdminService.execute(command);

      // Assert
      expect(result.isAdmin).toBe(true);
      expect(result.id).toBe(validUserId);
      expect(mockUserRepository.findById).toHaveBeenCalledTimes(1);
      expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
      const savedUser = vi.mocked(mockUserRepository.save).mock.calls[0][0];
      expect(savedUser.isAdmin).toBe(true);
    });
  });

  describe("execute - 異常系", () => {
    it("存在しないユーザIDの場合はエラー", async () => {
      // Arrange
      const command: GrantAdminCommand = { targetUserId: validUserId };
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null);

      // Act & Assert
      await expect(grantAdminService.execute(command)).rejects.toMatchObject({
        messageCode: "ADMIN_NOT_FOUND",
      });
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it("既に管理者のユーザの場合はエラー", async () => {
      // Arrange
      const adminUser = User.reconstruct({
        id: validAdminId,
        employeeId: "EMP001",
        displayName: "管理者",
        isAdmin: true,
        createdAt: fixedDate,
        updatedAt: fixedDate,
      });
      const command: GrantAdminCommand = { targetUserId: validAdminId };
      vi.mocked(mockUserRepository.findById).mockResolvedValue(adminUser);

      // Act & Assert
      await expect(grantAdminService.execute(command)).rejects.toMatchObject({
        messageCode: "ADMIN_ALREADY_EXISTS",
      });
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it("不正なUUID形式のユーザIDの場合はエラー", async () => {
      // Arrange
      const command: GrantAdminCommand = { targetUserId: "invalid-id" };

      // Act & Assert
      await expect(grantAdminService.execute(command)).rejects.toMatchObject({
        messageCode: "USER_ID_INVALID_FORMAT",
      });
      expect(mockUserRepository.findById).not.toHaveBeenCalled();
    });
  });
});
