import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolveAiApiConfig, AiApiConfig } from "../resolveAiApiConfig";
import { EncryptedApiKey } from "@/domain/project/EncryptedApiKey";
import { SystemSetting } from "@/domain/system-setting/SystemSetting";

// 暗号化のテストのために環境変数を設定（64 hex文字 = 32バイト）
vi.stubEnv(
  "ENCRYPTION_KEY",
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
);

// 環境変数のモック
const originalEnv = { ...process.env };

describe("resolveAiApiConfig", () => {
  beforeEach(() => {
    // 環境変数をクリア
    delete process.env.AI_API_KEY;
    delete process.env.AI_API_URL;
    delete process.env.AI_API_MODEL;
  });

  afterEach(() => {
    // 環境変数をリストア
    process.env = { ...originalEnv };
  });

  describe("優先順位判定", () => {
    it("プロジェクトAPIキーがシステム設定より優先される", () => {
      // Arrange
      const projectApiKey = EncryptedApiKey.fromPlainText("project-api-key");
      const systemSetting = SystemSetting.create({
        apiKey: "system-api-key",
        apiUrl: "https://api.example.com",
        apiModel: "gpt-4",
      });

      // Act
      const result = resolveAiApiConfig(projectApiKey, systemSetting);

      // Assert
      expect(result.apiKey).toBe("project-api-key");
      expect(result.apiUrl).toBe("https://api.example.com");
      expect(result.apiModel).toBe("gpt-4");
    });

    it("プロジェクトAPIキーがない場合はシステム設定のAPIキーを使用", () => {
      // Arrange
      const projectApiKey = EncryptedApiKey.fromPlainText(null);
      const systemSetting = SystemSetting.create({
        apiKey: "system-api-key",
        apiUrl: "https://api.example.com",
        apiModel: "gpt-4",
      });

      // Act
      const result = resolveAiApiConfig(projectApiKey, systemSetting);

      // Assert
      expect(result.apiKey).toBe("system-api-key");
    });

    it("nullのプロジェクトAPIキーでもシステム設定のAPIキーを使用", () => {
      // Arrange
      const systemSetting = SystemSetting.create({
        apiKey: "system-api-key",
        apiUrl: "https://api.example.com",
        apiModel: "gpt-4",
      });

      // Act
      const result = resolveAiApiConfig(null, systemSetting);

      // Assert
      expect(result.apiKey).toBe("system-api-key");
    });

    it("undefinedのプロジェクトAPIキーでもシステム設定のAPIキーを使用", () => {
      // Arrange
      const systemSetting = SystemSetting.create({
        apiKey: "system-api-key",
        apiUrl: "https://api.example.com",
        apiModel: "gpt-4",
      });

      // Act
      const result = resolveAiApiConfig(undefined, systemSetting);

      // Assert
      expect(result.apiKey).toBe("system-api-key");
    });
  });

  describe("環境変数フォールバック", () => {
    it("APIキーがない場合は環境変数を使用", () => {
      // Arrange
      process.env.AI_API_KEY = "env-api-key";
      const systemSetting = SystemSetting.create({
        apiKey: null,
        apiUrl: "https://api.example.com",
        apiModel: "gpt-4",
      });

      // Act
      const result = resolveAiApiConfig(null, systemSetting);

      // Assert
      expect(result.apiKey).toBe("env-api-key");
    });

    it("API URLがシステム設定にない場合は環境変数を使用", () => {
      // Arrange
      process.env.AI_API_URL = "https://env.example.com";
      const projectApiKey = EncryptedApiKey.fromPlainText("project-api-key");
      const systemSetting = SystemSetting.create({
        apiKey: "system-api-key",
        apiUrl: null,
        apiModel: "gpt-4",
      });

      // Act
      const result = resolveAiApiConfig(projectApiKey, systemSetting);

      // Assert
      expect(result.apiUrl).toBe("https://env.example.com");
    });

    it("APIモデルがシステム設定にない場合は環境変数を使用", () => {
      // Arrange
      process.env.AI_API_MODEL = "env-model";
      const projectApiKey = EncryptedApiKey.fromPlainText("project-api-key");
      const systemSetting = SystemSetting.create({
        apiKey: "system-api-key",
        apiUrl: "https://api.example.com",
        apiModel: null,
      });

      // Act
      const result = resolveAiApiConfig(projectApiKey, systemSetting);

      // Assert
      expect(result.apiModel).toBe("env-model");
    });

    it("システム設定がnullの場合は全て環境変数を使用", () => {
      // Arrange
      process.env.AI_API_KEY = "env-api-key";
      process.env.AI_API_URL = "https://env.example.com";
      process.env.AI_API_MODEL = "env-model";

      // Act
      const result = resolveAiApiConfig(null, null);

      // Assert
      expect(result.apiKey).toBe("env-api-key");
      expect(result.apiUrl).toBe("https://env.example.com");
      expect(result.apiModel).toBe("env-model");
    });
  });

  describe("必須値検証", () => {
    it("APIキーが全て欠落している場合はエラー", () => {
      // Arrange
      const systemSetting = SystemSetting.create({
        apiKey: null,
        apiUrl: "https://api.example.com",
        apiModel: "gpt-4",
      });

      // Act & Assert
      expect(() => resolveAiApiConfig(null, systemSetting)).toThrow();
    });

    it("API URLが欠落している場合はエラー", () => {
      // Arrange
      const projectApiKey = EncryptedApiKey.fromPlainText("project-api-key");
      const systemSetting = SystemSetting.create({
        apiKey: "system-api-key",
        apiUrl: null,
        apiModel: "gpt-4",
      });

      // Act & Assert
      expect(() => resolveAiApiConfig(projectApiKey, systemSetting)).toThrow();
    });

    it("APIモデルが欠落している場合はエラー", () => {
      // Arrange
      const projectApiKey = EncryptedApiKey.fromPlainText("project-api-key");
      const systemSetting = SystemSetting.create({
        apiKey: "system-api-key",
        apiUrl: "https://api.example.com",
        apiModel: null,
      });

      // Act & Assert
      expect(() => resolveAiApiConfig(projectApiKey, systemSetting)).toThrow();
    });
  });

  describe("正常系の完全な設定", () => {
    it("全ての値が正しく解決される", () => {
      // Arrange
      const projectApiKey = EncryptedApiKey.fromPlainText("project-api-key");
      const systemSetting = SystemSetting.create({
        apiKey: "system-api-key",
        apiUrl: "https://api.example.com",
        apiModel: "gpt-4",
      });

      // Act
      const result = resolveAiApiConfig(projectApiKey, systemSetting);

      // Assert
      expect(result).toEqual({
        apiKey: "project-api-key",
        apiUrl: "https://api.example.com",
        apiModel: "gpt-4",
      });
    });

    it("返り値がAiApiConfig型である", () => {
      // Arrange
      const projectApiKey = EncryptedApiKey.fromPlainText("project-api-key");
      const systemSetting = SystemSetting.create({
        apiKey: "system-api-key",
        apiUrl: "https://api.example.com",
        apiModel: "gpt-4",
      });

      // Act
      const result: AiApiConfig = resolveAiApiConfig(projectApiKey, systemSetting);

      // Assert
      expect(result).toHaveProperty("apiKey");
      expect(result).toHaveProperty("apiUrl");
      expect(result).toHaveProperty("apiModel");
    });
  });
});
