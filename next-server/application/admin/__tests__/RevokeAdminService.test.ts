import { describe, it, expect, beforeEach, vi } from "vitest";
import { RevokeAdminService, RevokeAdminCommand } from "../RevokeAdminService";
import { IUserRepository } from "@/application/shared/port/repository";
import { User } from "@/domain/user";

describe("RevokeAdminService", () => {
  let mockUserRepository: IUserRepository;
  let revokeAdminService: RevokeAdminService;

  const fixedDate = new Date("2024-01-01T00:00:00.000Z");
  // 有効なUUID形式
  const validAdminId1 = "550e8400-e29b-41d4-a716-446655440001";
  const validAdminId2 = "550e8400-e29b-41d4-a716-446655440002";
  const validUserId = "550e8400-e29b-41d4-a716-446655440003";

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

    revokeAdminService = new RevokeAdminService(mockUserRepository);
  });

  describe("execute - 正常系", () => {
    it("管理者権限を削除できる（複数の管理者がいる場合）", async () => {
      // Arrange
      const adminUser = User.reconstruct({
        id: validAdminId1,
        employeeId: "EMP001",
        displayName: "管理者1",
        isAdmin: true,
        createdAt: fixedDate,
        updatedAt: fixedDate,
      });
      const command: RevokeAdminCommand = {
        targetUserId: validAdminId1,
        executorUserId: validAdminId2,
      };
      vi.mocked(mockUserRepository.findById).mockResolvedValue(adminUser);
      vi.mocked(mockUserRepository.countAdmins).mockResolvedValue(2);
      vi.mocked(mockUserRepository.save).mockResolvedValue(undefined);

      // Act
      await revokeAdminService.execute(command);

      // Assert
      expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
      const savedUser = vi.mocked(mockUserRepository.save).mock.calls[0][0];
      expect(savedUser.isAdmin).toBe(false);
    });
  });

  describe("execute - 異常系", () => {
    it("無効なUUID形式のユーザIDの場合はエラー", async () => {
      // Arrange
      const command: RevokeAdminCommand = {
        targetUserId: "invalid-uuid",
        executorUserId: validAdminId2,
      };

      // Act & Assert
      await expect(revokeAdminService.execute(command)).rejects.toMatchObject({
        messageCode: "USER_ID_INVALID_FORMAT",
      });
      expect(mockUserRepository.findById).not.toHaveBeenCalled();
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it("存在しないユーザIDの場合はエラー", async () => {
      // Arrange
      const command: RevokeAdminCommand = {
        targetUserId: validUserId,
        executorUserId: validAdminId2,
      };
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null);

      // Act & Assert
      await expect(revokeAdminService.execute(command)).rejects.toMatchObject({
        messageCode: "ADMIN_NOT_FOUND",
      });
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it("管理者でないユーザの場合はエラー", async () => {
      // Arrange
      const normalUser = User.reconstruct({
        id: validUserId,
        employeeId: "EMP001",
        displayName: "一般ユーザ",
        isAdmin: false,
        createdAt: fixedDate,
        updatedAt: fixedDate,
      });
      const command: RevokeAdminCommand = {
        targetUserId: validUserId,
        executorUserId: validAdminId2,
      };
      vi.mocked(mockUserRepository.findById).mockResolvedValue(normalUser);

      // Act & Assert
      await expect(revokeAdminService.execute(command)).rejects.toMatchObject({
        messageCode: "ADMIN_NOT_FOUND",
      });
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it("自分自身の権限を削除しようとした場合はエラー", async () => {
      // Arrange
      const adminUser = User.reconstruct({
        id: validAdminId1,
        employeeId: "EMP001",
        displayName: "管理者",
        isAdmin: true,
        createdAt: fixedDate,
        updatedAt: fixedDate,
      });
      const command: RevokeAdminCommand = {
        targetUserId: validAdminId1,
        executorUserId: validAdminId1, // 同じID
      };
      vi.mocked(mockUserRepository.findById).mockResolvedValue(adminUser);

      // Act & Assert
      await expect(revokeAdminService.execute(command)).rejects.toMatchObject({
        messageCode: "ADMIN_CANNOT_REVOKE_SELF",
      });
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it("最後の管理者の権限を削除しようとした場合はエラー", async () => {
      // Arrange
      const adminUser = User.reconstruct({
        id: validAdminId1,
        employeeId: "EMP001",
        displayName: "管理者",
        isAdmin: true,
        createdAt: fixedDate,
        updatedAt: fixedDate,
      });
      const command: RevokeAdminCommand = {
        targetUserId: validAdminId1,
        executorUserId: validAdminId2,
      };
      vi.mocked(mockUserRepository.findById).mockResolvedValue(adminUser);
      vi.mocked(mockUserRepository.countAdmins).mockResolvedValue(1); // 管理者は1人だけ

      // Act & Assert
      await expect(revokeAdminService.execute(command)).rejects.toMatchObject({
        messageCode: "ADMIN_LAST_ADMIN_CANNOT_REVOKE",
      });
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });
  });
});
