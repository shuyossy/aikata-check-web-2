import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  UpdateSystemSettingService,
  UpdateSystemSettingCommand,
} from "../UpdateSystemSettingService";
import { ISystemSettingRepository } from "@/application/shared/port/repository";
import { SystemSetting } from "@/domain/system-setting";

// 暗号化のテストのために環境変数を設定（64 hex文字 = 32バイト）
vi.stubEnv(
  "ENCRYPTION_KEY",
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
);

describe("UpdateSystemSettingService", () => {
  let mockSystemSettingRepository: ISystemSettingRepository;
  let updateSystemSettingService: UpdateSystemSettingService;

  const fixedDate = new Date("2024-01-01T00:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);

    mockSystemSettingRepository = {
      find: vi.fn(),
      save: vi.fn(),
    };

    updateSystemSettingService = new UpdateSystemSettingService(
      mockSystemSettingRepository,
    );
  });

  describe("execute - 正常系", () => {
    it("システム設定が存在しない場合、新規作成される", async () => {
      // Arrange
      const command: UpdateSystemSettingCommand = {
        apiKey: "sk-new-api-key",
        apiUrl: "https://api.new.com",
        apiModel: "gpt-4-turbo",
      };
      vi.mocked(mockSystemSettingRepository.find).mockResolvedValue(null);
      vi.mocked(mockSystemSettingRepository.save).mockResolvedValue(undefined);

      // Act
      const result = await updateSystemSettingService.execute(command);

      // Assert
      expect(result.hasApiKey).toBe(true);
      expect(result.apiUrl).toBe("https://api.new.com");
      expect(result.apiModel).toBe("gpt-4-turbo");
      expect(mockSystemSettingRepository.save).toHaveBeenCalledTimes(1);
    });

    it("システム設定が存在する場合、更新される", async () => {
      // Arrange
      const existingSetting = SystemSetting.create({
        apiKey: "sk-old-api-key",
        apiUrl: "https://api.old.com",
        apiModel: "gpt-3.5",
      });
      const command: UpdateSystemSettingCommand = {
        apiKey: "sk-updated-api-key",
        apiUrl: "https://api.updated.com",
        apiModel: "gpt-4",
      };
      vi.mocked(mockSystemSettingRepository.find).mockResolvedValue(
        existingSetting,
      );
      vi.mocked(mockSystemSettingRepository.save).mockResolvedValue(undefined);

      // Act
      const result = await updateSystemSettingService.execute(command);

      // Assert
      expect(result.apiUrl).toBe("https://api.updated.com");
      expect(result.apiModel).toBe("gpt-4");
      expect(mockSystemSettingRepository.save).toHaveBeenCalledTimes(1);
    });

    it("部分的な更新ができる（nullの項目は既存値を保持する）", async () => {
      // Arrange
      const existingSetting = SystemSetting.create({
        apiKey: "sk-old-api-key",
        apiUrl: "https://api.old.com",
        apiModel: "gpt-3.5",
      });
      const command: UpdateSystemSettingCommand = {
        apiKey: null, // 既存値を保持
        apiUrl: "https://api.new.com",
        apiModel: null, // 既存値を保持
      };
      vi.mocked(mockSystemSettingRepository.find).mockResolvedValue(
        existingSetting,
      );
      vi.mocked(mockSystemSettingRepository.save).mockResolvedValue(undefined);

      // Act
      const result = await updateSystemSettingService.execute(command);

      // Assert
      expect(result.apiUrl).toBe("https://api.new.com");
      // nullを渡した項目は既存の値を保持
      expect(result.hasApiKey).toBe(true);
      expect(result.apiModel).toBe("gpt-3.5");
      expect(mockSystemSettingRepository.save).toHaveBeenCalledTimes(1);
    });
  });
});
