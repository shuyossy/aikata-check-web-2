import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DeleteSystemNotificationService,
  DeleteSystemNotificationCommand,
} from "../DeleteSystemNotificationService";
import { ISystemNotificationRepository } from "@/application/shared/port/repository";
import { SystemNotification } from "@/domain/system-notification";

describe("DeleteSystemNotificationService", () => {
  let mockSystemNotificationRepository: ISystemNotificationRepository;
  let deleteSystemNotificationService: DeleteSystemNotificationService;

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

    deleteSystemNotificationService = new DeleteSystemNotificationService(
      mockSystemNotificationRepository,
    );
  });

  describe("execute - 正常系", () => {
    it("通知を削除できる", async () => {
      // Arrange
      const notification = SystemNotification.create({
        message: "削除する通知",
      });
      const command: DeleteSystemNotificationCommand = {
        id: notification.id.value,
      };
      vi.mocked(mockSystemNotificationRepository.findById).mockResolvedValue(
        notification,
      );
      vi.mocked(mockSystemNotificationRepository.delete).mockResolvedValue(
        undefined,
      );

      // Act
      await deleteSystemNotificationService.execute(command);

      // Assert
      expect(mockSystemNotificationRepository.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe("execute - 異常系", () => {
    it("存在しない通知IDの場合はエラー", async () => {
      // Arrange
      // 有効なUUID形式を使用
      const validUuid = "550e8400-e29b-41d4-a716-446655440000";
      const command: DeleteSystemNotificationCommand = {
        id: validUuid,
      };
      vi.mocked(mockSystemNotificationRepository.findById).mockResolvedValue(
        null,
      );

      // Act & Assert
      await expect(
        deleteSystemNotificationService.execute(command),
      ).rejects.toMatchObject({
        messageCode: "SYSTEM_NOTIFICATION_NOT_FOUND",
      });
      expect(mockSystemNotificationRepository.delete).not.toHaveBeenCalled();
    });
  });
});
