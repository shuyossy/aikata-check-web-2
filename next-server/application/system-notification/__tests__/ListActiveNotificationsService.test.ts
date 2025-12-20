import { describe, it, expect, beforeEach, vi } from "vitest";
import { ListActiveNotificationsService } from "../ListActiveNotificationsService";
import { ISystemNotificationRepository } from "@/application/shared/port/repository";
import { SystemNotification } from "@/domain/system-notification";

describe("ListActiveNotificationsService", () => {
  let mockSystemNotificationRepository: ISystemNotificationRepository;
  let listActiveNotificationsService: ListActiveNotificationsService;

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

    listActiveNotificationsService = new ListActiveNotificationsService(
      mockSystemNotificationRepository,
    );
  });

  describe("execute - 正常系", () => {
    it("アクティブな通知一覧を取得できる", async () => {
      // Arrange
      const notifications = [
        SystemNotification.create({
          message: "重要なお知らせ1",
          displayOrder: 1,
          isActive: true,
        }),
        SystemNotification.create({
          message: "重要なお知らせ2",
          displayOrder: 2,
          isActive: true,
        }),
      ];
      vi.mocked(
        mockSystemNotificationRepository.findActiveNotifications,
      ).mockResolvedValue(notifications);

      // Act
      const result = await listActiveNotificationsService.execute();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].message).toBe("重要なお知らせ1");
      expect(result[1].message).toBe("重要なお知らせ2");
      expect(
        mockSystemNotificationRepository.findActiveNotifications,
      ).toHaveBeenCalledTimes(1);
    });

    it("アクティブな通知がない場合は空配列を返す", async () => {
      // Arrange
      vi.mocked(
        mockSystemNotificationRepository.findActiveNotifications,
      ).mockResolvedValue([]);

      // Act
      const result = await listActiveNotificationsService.execute();

      // Assert
      expect(result).toHaveLength(0);
    });
  });
});
