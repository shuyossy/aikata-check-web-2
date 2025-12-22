import { describe, it, expect, beforeEach, vi } from "vitest";
import { SyncUserService, SyncUserCommand } from "../SyncUserService";
import { IUserRepository } from "@/application/shared/port/repository";
import { User, EmployeeId } from "@/domain/user";

describe("SyncUserService", () => {
  let mockUserRepository: IUserRepository;
  let syncUserService: SyncUserService;

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
    };

    syncUserService = new SyncUserService(mockUserRepository);
  });

  describe("execute - 正常系", () => {
    it("新規ユーザの場合、DBに保存されUserDtoが返却される", async () => {
      // Arrange
      const command: SyncUserCommand = {
        employeeId: "EMP001",
        displayName: "山田太郎",
      };
      vi.mocked(mockUserRepository.findByEmployeeId).mockResolvedValue(null);
      vi.mocked(mockUserRepository.save).mockResolvedValue(undefined);

      // Act
      const result = await syncUserService.execute(command);

      // Assert
      expect(result.employeeId).toBe("EMP001");
      expect(result.displayName).toBe("山田太郎");
      expect(result.id).toBeDefined();
      expect(mockUserRepository.findByEmployeeId).toHaveBeenCalledTimes(1);
      expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
    });

    it("既存ユーザで表示名変更なしの場合、更新せずUserDtoが返却される", async () => {
      // Arrange
      const existingUser = User.create({
        employeeId: "EMP001",
        displayName: "山田太郎",
      });
      const command: SyncUserCommand = {
        employeeId: "EMP001",
        displayName: "山田太郎", // 同じ表示名
      };
      vi.mocked(mockUserRepository.findByEmployeeId).mockResolvedValue(
        existingUser,
      );

      // Act
      const result = await syncUserService.execute(command);

      // Assert
      expect(result.employeeId).toBe("EMP001");
      expect(result.displayName).toBe("山田太郎");
      expect(result.id).toBe(existingUser.id.value);
      expect(mockUserRepository.findByEmployeeId).toHaveBeenCalledTimes(1);
      // 表示名が変わっていないのでsaveは呼ばれない
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it("既存ユーザで表示名変更ありの場合、更新してUserDtoが返却される", async () => {
      // Arrange
      const existingUser = User.create({
        employeeId: "EMP001",
        displayName: "山田太郎",
      });
      const command: SyncUserCommand = {
        employeeId: "EMP001",
        displayName: "山田次郎", // 異なる表示名
      };
      vi.mocked(mockUserRepository.findByEmployeeId).mockResolvedValue(
        existingUser,
      );
      vi.mocked(mockUserRepository.save).mockResolvedValue(undefined);

      // 時間を進める
      const laterDate = new Date("2024-06-01T00:00:00.000Z");
      vi.setSystemTime(laterDate);

      // Act
      const result = await syncUserService.execute(command);

      // Assert
      expect(result.employeeId).toBe("EMP001");
      expect(result.displayName).toBe("山田次郎");
      expect(result.id).toBe(existingUser.id.value);
      expect(mockUserRepository.findByEmployeeId).toHaveBeenCalledTimes(1);
      expect(mockUserRepository.save).toHaveBeenCalledTimes(1);

      // saveに渡されたユーザの表示名が更新されていることを確認
      const savedUser = vi.mocked(mockUserRepository.save).mock.calls[0][0];
      expect(savedUser.displayName).toBe("山田次郎");
    });
  });

  describe("execute - GitLab連携", () => {
    it("GitLab形式のusername（ハイフン含む）で新規ユーザが作成される", async () => {
      // Arrange
      const command: SyncUserCommand = {
        employeeId: "gitlab-user-123",
        displayName: "GitLab User",
      };
      vi.mocked(mockUserRepository.findByEmployeeId).mockResolvedValue(null);
      vi.mocked(mockUserRepository.save).mockResolvedValue(undefined);

      // Act
      const result = await syncUserService.execute(command);

      // Assert
      expect(result.employeeId).toBe("gitlab-user-123");
      expect(result.displayName).toBe("GitLab User");
      expect(result.id).toBeDefined();
      expect(mockUserRepository.findByEmployeeId).toHaveBeenCalledTimes(1);
      expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
    });

    it("GitLab形式のusername（アンダースコア含む）で新規ユーザが作成される", async () => {
      // Arrange
      const command: SyncUserCommand = {
        employeeId: "gitlab_user_456",
        displayName: "GitLab User 2",
      };
      vi.mocked(mockUserRepository.findByEmployeeId).mockResolvedValue(null);
      vi.mocked(mockUserRepository.save).mockResolvedValue(undefined);

      // Act
      const result = await syncUserService.execute(command);

      // Assert
      expect(result.employeeId).toBe("gitlab_user_456");
      expect(result.displayName).toBe("GitLab User 2");
      expect(result.id).toBeDefined();
      expect(mockUserRepository.findByEmployeeId).toHaveBeenCalledTimes(1);
      expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
    });

    it("GitLab形式のusername（ピリオド含む）で新規ユーザが作成される", async () => {
      // Arrange
      const command: SyncUserCommand = {
        employeeId: "gitlab.user.789",
        displayName: "GitLab User 3",
      };
      vi.mocked(mockUserRepository.findByEmployeeId).mockResolvedValue(null);
      vi.mocked(mockUserRepository.save).mockResolvedValue(undefined);

      // Act
      const result = await syncUserService.execute(command);

      // Assert
      expect(result.employeeId).toBe("gitlab.user.789");
      expect(result.displayName).toBe("GitLab User 3");
      expect(result.id).toBeDefined();
      expect(mockUserRepository.findByEmployeeId).toHaveBeenCalledTimes(1);
      expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
    });
  });

  describe("execute - 異常系", () => {
    it("空の社員IDの場合はバリデーションエラーになる", async () => {
      // Arrange
      const command: SyncUserCommand = {
        employeeId: "",
        displayName: "山田太郎",
      };

      // Act & Assert
      await expect(syncUserService.execute(command)).rejects.toMatchObject({
        messageCode: "EMPLOYEE_ID_EMPTY",
      });
      expect(mockUserRepository.findByEmployeeId).not.toHaveBeenCalled();
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it("255文字超の社員IDの場合はバリデーションエラーになる", async () => {
      // Arrange
      const command: SyncUserCommand = {
        employeeId: "A".repeat(256),
        displayName: "山田太郎",
      };

      // Act & Assert
      await expect(syncUserService.execute(command)).rejects.toMatchObject({
        messageCode: "EMPLOYEE_ID_TOO_LONG",
      });
      expect(mockUserRepository.findByEmployeeId).not.toHaveBeenCalled();
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it("空の表示名の場合はバリデーションエラーになる", async () => {
      // Arrange
      vi.mocked(mockUserRepository.findByEmployeeId).mockResolvedValue(null);
      const command: SyncUserCommand = {
        employeeId: "EMP001",
        displayName: "",
      };

      // Act & Assert
      await expect(syncUserService.execute(command)).rejects.toMatchObject({
        messageCode: "DISPLAY_NAME_EMPTY",
      });
      // findByEmployeeIdは呼ばれるが、saveは呼ばれない
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it("リポジトリのfindByEmployeeIdでエラー発生時は適切にエラーがスローされる", async () => {
      // Arrange
      const command: SyncUserCommand = {
        employeeId: "EMP001",
        displayName: "山田太郎",
      };
      const repositoryError = new Error("Database connection failed");
      vi.mocked(mockUserRepository.findByEmployeeId).mockRejectedValue(
        repositoryError,
      );

      // Act & Assert
      await expect(syncUserService.execute(command)).rejects.toThrow(
        "Database connection failed",
      );
    });

    it("リポジトリのsaveでエラー発生時は適切にエラーがスローされる", async () => {
      // Arrange
      const command: SyncUserCommand = {
        employeeId: "EMP001",
        displayName: "山田太郎",
      };
      vi.mocked(mockUserRepository.findByEmployeeId).mockResolvedValue(null);
      const repositoryError = new Error("Failed to save user");
      vi.mocked(mockUserRepository.save).mockRejectedValue(repositoryError);

      // Act & Assert
      await expect(syncUserService.execute(command)).rejects.toThrow(
        "Failed to save user",
      );
    });
  });
});
