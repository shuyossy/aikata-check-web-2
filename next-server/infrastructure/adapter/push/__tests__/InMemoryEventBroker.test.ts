import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InMemoryEventBroker } from "../InMemoryEventBroker";

// loggerモジュールをモック
vi.mock("@/lib/server/logger", () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("InMemoryEventBroker", () => {
  let broker: InMemoryEventBroker;

  beforeEach(() => {
    // 各テストの前にシングルトンをリセット
    InMemoryEventBroker.resetInstance();
    broker = InMemoryEventBroker.getInstance();
  });

  afterEach(() => {
    InMemoryEventBroker.resetInstance();
  });

  describe("getInstance", () => {
    it("シングルトンインスタンスを返す", () => {
      const instance1 = InMemoryEventBroker.getInstance();
      const instance2 = InMemoryEventBroker.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe("subscribe", () => {
    it("購読IDを返す", () => {
      const callback = vi.fn();
      const subscriptionId = broker.subscribe("user1", "qa:123", callback);

      expect(subscriptionId).toBeDefined();
      expect(typeof subscriptionId).toBe("string");
    });

    it("購読数が増加する", () => {
      const callback = vi.fn();

      expect(broker.getSubscriptionCount()).toBe(0);

      broker.subscribe("user1", "qa:123", callback);

      expect(broker.getSubscriptionCount()).toBe(1);
    });

    it("ユーザーごとの購読数が増加する", () => {
      const callback = vi.fn();

      expect(broker.getUserSubscriptionCount("user1")).toBe(0);

      broker.subscribe("user1", "qa:123", callback);
      broker.subscribe("user1", "qa:456", callback);

      expect(broker.getUserSubscriptionCount("user1")).toBe(2);
    });
  });

  describe("unsubscribe", () => {
    it("購読を解除できる", () => {
      const callback = vi.fn();
      const subscriptionId = broker.subscribe("user1", "qa:123", callback);

      expect(broker.getSubscriptionCount()).toBe(1);

      broker.unsubscribe(subscriptionId);

      expect(broker.getSubscriptionCount()).toBe(0);
    });

    it("存在しない購読IDは無視される", () => {
      broker.unsubscribe("non-existent-id");

      expect(broker.getSubscriptionCount()).toBe(0);
    });
  });

  describe("publish", () => {
    it("購読しているコールバックにイベントを配信する", () => {
      const callback = vi.fn();
      broker.subscribe("user1", "qa:123", callback);

      broker.publish("user1", "qa:123", { message: "test" });

      expect(callback).toHaveBeenCalledWith({ message: "test" });
    });

    it("異なるユーザーには配信しない", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      broker.subscribe("user1", "qa:123", callback1);
      broker.subscribe("user2", "qa:123", callback2);

      broker.publish("user1", "qa:123", { message: "test" });

      expect(callback1).toHaveBeenCalledWith({ message: "test" });
      expect(callback2).not.toHaveBeenCalled();
    });

    it("異なるイベントタイプには配信しない", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      broker.subscribe("user1", "qa:123", callback1);
      broker.subscribe("user1", "qa:456", callback2);

      broker.publish("user1", "qa:123", { message: "test" });

      expect(callback1).toHaveBeenCalledWith({ message: "test" });
      expect(callback2).not.toHaveBeenCalled();
    });

    it("同じユーザー・イベントタイプの複数の購読者に配信する", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      broker.subscribe("user1", "qa:123", callback1);
      broker.subscribe("user1", "qa:123", callback2);

      broker.publish("user1", "qa:123", { message: "test" });

      expect(callback1).toHaveBeenCalledWith({ message: "test" });
      expect(callback2).toHaveBeenCalledWith({ message: "test" });
    });

    it("コールバックでエラーが発生しても他のコールバックは実行される", () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error("Test error");
      });
      const normalCallback = vi.fn();

      broker.subscribe("user1", "qa:123", errorCallback);
      broker.subscribe("user1", "qa:123", normalCallback);

      broker.publish("user1", "qa:123", { message: "test" });

      // エラーを投げるコールバックも呼ばれることを確認
      expect(errorCallback).toHaveBeenCalled();
      // 他のコールバックも正常に実行されることを確認
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe("unsubscribeAll", () => {
    it("特定ユーザーの全購読を解除できる", () => {
      const callback = vi.fn();
      broker.subscribe("user1", "qa:123", callback);
      broker.subscribe("user1", "qa:456", callback);
      broker.subscribe("user2", "qa:789", callback);

      expect(broker.getSubscriptionCount()).toBe(3);
      expect(broker.getUserSubscriptionCount("user1")).toBe(2);

      broker.unsubscribeAll("user1");

      expect(broker.getSubscriptionCount()).toBe(1);
      expect(broker.getUserSubscriptionCount("user1")).toBe(0);
      expect(broker.getUserSubscriptionCount("user2")).toBe(1);
    });

    it("解除後はイベントが配信されない", () => {
      const callback = vi.fn();
      broker.subscribe("user1", "qa:123", callback);

      broker.unsubscribeAll("user1");
      broker.publish("user1", "qa:123", { message: "test" });

      expect(callback).not.toHaveBeenCalled();
    });

    it("存在しないユーザーIDは無視される", () => {
      broker.unsubscribeAll("non-existent-user");

      expect(broker.getSubscriptionCount()).toBe(0);
    });
  });

  describe("subscribeChannel", () => {
    it("購読IDを返す", () => {
      const callback = vi.fn();
      const subscriptionId = broker.subscribeChannel("qa:123", callback);

      expect(subscriptionId).toBeDefined();
      expect(typeof subscriptionId).toBe("string");
    });

    it("チャンネル購読数が増加する", () => {
      const callback = vi.fn();

      expect(broker.getChannelSubscriptionCount()).toBe(0);

      broker.subscribeChannel("qa:123", callback);

      expect(broker.getChannelSubscriptionCount()).toBe(1);
    });

    it("同じチャンネルの購読者数が増加する", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      expect(broker.getChannelSubscriberCount("qa:123")).toBe(0);

      broker.subscribeChannel("qa:123", callback1);
      broker.subscribeChannel("qa:123", callback2);

      expect(broker.getChannelSubscriberCount("qa:123")).toBe(2);
    });
  });

  describe("broadcast", () => {
    it("チャンネルを購読している全てのコールバックにイベントを配信する", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      broker.subscribeChannel("qa:123", callback1);
      broker.subscribeChannel("qa:123", callback2);

      broker.broadcast("qa:123", { message: "test" });

      expect(callback1).toHaveBeenCalledWith({ message: "test" });
      expect(callback2).toHaveBeenCalledWith({ message: "test" });
    });

    it("異なるチャンネルには配信しない", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      broker.subscribeChannel("qa:123", callback1);
      broker.subscribeChannel("qa:456", callback2);

      broker.broadcast("qa:123", { message: "test" });

      expect(callback1).toHaveBeenCalledWith({ message: "test" });
      expect(callback2).not.toHaveBeenCalled();
    });

    it("購読者がいないチャンネルへのブロードキャストはエラーにならない", () => {
      expect(() => {
        broker.broadcast("non-existent-channel", { message: "test" });
      }).not.toThrow();
    });

    it("コールバックでエラーが発生しても他のコールバックは実行される", () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error("Test error");
      });
      const normalCallback = vi.fn();

      broker.subscribeChannel("qa:123", errorCallback);
      broker.subscribeChannel("qa:123", normalCallback);

      broker.broadcast("qa:123", { message: "test" });

      // エラーを投げるコールバックも呼ばれることを確認
      expect(errorCallback).toHaveBeenCalled();
      // 他のコールバックも正常に実行されることを確認
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe("unsubscribe (チャンネル購読)", () => {
    it("チャンネル購読を解除できる", () => {
      const callback = vi.fn();
      const subscriptionId = broker.subscribeChannel("qa:123", callback);

      expect(broker.getChannelSubscriptionCount()).toBe(1);

      broker.unsubscribe(subscriptionId);

      expect(broker.getChannelSubscriptionCount()).toBe(0);
    });

    it("解除後はイベントが配信されない", () => {
      const callback = vi.fn();
      const subscriptionId = broker.subscribeChannel("qa:123", callback);

      broker.unsubscribe(subscriptionId);
      broker.broadcast("qa:123", { message: "test" });

      expect(callback).not.toHaveBeenCalled();
    });

    it("チャンネルの最後の購読者を解除するとチャンネルマッピングも削除される", () => {
      const callback = vi.fn();
      const subscriptionId = broker.subscribeChannel("qa:123", callback);

      expect(broker.getChannelSubscriberCount("qa:123")).toBe(1);

      broker.unsubscribe(subscriptionId);

      expect(broker.getChannelSubscriberCount("qa:123")).toBe(0);
    });
  });
});
