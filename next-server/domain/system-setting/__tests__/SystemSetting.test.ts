import { describe, it, expect, beforeEach, vi } from "vitest";
import { SystemSetting } from "../SystemSetting";

// 暗号化関数をモック
vi.mock("@/lib/server/encryption", () => ({
  encrypt: vi.fn((text: string) => `encrypted_${text}`),
  decrypt: vi.fn((text: string) => text.replace("encrypted_", "")),
}));

describe("SystemSetting", () => {
  // テスト用の固定日時
  const fixedDate = new Date("2024-01-01T00:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  describe("create", () => {
    it("有効なデータでSystemSettingエンティティを作成できる", () => {
      const setting = SystemSetting.create({
        apiKey: "test-api-key",
        apiUrl: "https://api.example.com",
        apiModel: "gpt-4",
      });

      expect(setting.id).toBe(1);
      expect(setting.encryptedApiKey).toBe("encrypted_test-api-key");
      expect(setting.apiUrl).toBe("https://api.example.com");
      expect(setting.apiModel).toBe("gpt-4");
      expect(setting.updatedAt).toEqual(fixedDate);
    });

    it("APIキーがnullの場合も作成できる", () => {
      const setting = SystemSetting.create({
        apiKey: null,
        apiUrl: "https://api.example.com",
        apiModel: "gpt-4",
      });

      expect(setting.encryptedApiKey).toBeNull();
      expect(setting.apiUrl).toBe("https://api.example.com");
      expect(setting.apiModel).toBe("gpt-4");
    });

    it("全てnullで作成できる", () => {
      const setting = SystemSetting.create({
        apiKey: null,
        apiUrl: null,
        apiModel: null,
      });

      expect(setting.encryptedApiKey).toBeNull();
      expect(setting.apiUrl).toBeNull();
      expect(setting.apiModel).toBeNull();
    });
  });

  describe("reconstruct", () => {
    it("DBから取得したデータでSystemSettingを復元できる", () => {
      const updatedAt = new Date("2023-06-01T00:00:00.000Z");

      const setting = SystemSetting.reconstruct({
        encryptedApiKey: "encrypted_test-api-key",
        apiUrl: "https://api.example.com",
        apiModel: "gpt-4",
        updatedAt,
      });

      expect(setting.id).toBe(1);
      expect(setting.encryptedApiKey).toBe("encrypted_test-api-key");
      expect(setting.apiUrl).toBe("https://api.example.com");
      expect(setting.apiModel).toBe("gpt-4");
      expect(setting.updatedAt).toEqual(updatedAt);
    });
  });

  describe("update", () => {
    it("設定を更新できる", () => {
      const setting = SystemSetting.create({
        apiKey: "old-api-key",
        apiUrl: "https://old-api.example.com",
        apiModel: "gpt-3",
      });

      // 時間を進める
      const laterDate = new Date("2024-06-01T00:00:00.000Z");
      vi.setSystemTime(laterDate);

      const updatedSetting = setting.update({
        apiKey: "new-api-key",
        apiUrl: "https://new-api.example.com",
        apiModel: "gpt-4",
      });

      expect(updatedSetting.encryptedApiKey).toBe("encrypted_new-api-key");
      expect(updatedSetting.apiUrl).toBe("https://new-api.example.com");
      expect(updatedSetting.apiModel).toBe("gpt-4");
      expect(updatedSetting.updatedAt).toEqual(laterDate);
    });

    it("元のインスタンスは不変である", () => {
      const setting = SystemSetting.create({
        apiKey: "old-api-key",
        apiUrl: "https://old-api.example.com",
        apiModel: "gpt-3",
      });
      const originalApiUrl = setting.apiUrl;

      setting.update({
        apiKey: "new-api-key",
        apiUrl: "https://new-api.example.com",
        apiModel: "gpt-4",
      });

      // 元のインスタンスは変更されていない
      expect(setting.apiUrl).toBe(originalApiUrl);
    });

    it("nullを渡した項目は既存値を保持する", () => {
      const setting = SystemSetting.create({
        apiKey: "old-api-key",
        apiUrl: "https://old-api.example.com",
        apiModel: "gpt-3.5",
      });

      // 時間を進める
      const laterDate = new Date("2024-06-01T00:00:00.000Z");
      vi.setSystemTime(laterDate);

      const updatedSetting = setting.update({
        apiKey: null, // 保持される
        apiUrl: "https://new-api.example.com", // 更新される
        apiModel: null, // 保持される
      });

      // nullを渡した項目は既存値を保持
      expect(updatedSetting.encryptedApiKey).toBe("encrypted_old-api-key");
      expect(updatedSetting.apiModel).toBe("gpt-3.5");
      // 明示的に渡した項目は更新される
      expect(updatedSetting.apiUrl).toBe("https://new-api.example.com");
      expect(updatedSetting.updatedAt).toEqual(laterDate);
    });

    it("全てnullを渡した場合は全ての既存値を保持する", () => {
      const setting = SystemSetting.create({
        apiKey: "old-api-key",
        apiUrl: "https://old-api.example.com",
        apiModel: "gpt-3.5",
      });

      const updatedSetting = setting.update({
        apiKey: null,
        apiUrl: null,
        apiModel: null,
      });

      // 全ての既存値を保持
      expect(updatedSetting.encryptedApiKey).toBe("encrypted_old-api-key");
      expect(updatedSetting.apiUrl).toBe("https://old-api.example.com");
      expect(updatedSetting.apiModel).toBe("gpt-3.5");
    });

    it("空文字を渡した場合は空文字で更新される", () => {
      const setting = SystemSetting.create({
        apiKey: "old-api-key",
        apiUrl: "https://old-api.example.com",
        apiModel: "gpt-3.5",
      });

      const updatedSetting = setting.update({
        apiKey: "", // 空文字は新しい値として扱われる
        apiUrl: "",
        apiModel: "",
      });

      // 空文字で更新される
      expect(updatedSetting.encryptedApiKey).toBe("encrypted_");
      expect(updatedSetting.apiUrl).toBe("");
      expect(updatedSetting.apiModel).toBe("");
    });
  });

  describe("isConfigured", () => {
    it("全項目が設定されている場合はtrueを返す", () => {
      const setting = SystemSetting.create({
        apiKey: "test-api-key",
        apiUrl: "https://api.example.com",
        apiModel: "gpt-4",
      });

      expect(setting.isConfigured()).toBe(true);
    });

    it("APIキーがnullの場合はfalseを返す", () => {
      const setting = SystemSetting.create({
        apiKey: null,
        apiUrl: "https://api.example.com",
        apiModel: "gpt-4",
      });

      expect(setting.isConfigured()).toBe(false);
    });

    it("APIのURLがnullの場合はfalseを返す", () => {
      const setting = SystemSetting.create({
        apiKey: "test-api-key",
        apiUrl: null,
        apiModel: "gpt-4",
      });

      expect(setting.isConfigured()).toBe(false);
    });

    it("モデル名がnullの場合はfalseを返す", () => {
      const setting = SystemSetting.create({
        apiKey: "test-api-key",
        apiUrl: "https://api.example.com",
        apiModel: null,
      });

      expect(setting.isConfigured()).toBe(false);
    });
  });

  describe("toDto", () => {
    it("DTOに変換できる（APIキーは復号化される）", () => {
      const setting = SystemSetting.create({
        apiKey: "test-api-key",
        apiUrl: "https://api.example.com",
        apiModel: "gpt-4",
      });

      const dto = setting.toDto();

      expect(dto).toEqual({
        apiKey: "test-api-key",
        apiUrl: "https://api.example.com",
        apiModel: "gpt-4",
        updatedAt: fixedDate,
      });
    });

    it("APIキーがnullの場合もDTOに変換できる", () => {
      const setting = SystemSetting.create({
        apiKey: null,
        apiUrl: "https://api.example.com",
        apiModel: "gpt-4",
      });

      const dto = setting.toDto();

      expect(dto.apiKey).toBeNull();
    });
  });

  describe("decryptApiKey", () => {
    it("暗号化されたAPIキーを復号できる", () => {
      const setting = SystemSetting.create({
        apiKey: "test-api-key",
        apiUrl: "https://api.example.com",
        apiModel: "gpt-4",
      });

      expect(setting.decryptApiKey()).toBe("test-api-key");
    });

    it("APIキーがnullの場合はnullを返す", () => {
      const setting = SystemSetting.create({
        apiKey: null,
        apiUrl: "https://api.example.com",
        apiModel: "gpt-4",
      });

      expect(setting.decryptApiKey()).toBeNull();
    });
  });
});
