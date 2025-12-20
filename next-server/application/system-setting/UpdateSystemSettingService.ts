import { ISystemSettingRepository } from "@/application/shared/port/repository";
import { SystemSetting } from "@/domain/system-setting";

/**
 * システム設定更新コマンド
 */
export interface UpdateSystemSettingCommand {
  /** 平文のAPIキー（nullの場合は未設定） */
  apiKey: string | null;
  /** AI APIのURL */
  apiUrl: string | null;
  /** AI APIのモデル名 */
  apiModel: string | null;
}

/**
 * システム設定更新結果DTO
 */
export interface UpdateSystemSettingResultDto {
  /** APIキーが設定されているか */
  hasApiKey: boolean;
  /** AI APIのURL */
  apiUrl: string | null;
  /** AI APIのモデル名 */
  apiModel: string | null;
  /** 更新日時 */
  updatedAt: Date;
}

/**
 * システム設定更新サービス
 * 管理者画面での設定更新に使用
 */
export class UpdateSystemSettingService {
  constructor(private readonly systemSettingRepository: ISystemSettingRepository) {}

  /**
   * システム設定を更新する
   * @param command 更新コマンド
   * @returns 更新後のシステム設定DTO
   */
  async execute(command: UpdateSystemSettingCommand): Promise<UpdateSystemSettingResultDto> {
    const { apiKey, apiUrl, apiModel } = command;

    // 既存の設定を取得
    const existingSetting = await this.systemSettingRepository.find();

    let setting: SystemSetting;
    if (existingSetting) {
      // 既存設定を更新
      setting = existingSetting.update({
        apiKey,
        apiUrl,
        apiModel,
      });
    } else {
      // 新規作成
      setting = SystemSetting.create({
        apiKey,
        apiUrl,
        apiModel,
      });
    }

    await this.systemSettingRepository.save(setting);

    const dto = setting.toDto();
    return {
      hasApiKey: dto.apiKey !== null,
      apiUrl: dto.apiUrl,
      apiModel: dto.apiModel,
      updatedAt: dto.updatedAt,
    };
  }
}
