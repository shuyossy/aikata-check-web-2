import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ListSystemNotificationsService,
  ListSystemNotificationsQuery,
} from "../ListSystemNotificationsService";
import { ISystemNotificationRepository } from "@/application/shared/port/repository";
import { SystemNotification } from "@/domain/system-notification";

describe("ListSystemNotificationsService", () => {
  let mockSystemNotificationRepository: ISystemNotificationRepository;
  let listSystemNotificationsService: ListSystemNotificationsService;

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

    listSystemNotificationsService = new ListSystemNotificationsService(
      mockSystemNotificationRepository,
    );
  });

  describe("execute - 正常系", () => {
    it("通知一覧と総件数を取得できる", async () => {
      // Arrange
      const notifications = [
        SystemNotification.create({ message: "通知1", displayOrder: 1 }),
        SystemNotification.create({ message: "通知2", displayOrder: 2 }),
      ];
      vi.mocked(mockSystemNotificationRepository.findAll).mockResolvedValue(
        notifications,
      );
      vi.mocked(mockSystemNotificationRepository.count).mockResolvedValue(2);

      // Act
      const result = await listSystemNotificationsService.execute({});

      // Assert
      expect(result.notifications).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.notifications[0].message).toBe("通知1");
      expect(result.notifications[1].message).toBe("通知2");
    });

    it("activeOnlyフィルタを指定できる", async () => {
      // Arrange
      const query: ListSystemNotificationsQuery = {
        activeOnly: true,
        limit: 10,
        offset: 0,
      };
      const notifications = [
        SystemNotification.create({ message: "アクティブ通知", isActive: true }),
      ];
      vi.mocked(mockSystemNotificationRepository.findAll).mockResolvedValue(
        notifications,
      );
      vi.mocked(mockSystemNotificationRepository.count).mockResolvedValue(1);

      // Act
      const result = await listSystemNotificationsService.execute(query);

      // Assert
      expect(result.notifications).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockSystemNotificationRepository.findAll).toHaveBeenCalledWith({
        activeOnly: true,
        limit: 10,
        offset: 0,
      });
      expect(mockSystemNotificationRepository.count).toHaveBeenCalledWith(true);
    });

    it("通知がない場合は空配列を返す", async () => {
      // Arrange
      vi.mocked(mockSystemNotificationRepository.findAll).mockResolvedValue([]);
      vi.mocked(mockSystemNotificationRepository.count).mockResolvedValue(0);

      // Act
      const result = await listSystemNotificationsService.execute({});

      // Assert
      expect(result.notifications).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
