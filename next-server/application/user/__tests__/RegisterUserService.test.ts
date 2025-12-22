import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  RegisterUserService,
  RegisterUserCommand,
} from "../RegisterUserService";
import { IUserRepository } from "@/application/shared/port/repository";
import { IPasswordService } from "@/application/shared/port/service";
import { User, EmployeeId } from "@/domain/user";

describe("RegisterUserService", () => {
  let mockUserRepository: IUserRepository;
  let mockPasswordService: IPasswordService;
  let registerUserService: RegisterUserService;

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

    registerUserService = new RegisterUserService(
      mockUserRepository,
      mockPasswordService,
    );
  });

  describe("execute - 正常系", () => {
    it("新規ユーザが正常に登録される", async () => {
      // Arrange
      const command: RegisterUserCommand = {
        employeeId: "PIT001",
        displayName: "山田太郎",
        password: "password123",
      };
      vi.mocked(mockUserRepository.findByEmployeeId).mockResolvedValue(null);
      vi.mocked(mockPasswordService.encrypt).mockReturnValue("encrypted_hash");
      vi.mocked(mockUserRepository.save).mockResolvedValue(undefined);

      // Act
      const result = await registerUserService.execute(command);

      // Assert
      expect(result.employeeId).toBe("PIT001");
      expect(result.displayName).toBe("山田太郎");
      expect(result.id).toBeDefined();
      expect(mockUserRepository.findByEmployeeId).toHaveBeenCalledTimes(1);
      expect(mockPasswordService.encrypt).toHaveBeenCalledWith("password123");
      expect(mockUserRepository.save).toHaveBeenCalledTimes(1);

      // 保存されたユーザにパスワードハッシュが設定されていることを確認
      const savedUser = vi.mocked(mockUserRepository.save).mock.calls[0][0];
      expect(savedUser.passwordHash).toBe("encrypted_hash");
    });

    it("社員IDがPIT形式の場合に正常に登録される", async () => {
      // Arrange
      const command: RegisterUserCommand = {
        employeeId: "PIT123",
        displayName: "テストユーザ",
        password: "p",
      };
      vi.mocked(mockUserRepository.findByEmployeeId).mockResolvedValue(null);
      vi.mocked(mockPasswordService.encrypt).mockReturnValue("hash");
      vi.mocked(mockUserRepository.save).mockResolvedValue(undefined);

      // Act
      const result = await registerUserService.execute(command);

      // Assert
      expect(result.employeeId).toBe("PIT123");
      expect(mockPasswordService.encrypt).toHaveBeenCalledWith("p");
    });

    it("社員IDがA形式の場合に正常に登録される", async () => {
      // Arrange
      const command: RegisterUserCommand = {
        employeeId: "A001",
        displayName: "テストユーザ",
        password: "password",
      };
      vi.mocked(mockUserRepository.findByEmployeeId).mockResolvedValue(null);
      vi.mocked(mockPasswordService.encrypt).mockReturnValue("hash");
      vi.mocked(mockUserRepository.save).mockResolvedValue(undefined);

      // Act
      const result = await registerUserService.execute(command);

      // Assert
      expect(result.employeeId).toBe("A001");
    });
  });

  describe("execute - 異常系", () => {
    it("既存ユーザが存在する場合はエラーになる", async () => {
      // Arrange
      const existingUser = User.create({
        employeeId: "PIT001",
        displayName: "既存ユーザ",
      });
      const command: RegisterUserCommand = {
        employeeId: "PIT001",
        displayName: "山田太郎",
        password: "password123",
      };
      vi.mocked(mockUserRepository.findByEmployeeId).mockResolvedValue(
        existingUser,
      );

      // Act & Assert
      await expect(registerUserService.execute(command)).rejects.toMatchObject({
        messageCode: "USER_ALREADY_EXISTS",
      });
      expect(mockPasswordService.encrypt).not.toHaveBeenCalled();
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it("空の社員IDの場合はバリデーションエラーになる", async () => {
      // Arrange
      const command: RegisterUserCommand = {
        employeeId: "",
        displayName: "山田太郎",
        password: "password123",
      };

      // Act & Assert
      await expect(registerUserService.execute(command)).rejects.toMatchObject({
        messageCode: "EMPLOYEE_ID_EMPTY",
      });
      expect(mockUserRepository.findByEmployeeId).not.toHaveBeenCalled();
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it("空の表示名の場合はバリデーションエラーになる", async () => {
      // Arrange
      vi.mocked(mockUserRepository.findByEmployeeId).mockResolvedValue(null);
      const command: RegisterUserCommand = {
        employeeId: "PIT001",
        displayName: "",
        password: "password123",
      };

      // Act & Assert
      await expect(registerUserService.execute(command)).rejects.toMatchObject({
        messageCode: "DISPLAY_NAME_EMPTY",
      });
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it("空のパスワードの場合はバリデーションエラーになる", async () => {
      // Arrange
      vi.mocked(mockUserRepository.findByEmployeeId).mockResolvedValue(null);
      const command: RegisterUserCommand = {
        employeeId: "PIT001",
        displayName: "山田太郎",
        password: "",
      };

      // Act & Assert
      await expect(registerUserService.execute(command)).rejects.toMatchObject({
        messageCode: "PASSWORD_EMPTY",
      });
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it("空白のみのパスワードの場合はバリデーションエラーになる", async () => {
      // Arrange
      vi.mocked(mockUserRepository.findByEmployeeId).mockResolvedValue(null);
      const command: RegisterUserCommand = {
        employeeId: "PIT001",
        displayName: "山田太郎",
        password: "   ",
      };

      // Act & Assert
      await expect(registerUserService.execute(command)).rejects.toMatchObject({
        messageCode: "PASSWORD_EMPTY",
      });
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it("リポジトリのfindByEmployeeIdでエラー発生時は適切にエラーがスローされる", async () => {
      // Arrange
      const command: RegisterUserCommand = {
        employeeId: "PIT001",
        displayName: "山田太郎",
        password: "password123",
      };
      const repositoryError = new Error("Database connection failed");
      vi.mocked(mockUserRepository.findByEmployeeId).mockRejectedValue(
        repositoryError,
      );

      // Act & Assert
      await expect(registerUserService.execute(command)).rejects.toThrow(
        "Database connection failed",
      );
    });

    it("リポジトリのsaveでエラー発生時は適切にエラーがスローされる", async () => {
      // Arrange
      const command: RegisterUserCommand = {
        employeeId: "PIT001",
        displayName: "山田太郎",
        password: "password123",
      };
      vi.mocked(mockUserRepository.findByEmployeeId).mockResolvedValue(null);
      vi.mocked(mockPasswordService.encrypt).mockReturnValue("encrypted_hash");
      const repositoryError = new Error("Failed to save user");
      vi.mocked(mockUserRepository.save).mockRejectedValue(repositoryError);

      // Act & Assert
      await expect(registerUserService.execute(command)).rejects.toThrow(
        "Failed to save user",
      );
    });
  });
});
