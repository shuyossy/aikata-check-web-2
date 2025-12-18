import { IEventBroker } from "@/application/shared/port/push/IEventBroker";
import { v4 as uuidv4 } from "uuid";
import { getLogger } from "@/lib/server/logger";

const logger = getLogger();

/**
 * 購読情報
 */
interface Subscription {
  id: string;
  userId: string;
  eventType: string;
  callback: (data: unknown) => void;
}

/**
 * チャンネル購読情報
 */
interface ChannelSubscription {
  id: string;
  channel: string;
  callback: (data: unknown) => void;
}

/**
 * インメモリイベントブローカー実装
 * ユーザーへのリアルタイム通知をメモリ上で管理する
 *
 * 注意: シングルプロセス環境のみで動作
 * 複数プロセスに対応する場合はRedis等の外部ストレージを使用する実装に置き換える
 */
export class InMemoryEventBroker implements IEventBroker {
  private static instance: InMemoryEventBroker | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  // ユーザーID -> 購読ID のマッピング（ユーザー単位での一括解除用）
  private userSubscriptions: Map<string, Set<string>> = new Map();
  // チャンネル購読情報
  private channelSubscriptions: Map<string, ChannelSubscription> = new Map();
  // チャンネル名 -> 購読ID のマッピング（チャンネル単位での配信用）
  private channelToSubscriptionIds: Map<string, Set<string>> = new Map();

  private constructor() {}

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): InMemoryEventBroker {
    if (!InMemoryEventBroker.instance) {
      InMemoryEventBroker.instance = new InMemoryEventBroker();
    }
    return InMemoryEventBroker.instance;
  }

  /**
   * テスト用: インスタンスをリセット
   */
  static resetInstance(): void {
    InMemoryEventBroker.instance = null;
  }

  /**
   * イベントを購読する
   */
  subscribe(
    userId: string,
    eventType: string,
    callback: (data: unknown) => void,
  ): string {
    const subscriptionId = uuidv4();
    const subscription: Subscription = {
      id: subscriptionId,
      userId,
      eventType,
      callback,
    };

    this.subscriptions.set(subscriptionId, subscription);

    // ユーザー -> 購読IDマッピングを更新
    if (!this.userSubscriptions.has(userId)) {
      this.userSubscriptions.set(userId, new Set());
    }
    this.userSubscriptions.get(userId)!.add(subscriptionId);

    return subscriptionId;
  }

  /**
   * チャンネルを購読する（ユーザーIDに依存しない）
   */
  subscribeChannel(channel: string, callback: (data: unknown) => void): string {
    const subscriptionId = uuidv4();
    const subscription: ChannelSubscription = {
      id: subscriptionId,
      channel,
      callback,
    };

    this.channelSubscriptions.set(subscriptionId, subscription);

    // チャンネル -> 購読IDマッピングを更新
    if (!this.channelToSubscriptionIds.has(channel)) {
      this.channelToSubscriptionIds.set(channel, new Set());
    }
    this.channelToSubscriptionIds.get(channel)!.add(subscriptionId);

    return subscriptionId;
  }

  /**
   * イベント購読を解除する
   * ユーザー購読とチャンネル購読の両方に対応
   */
  unsubscribe(subscriptionId: string): void {
    // ユーザー購読を確認
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      // ユーザー -> 購読IDマッピングから削除
      const userSubs = this.userSubscriptions.get(subscription.userId);
      if (userSubs) {
        userSubs.delete(subscriptionId);
        if (userSubs.size === 0) {
          this.userSubscriptions.delete(subscription.userId);
        }
      }
      this.subscriptions.delete(subscriptionId);
      return;
    }

    // チャンネル購読を確認
    const channelSubscription = this.channelSubscriptions.get(subscriptionId);
    if (channelSubscription) {
      // チャンネル -> 購読IDマッピングから削除
      const channelSubs = this.channelToSubscriptionIds.get(channelSubscription.channel);
      if (channelSubs) {
        channelSubs.delete(subscriptionId);
        if (channelSubs.size === 0) {
          this.channelToSubscriptionIds.delete(channelSubscription.channel);
        }
      }
      this.channelSubscriptions.delete(subscriptionId);
    }
  }

  /**
   * イベントを発行する
   */
  publish(userId: string, eventType: string, data: unknown): void {
    for (const subscription of this.subscriptions.values()) {
      if (
        subscription.userId === userId &&
        subscription.eventType === eventType
      ) {
        try {
          subscription.callback(data);
        } catch (error) {
          // コールバック実行時のエラーは無視
          logger.error({ err: error, eventType }, "イベントコールバック実行時にエラーが発生しました");
        }
      }
    }
  }

  /**
   * チャンネルにイベントをブロードキャストする
   */
  broadcast(channel: string, data: unknown): void {
    const subscriptionIds = this.channelToSubscriptionIds.get(channel);
    if (!subscriptionIds) {
      return;
    }

    for (const subscriptionId of subscriptionIds) {
      const subscription = this.channelSubscriptions.get(subscriptionId);
      if (subscription) {
        try {
          subscription.callback(data);
        } catch (error) {
          // コールバック実行時のエラーは無視
          logger.error({ err: error, channel }, "ブロードキャストコールバック実行時にエラーが発生しました");
        }
      }
    }
  }

  /**
   * 特定ユーザーの全購読を解除する
   */
  unsubscribeAll(userId: string): void {
    const userSubs = this.userSubscriptions.get(userId);
    if (userSubs) {
      for (const subscriptionId of userSubs) {
        this.subscriptions.delete(subscriptionId);
      }
      this.userSubscriptions.delete(userId);
    }
  }

  /**
   * 現在の購読数を取得（テスト・デバッグ用）
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * 特定ユーザーの購読数を取得（テスト・デバッグ用）
   */
  getUserSubscriptionCount(userId: string): number {
    return this.userSubscriptions.get(userId)?.size ?? 0;
  }

  /**
   * チャンネル購読の総数を取得（テスト・デバッグ用）
   */
  getChannelSubscriptionCount(): number {
    return this.channelSubscriptions.size;
  }

  /**
   * 特定チャンネルの購読数を取得（テスト・デバッグ用）
   */
  getChannelSubscriberCount(channel: string): number {
    return this.channelToSubscriptionIds.get(channel)?.size ?? 0;
  }
}
