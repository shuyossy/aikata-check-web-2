import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AuthenticateUserService,
  AuthenticateUserCommand,
} from "../AuthenticateUserService";
import { IUserRepository } from "@/application/shared/port/repository";
import { IPasswordService } from "@/application/shared/port/service";
import { User } from "@/domain/user";

describe("AuthenticateUserService", () => {
  let mockUserRepository: IUserRepository;
  let mockPasswordService: IPasswordService;
  let authenticateUserService: AuthenticateUserService;

  // テスト用の固定日時
  const fixedDate = new Date("2024-01-01T00:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);

    // リポジトリのモック
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

    // パスワードサービスのモック
    mockPasswordService = {
      encrypt: vi.fn(),
      verify: vi.fn(),
    };

    authenticateUserService = new AuthenticateUserService(
      mockUserRepository,
      mockPasswordService,
    );
  });

  describe("execute - 正常系", () => {
    it("正しい社員IDとパスワードで認証に成功する", async () => {
      // Arrange
      const localUser = User.createLocalUser({
        employeeId: "PIT001",
        displayName: "山田太郎",
        passwordHash: "encrypted_hash",
      });
      const command: AuthenticateUserCommand = {
        employeeId: "PIT001",
        password: "password123",
      };
      vi.mocked(mockUserRepository.findByEmployeeId).mockResolvedValue(
        localUser,
      );
      vi.mocked(mockPasswordService.verify).mockReturnValue(true);

      // Act
      const result = await authenticateUserService.execute(command);

      // Assert
      expect(result.employeeId).toBe("PIT001");
      expect(result.displayName).toBe("山田太郎");
      expect(result.id).toBe(localUser.id.value);
      expect(mockUserRepository.findByEmployeeId).toHaveBeenCalledTimes(1);
      expect(mockPasswordService.verify).toHaveBeenCalledWith(
        "password123",
        "encrypted_hash",
      );
    });

    it("PIT形式の社員IDで認証に成功する", async () => {
      // Arrange
      const localUser = User.createLocalUser({
        employeeId: "PIT999",
        displayName: "テスト太郎",
        passwordHash: "hash",
      });
      const command: AuthenticateUserCommand = {
        employeeId: "PIT999",
        password: "pass",
      };
      vi.mocked(mockUserRepository.findByEmployeeId).mockResolvedValue(
        localUser,
      );
      vi.mocked(mockPasswordService.verify).mockReturnValue(true);

      // Act
      const result = await authenticateUserService.execute(command);

      // Assert
      expect(result.employeeId).toBe("PIT999");
    });

    it("A形式の社員IDで認証に成功する", async () => {
      // Arrange
      const localUser = User.createLocalUser({
        employeeId: "A001",
        displayName: "テスト太郎",
        passwordHash: "hash",
      });
      const command: AuthenticateUserCommand = {
        employeeId: "A001",
        password: "pass",
      };
      vi.mocked(mockUserRepository.findByEmployeeId).mockResolvedValue(
        localUser,
      );
      vi.mocked(mockPasswordService.verify).mockReturnValue(true);

      // Act
      const result = await authenticateUserService.execute(command);

      // Assert
      expect(result.employeeId).toBe("A001");
    });
  });

  describe("execute - 異常系", () => {
    it("ユーザが存在しない場合はエラーになる", async () => {
      // Arrange
      const command: AuthenticateUserCommand = {
        employeeId: "PIT001",
        password: "password123",
      };
      vi.mocked(mockUserRepository.findByEmployeeId).mockResolvedValue(null);

      // Act & Assert
      await expect(
        authenticateUserService.execute(command),
      ).rejects.toMatchObject({
        messageCode: "INVALID_CREDENTIALS",
      });
      expect(mockPasswordService.verify).not.toHaveBeenCalled();
    });

    it("SSOユーザ（passwordHashがない）の場合はエラーになる", async () => {
      // Arrange
      const ssoUser = User.create({
        employeeId: "PIT001",
        displayName: "SSO太郎",
      });
      const command: AuthenticateUserCommand = {
        employeeId: "PIT001",
        password: "password123",
      };
      vi.mocked(mockUserRepository.findByEmployeeId).mockResolvedValue(ssoUser);

      // Act & Assert
      await expect(
        authenticateUserService.execute(command),
      ).rejects.toMatchObject({
        messageCode: "INVALID_CREDENTIALS",
      });
      expect(mockPasswordService.verify).not.toHaveBeenCalled();
    });

    it("パスワードが間違っている場合はエラーになる", async () => {
      // Arrange
      const localUser = User.createLocalUser({
        employeeId: "PIT001",
        displayName: "山田太郎",
        passwordHash: "encrypted_hash",
      });
      const command: AuthenticateUserCommand = {
        employeeId: "PIT001",
        password: "wrongpassword",
      };
      vi.mocked(mockUserRepository.findByEmployeeId).mockResolvedValue(
        localUser,
      );
      vi.mocked(mockPasswordService.verify).mockReturnValue(false);

      // Act & Assert
      await expect(
        authenticateUserService.execute(command),
      ).rejects.toMatchObject({
        messageCode: "INVALID_CREDENTIALS",
      });
    });

    it("空の社員IDの場合はバリデーションエラーになる", async () => {
      // Arrange
      const command: AuthenticateUserCommand = {
        employeeId: "",
        password: "password123",
      };

      // Act & Assert
      await expect(
        authenticateUserService.execute(command),
      ).rejects.toMatchObject({
        messageCode: "EMPLOYEE_ID_EMPTY",
      });
      expect(mockUserRepository.findByEmployeeId).not.toHaveBeenCalled();
    });

    it("空のパスワードの場合はバリデーションエラーになる", async () => {
      // Arrange
      const command: AuthenticateUserCommand = {
        employeeId: "PIT001",
        password: "",
      };

      // Act & Assert
      await expect(
        authenticateUserService.execute(command),
      ).rejects.toMatchObject({
        messageCode: "PASSWORD_EMPTY",
      });
      expect(mockUserRepository.findByEmployeeId).not.toHaveBeenCalled();
    });

    it("空白のみのパスワードの場合はバリデーションエラーになる", async () => {
      // Arrange
      const command: AuthenticateUserCommand = {
        employeeId: "PIT001",
        password: "   ",
      };

      // Act & Assert
      await expect(
        authenticateUserService.execute(command),
      ).rejects.toMatchObject({
        messageCode: "PASSWORD_EMPTY",
      });
      expect(mockUserRepository.findByEmployeeId).not.toHaveBeenCalled();
    });

    it("リポジトリのfindByEmployeeIdでエラー発生時は適切にエラーがスローされる", async () => {
      // Arrange
      const command: AuthenticateUserCommand = {
        employeeId: "PIT001",
        password: "password123",
      };
      const repositoryError = new Error("Database connection failed");
      vi.mocked(mockUserRepository.findByEmployeeId).mockRejectedValue(
        repositoryError,
      );

      // Act & Assert
      await expect(authenticateUserService.execute(command)).rejects.toThrow(
        "Database connection failed",
      );
    });
  });
});
