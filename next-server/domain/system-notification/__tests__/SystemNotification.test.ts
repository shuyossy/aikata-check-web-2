import { describe, it, expect, beforeEach, vi } from "vitest";
import { SystemNotification } from "../SystemNotification";
import { SystemNotificationId } from "../SystemNotificationId";

describe("SystemNotification", () => {
  // テスト用の固定日時
  const fixedDate = new Date("2024-01-01T00:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  describe("create", () => {
    it("有効なデータでSystemNotificationエンティティを作成できる", () => {
      const notification = SystemNotification.create({
        message: "システムメンテナンスのお知らせです。",
      });

      expect(notification.id).toBeDefined();
      expect(notification.message).toBe("システムメンテナンスのお知らせです。");
      expect(notification.displayOrder).toBe(0);
      expect(notification.isActive).toBe(true);
      expect(notification.createdAt).toEqual(fixedDate);
      expect(notification.updatedAt).toEqual(fixedDate);
    });

    it("displayOrderを指定して作成できる", () => {
      const notification = SystemNotification.create({
        message: "重要なお知らせです。",
        displayOrder: 5,
      });

      expect(notification.displayOrder).toBe(5);
    });

    it("isActiveをfalseで作成できる", () => {
      const notification = SystemNotification.create({
        message: "無効なお知らせです。",
        isActive: false,
      });

      expect(notification.isActive).toBe(false);
    });

    it("メッセージの前後の空白がトリムされる", () => {
      const notification = SystemNotification.create({
        message: "  お知らせです。  ",
      });

      expect(notification.message).toBe("お知らせです。");
    });

    it("作成時にIDが自動生成される", () => {
      const notification1 = SystemNotification.create({
        message: "お知らせ1",
      });
      const notification2 = SystemNotification.create({
        message: "お知らせ2",
      });

      expect(notification1.id.value).not.toBe(notification2.id.value);
    });
  });

  describe("reconstruct", () => {
    it("DBから取得したデータでSystemNotificationを復元できる", () => {
      const id = "550e8400-e29b-41d4-a716-446655440000";
      const createdAt = new Date("2023-01-01T00:00:00.000Z");
      const updatedAt = new Date("2023-06-01T00:00:00.000Z");

      const notification = SystemNotification.reconstruct({
        id,
        message: "お知らせです。",
        displayOrder: 3,
        isActive: true,
        createdAt,
        updatedAt,
      });

      expect(notification.id.value).toBe(id);
      expect(notification.message).toBe("お知らせです。");
      expect(notification.displayOrder).toBe(3);
      expect(notification.isActive).toBe(true);
      expect(notification.createdAt).toEqual(createdAt);
      expect(notification.updatedAt).toEqual(updatedAt);
    });
  });

  describe("updateMessage", () => {
    it("メッセージを更新できる", () => {
      const notification = SystemNotification.create({
        message: "古いお知らせです。",
      });

      // 時間を進める
      const laterDate = new Date("2024-06-01T00:00:00.000Z");
      vi.setSystemTime(laterDate);

      const updatedNotification = notification.updateMessage("新しいお知らせです。");

      expect(updatedNotification.message).toBe("新しいお知らせです。");
      expect(updatedNotification.updatedAt).toEqual(laterDate);
      // その他のプロパティは変更されない
      expect(updatedNotification.id.value).toBe(notification.id.value);
      expect(updatedNotification.displayOrder).toBe(notification.displayOrder);
      expect(updatedNotification.isActive).toBe(notification.isActive);
      expect(updatedNotification.createdAt).toEqual(notification.createdAt);
    });

    it("元のインスタンスは不変である", () => {
      const notification = SystemNotification.create({
        message: "古いお知らせです。",
      });
      const originalMessage = notification.message;

      notification.updateMessage("新しいお知らせです。");

      // 元のインスタンスは変更されていない
      expect(notification.message).toBe(originalMessage);
    });
  });

  describe("updateDisplayOrder", () => {
    it("表示順序を更新できる", () => {
      const notification = SystemNotification.create({
        message: "お知らせです。",
        displayOrder: 0,
      });

      const updatedNotification = notification.updateDisplayOrder(10);

      expect(updatedNotification.displayOrder).toBe(10);
    });
  });

  describe("updateActiveStatus", () => {
    it("有効/無効を切り替えできる", () => {
      const notification = SystemNotification.create({
        message: "お知らせです。",
        isActive: true,
      });

      const updatedNotification = notification.updateActiveStatus(false);

      expect(updatedNotification.isActive).toBe(false);
    });
  });

  describe("update", () => {
    it("複数項目を一括で更新できる", () => {
      const notification = SystemNotification.create({
        message: "古いお知らせです。",
        displayOrder: 0,
        isActive: true,
      });

      const updatedNotification = notification.update({
        message: "新しいお知らせです。",
        displayOrder: 5,
        isActive: false,
      });

      expect(updatedNotification.message).toBe("新しいお知らせです。");
      expect(updatedNotification.displayOrder).toBe(5);
      expect(updatedNotification.isActive).toBe(false);
    });

    it("一部の項目のみを更新できる", () => {
      const notification = SystemNotification.create({
        message: "お知らせです。",
        displayOrder: 0,
        isActive: true,
      });

      const updatedNotification = notification.update({
        displayOrder: 5,
      });

      expect(updatedNotification.message).toBe("お知らせです。");
      expect(updatedNotification.displayOrder).toBe(5);
      expect(updatedNotification.isActive).toBe(true);
    });
  });

  describe("バリデーション（異常系）", () => {
    it("空のメッセージではエラーになる", () => {
      expect(() =>
        SystemNotification.create({
          message: "",
        }),
      ).toThrow();
    });

    it("空白のみのメッセージではエラーになる", () => {
      expect(() =>
        SystemNotification.create({
          message: "   ",
        }),
      ).toThrow();
    });

    it("1000文字超のメッセージではエラーになる", () => {
      expect(() =>
        SystemNotification.create({
          message: "A".repeat(1001),
        }),
      ).toThrow();
    });

    it("1000文字ちょうどのメッセージは作成できる", () => {
      const notification = SystemNotification.create({
        message: "A".repeat(1000),
      });

      expect(notification.message.length).toBe(1000);
    });

    it("updateMessageで空のメッセージにするとエラーになる", () => {
      const notification = SystemNotification.create({
        message: "お知らせです。",
      });

      expect(() => notification.updateMessage("")).toThrow();
    });

    it("updateで空のメッセージにするとエラーになる", () => {
      const notification = SystemNotification.create({
        message: "お知らせです。",
      });

      expect(() => notification.update({ message: "" })).toThrow();
    });

    it("不正なIDでreconstructするとエラーになる", () => {
      expect(() =>
        SystemNotification.reconstruct({
          id: "invalid-uuid",
          message: "お知らせです。",
          displayOrder: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ).toThrow();
    });
  });

  describe("toDto", () => {
    it("DTOに変換できる", () => {
      const notification = SystemNotification.create({
        message: "お知らせです。",
        displayOrder: 3,
        isActive: true,
      });

      const dto = notification.toDto();

      expect(dto).toEqual({
        id: notification.id.value,
        message: "お知らせです。",
        displayOrder: 3,
        isActive: true,
        createdAt: fixedDate,
        updatedAt: fixedDate,
      });
    });
  });
});

describe("SystemNotificationId", () => {
  describe("create", () => {
    it("新規IDを生成できる", () => {
      const id = SystemNotificationId.create();

      expect(id.value).toBeDefined();
      // UUID形式であることを確認
      expect(id.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it("生成されるIDは一意である", () => {
      const id1 = SystemNotificationId.create();
      const id2 = SystemNotificationId.create();

      expect(id1.value).not.toBe(id2.value);
    });
  });

  describe("reconstruct", () => {
    it("有効なUUIDで復元できる", () => {
      const value = "550e8400-e29b-41d4-a716-446655440000";
      const id = SystemNotificationId.reconstruct(value);

      expect(id.value).toBe(value);
    });

    it("無効なUUIDではエラーになる", () => {
      expect(() => SystemNotificationId.reconstruct("invalid-uuid")).toThrow();
    });
  });

  describe("equals", () => {
    it("同じ値のIDは等価である", () => {
      const value = "550e8400-e29b-41d4-a716-446655440000";
      const id1 = SystemNotificationId.reconstruct(value);
      const id2 = SystemNotificationId.reconstruct(value);

      expect(id1.equals(id2)).toBe(true);
    });

    it("異なる値のIDは等価でない", () => {
      const id1 = SystemNotificationId.create();
      const id2 = SystemNotificationId.create();

      expect(id1.equals(id2)).toBe(false);
    });
  });
});
