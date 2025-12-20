import { describe, it, expect, beforeEach, vi } from "vitest";
import { GetSystemSettingService } from "../GetSystemSettingService";
import { ISystemSettingRepository } from "@/application/shared/port/repository";
import { SystemSetting } from "@/domain/system-setting";

// 暗号化のテストのために環境変数を設定（64 hex文字 = 32バイト）
vi.stubEnv(
  "ENCRYPTION_KEY",
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
);

describe("GetSystemSettingService", () => {
  let mockSystemSettingRepository: ISystemSettingRepository;
  let getSystemSettingService: GetSystemSettingService;

  const fixedDate = new Date("2024-01-01T00:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);

    mockSystemSettingRepository = {
      find: vi.fn(),
      save: vi.fn(),
    };

    getSystemSettingService = new GetSystemSettingService(
      mockSystemSettingRepository,
    );
  });

  describe("execute - 正常系", () => {
    it("システム設定が存在する場合、hasApiKeyがtrueで返される", async () => {
      // Arrange
      const setting = SystemSetting.create({
        apiKey: "sk-test-api-key-12345",
        apiUrl: "https://api.example.com",
        apiModel: "gpt-4",
      });
      vi.mocked(mockSystemSettingRepository.find).mockResolvedValue(setting);

      // Act
      const result = await getSystemSettingService.execute();

      // Assert
      expect(result).not.toBeNull();
      expect(result.hasApiKey).toBe(true);
      expect(result.apiUrl).toBe("https://api.example.com");
      expect(result.apiModel).toBe("gpt-4");
    });

    it("システム設定が存在しない場合、デフォルト値を返す", async () => {
      // Arrange
      vi.mocked(mockSystemSettingRepository.find).mockResolvedValue(null);

      // Act
      const result = await getSystemSettingService.execute();

      // Assert
      expect(result.hasApiKey).toBe(false);
      expect(result.apiUrl).toBeNull();
      expect(result.apiModel).toBeNull();
      expect(result.updatedAt).toBeNull();
    });

    it("APIキーがnullの場合、hasApiKeyがfalseで返される", async () => {
      // Arrange
      const setting = SystemSetting.create({
        apiKey: null,
        apiUrl: "https://api.example.com",
        apiModel: "gpt-4",
      });
      vi.mocked(mockSystemSettingRepository.find).mockResolvedValue(setting);

      // Act
      const result = await getSystemSettingService.execute();

      // Assert
      expect(result.hasApiKey).toBe(false);
    });
  });

  describe("executeInternal - 正常系", () => {
    it("内部用メソッドは平文のAPIキーを返す", async () => {
      // Arrange
      const setting = SystemSetting.create({
        apiKey: "sk-test-api-key-12345",
        apiUrl: "https://api.example.com",
        apiModel: "gpt-4",
      });
      vi.mocked(mockSystemSettingRepository.find).mockResolvedValue(setting);

      // Act
      const result = await getSystemSettingService.executeInternal();

      // Assert
      expect(result).not.toBeNull();
      expect(result!.apiKey).toBe("sk-test-api-key-12345"); // 平文
      expect(result!.apiUrl).toBe("https://api.example.com");
      expect(result!.apiModel).toBe("gpt-4");
    });

    it("設定が存在しない場合はnullを返す", async () => {
      // Arrange
      vi.mocked(mockSystemSettingRepository.find).mockResolvedValue(null);

      // Act
      const result = await getSystemSettingService.executeInternal();

      // Assert
      expect(result).toBeNull();
    });
  });
});
