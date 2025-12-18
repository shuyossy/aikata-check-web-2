/**
 * イベントブローカーインターフェース
 * ユーザーへのリアルタイム通知を管理する
 */
export interface IEventBroker {
  /**
   * イベントを購読する
   * @param userId ユーザーID
   * @param eventType イベントタイプ（例: "qa:${qaHistoryId}"）
   * @param callback イベント受信時のコールバック
   * @returns 購読ID（購読解除時に使用）
   */
  subscribe(
    userId: string,
    eventType: string,
    callback: (data: unknown) => void,
  ): string;

  /**
   * チャンネルを購読する（ユーザーIDに依存しない）
   * 同じチャンネルを購読している全てのクライアントにイベントが配信される
   * @param channel チャンネル名（例: "qa:${qaHistoryId}"）
   * @param callback イベント受信時のコールバック
   * @returns 購読ID（購読解除時に使用）
   */
  subscribeChannel(channel: string, callback: (data: unknown) => void): string;

  /**
   * イベント購読を解除する
   * @param subscriptionId 購読ID
   */
  unsubscribe(subscriptionId: string): void;

  /**
   * イベントを発行する
   * @param userId ユーザーID
   * @param eventType イベントタイプ
   * @param data イベントデータ
   */
  publish(userId: string, eventType: string, data: unknown): void;

  /**
   * チャンネルにイベントをブロードキャストする
   * 同じチャンネルを購読している全てのクライアントにイベントが配信される
   * @param channel チャンネル名
   * @param data イベントデータ
   */
  broadcast(channel: string, data: unknown): void;

  /**
   * 特定ユーザーの全購読を解除する
   * @param userId ユーザーID
   */
  unsubscribeAll(userId: string): void;
}
