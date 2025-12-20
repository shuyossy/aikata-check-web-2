import { SystemSetting } from "@/domain/system-setting";

/**
 * システム設定リポジトリインターフェース
 * インフラ層で実装される
 */
export interface ISystemSettingRepository {
  /**
   * システム設定を取得
   * @returns システム設定エンティティ（存在しない場合はnull）
   */
  find(): Promise<SystemSetting | null>;

  /**
   * システム設定を保存（新規作成または更新）
   * @param setting システム設定エンティティ
   */
  save(setting: SystemSetting): Promise<void>;
}
