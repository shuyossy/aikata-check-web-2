import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CreateSystemNotificationService,
  CreateSystemNotificationCommand,
} from "../CreateSystemNotificationService";
import { ISystemNotificationRepository } from "@/application/shared/port/repository";

describe("CreateSystemNotificationService", () => {
  let mockSystemNotificationRepository: ISystemNotificationRepository;
  let createSystemNotificationService: CreateSystemNotificationService;

  const fixedDate = new Date("2024-01-01T00:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);

    mockSystemNotificationRepository = {
      findAll: vi.fn(),
      findActiveNotifications: vi.fn(),
      findById: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    };

    createSystemNotificationService = new CreateSystemNotificationService(
      mockSystemNotificationRepository,
    );
  });

  describe("execute - 正常系", () => {
    it("通知を作成できる", async () => {
      // Arrange
      const command: CreateSystemNotificationCommand = {
        message: "新しいお知らせです",
        displayOrder: 1,
        isActive: true,
      };
      vi.mocked(mockSystemNotificationRepository.save).mockResolvedValue(
        undefined,
      );

      // Act
      const result = await createSystemNotificationService.execute(command);

      // Assert
      expect(result.message).toBe("新しいお知らせです");
      expect(result.displayOrder).toBe(1);
      expect(result.isActive).toBe(true);
      expect(result.id).toBeDefined();
      expect(mockSystemNotificationRepository.save).toHaveBeenCalledTimes(1);
    });

    it("デフォルト値で通知を作成できる", async () => {
      // Arrange
      const command: CreateSystemNotificationCommand = {
        message: "お知らせ",
      };
      vi.mocked(mockSystemNotificationRepository.save).mockResolvedValue(
        undefined,
      );

      // Act
      const result = await createSystemNotificationService.execute(command);

      // Assert
      expect(result.message).toBe("お知らせ");
      expect(result.displayOrder).toBe(0); // デフォルト値
      expect(result.isActive).toBe(true); // デフォルト値
    });
  });

  describe("execute - 異常系", () => {
    it("空のメッセージの場合はドメインバリデーションエラー", async () => {
      // Arrange
      const command: CreateSystemNotificationCommand = {
        message: "",
      };

      // Act & Assert
      await expect(
        createSystemNotificationService.execute(command),
      ).rejects.toMatchObject({
        messageCode: "SYSTEM_NOTIFICATION_MESSAGE_EMPTY",
      });
      expect(mockSystemNotificationRepository.save).not.toHaveBeenCalled();
    });

    it("空白のみのメッセージの場合はドメインバリデーションエラー", async () => {
      // Arrange
      const command: CreateSystemNotificationCommand = {
        message: "   ", // 空白のみ
      };

      // Act & Assert
      await expect(
        createSystemNotificationService.execute(command),
      ).rejects.toMatchObject({
        messageCode: "SYSTEM_NOTIFICATION_MESSAGE_EMPTY",
      });
      expect(mockSystemNotificationRepository.save).not.toHaveBeenCalled();
    });

    it("メッセージが長すぎる場合はドメインバリデーションエラー", async () => {
      // Arrange
      const command: CreateSystemNotificationCommand = {
        message: "A".repeat(1001), // 1000文字超
      };

      // Act & Assert
      await expect(
        createSystemNotificationService.execute(command),
      ).rejects.toMatchObject({
        messageCode: "SYSTEM_NOTIFICATION_MESSAGE_TOO_LONG",
      });
      expect(mockSystemNotificationRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("execute - 境界値テスト", () => {
    it("1000文字ちょうどのメッセージは作成できる", async () => {
      // Arrange
      const command: CreateSystemNotificationCommand = {
        message: "A".repeat(1000), // ちょうど1000文字
      };
      vi.mocked(mockSystemNotificationRepository.save).mockResolvedValue(
        undefined,
      );

      // Act
      const result = await createSystemNotificationService.execute(command);

      // Assert
      expect(result.message.length).toBe(1000);
      expect(mockSystemNotificationRepository.save).toHaveBeenCalledTimes(1);
    });
  });
});
