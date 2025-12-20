import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  UpdateSystemNotificationService,
  UpdateSystemNotificationCommand,
} from "../UpdateSystemNotificationService";
import { ISystemNotificationRepository } from "@/application/shared/port/repository";
import { SystemNotification } from "@/domain/system-notification";

describe("UpdateSystemNotificationService", () => {
  let mockSystemNotificationRepository: ISystemNotificationRepository;
  let updateSystemNotificationService: UpdateSystemNotificationService;

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

    updateSystemNotificationService = new UpdateSystemNotificationService(
      mockSystemNotificationRepository,
    );
  });

  describe("execute - 正常系", () => {
    it("通知のメッセージを更新できる", async () => {
      // Arrange
      const notification = SystemNotification.create({
        message: "元のメッセージ",
        displayOrder: 1,
      });
      const command: UpdateSystemNotificationCommand = {
        id: notification.id.value,
        message: "更新されたメッセージ",
      };
      vi.mocked(mockSystemNotificationRepository.findById).mockResolvedValue(
        notification,
      );
      vi.mocked(mockSystemNotificationRepository.save).mockResolvedValue(
        undefined,
      );

      // Act
      const result = await updateSystemNotificationService.execute(command);

      // Assert
      expect(result.message).toBe("更新されたメッセージ");
      expect(result.displayOrder).toBe(1); // 変更なし
      expect(mockSystemNotificationRepository.save).toHaveBeenCalledTimes(1);
    });

    it("通知の表示順序を更新できる", async () => {
      // Arrange
      const notification = SystemNotification.create({
        message: "お知らせ",
        displayOrder: 1,
      });
      const command: UpdateSystemNotificationCommand = {
        id: notification.id.value,
        displayOrder: 5,
      };
      vi.mocked(mockSystemNotificationRepository.findById).mockResolvedValue(
        notification,
      );
      vi.mocked(mockSystemNotificationRepository.save).mockResolvedValue(
        undefined,
      );

      // Act
      const result = await updateSystemNotificationService.execute(command);

      // Assert
      expect(result.displayOrder).toBe(5);
      expect(result.message).toBe("お知らせ"); // 変更なし
    });

    it("通知の有効/無効を更新できる", async () => {
      // Arrange
      const notification = SystemNotification.create({
        message: "お知らせ",
        isActive: true,
      });
      const command: UpdateSystemNotificationCommand = {
        id: notification.id.value,
        isActive: false,
      };
      vi.mocked(mockSystemNotificationRepository.findById).mockResolvedValue(
        notification,
      );
      vi.mocked(mockSystemNotificationRepository.save).mockResolvedValue(
        undefined,
      );

      // Act
      const result = await updateSystemNotificationService.execute(command);

      // Assert
      expect(result.isActive).toBe(false);
    });
  });

  describe("execute - 異常系", () => {
    it("存在しない通知IDの場合はエラー", async () => {
      // Arrange
      // 有効なUUID形式を使用
      const validUuid = "550e8400-e29b-41d4-a716-446655440000";
      const command: UpdateSystemNotificationCommand = {
        id: validUuid,
        message: "新しいメッセージ",
      };
      vi.mocked(mockSystemNotificationRepository.findById).mockResolvedValue(
        null,
      );

      // Act & Assert
      await expect(
        updateSystemNotificationService.execute(command),
      ).rejects.toMatchObject({
        messageCode: "SYSTEM_NOTIFICATION_NOT_FOUND",
      });
      expect(mockSystemNotificationRepository.save).not.toHaveBeenCalled();
    });
  });
});
