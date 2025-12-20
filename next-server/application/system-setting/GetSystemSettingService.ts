import { ISystemSettingRepository } from "@/application/shared/port/repository";
import { SystemSettingDto } from "@/domain/system-setting";

/**
 * システム設定取得結果DTO
 * APIキーはマスクして返す
 */
export interface GetSystemSettingResultDto {
  /** APIキーが設定されているか（実際の値は返さない） */
  hasApiKey: boolean;
  /** AI APIのURL */
  apiUrl: string | null;
  /** AI APIのモデル名 */
  apiModel: string | null;
  /** 更新日時 */
  updatedAt: Date | null;
}

/**
 * システム設定取得サービス
 * 管理者画面での設定表示に使用
 */
export class GetSystemSettingService {
  constructor(private readonly systemSettingRepository: ISystemSettingRepository) {}

  /**
   * システム設定を取得する
   * @returns システム設定DTO（存在しない場合は全てnullのDTO）
   */
  async execute(): Promise<GetSystemSettingResultDto> {
    const setting = await this.systemSettingRepository.find();

    if (!setting) {
      return {
        hasApiKey: false,
        apiUrl: null,
        apiModel: null,
        updatedAt: null,
      };
    }

    const dto = setting.toDto();
    return {
      hasApiKey: dto.apiKey !== null,
      apiUrl: dto.apiUrl,
      apiModel: dto.apiModel,
      updatedAt: dto.updatedAt,
    };
  }

  /**
   * システム設定を取得する（内部利用用、APIキーも含む）
   * AIモデル取得など内部処理で使用
   * @returns システム設定DTO（存在しない場合はnull）
   */
  async executeInternal(): Promise<SystemSettingDto | null> {
    const setting = await this.systemSettingRepository.find();

    if (!setting) {
      return null;
    }

    return setting.toDto();
  }
}
