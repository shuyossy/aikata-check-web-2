import { encrypt, decrypt } from "@/lib/server/encryption";

/**
 * システム設定DTO
 * アプリケーション層への出力用
 */
export interface SystemSettingDto {
  /** 復号化済みAPIキー（未設定の場合はnull） */
  apiKey: string | null;
  /** AI APIのURL */
  apiUrl: string | null;
  /** AI APIのモデル名 */
  apiModel: string | null;
  /** 更新日時 */
  updatedAt: Date;
}

/**
 * システム設定作成用パラメータ
 */
export interface CreateSystemSettingParams {
  /** 平文のAPIキー（暗号化して保存） */
  apiKey: string | null;
  /** AI APIのURL */
  apiUrl: string | null;
  /** AI APIのモデル名 */
  apiModel: string | null;
}

/**
 * システム設定復元用パラメータ（DB復元用）
 */
export interface ReconstructSystemSettingParams {
  /** 暗号化済みAPIキー */
  encryptedApiKey: string | null;
  /** AI APIのURL */
  apiUrl: string | null;
  /** AI APIのモデル名 */
  apiModel: string | null;
  /** 更新日時 */
  updatedAt: Date;
}

/**
 * システム設定エンティティ
 * シングルトンパターン - システム全体で1つのみ存在
 * AI API設定（APIキー、URL、モデル名）を管理
 */
export class SystemSetting {
  /** シングルトンID（常に1） */
  private static readonly SINGLETON_ID = 1;

  private readonly _encryptedApiKey: string | null;
  private readonly _apiUrl: string | null;
  private readonly _apiModel: string | null;
  private readonly _updatedAt: Date;

  private constructor(
    encryptedApiKey: string | null,
    apiUrl: string | null,
    apiModel: string | null,
    updatedAt: Date,
  ) {
    this._encryptedApiKey = encryptedApiKey;
    this._apiUrl = apiUrl;
    this._apiModel = apiModel;
    this._updatedAt = updatedAt;
  }

  /**
   * 新規システム設定を作成する
   */
  static create(params: CreateSystemSettingParams): SystemSetting {
    const { apiKey, apiUrl, apiModel } = params;

    // APIキーを暗号化
    const encryptedApiKey = apiKey ? encrypt(apiKey) : null;

    return new SystemSetting(
      encryptedApiKey,
      apiUrl,
      apiModel,
      new Date(),
    );
  }

  /**
   * DBから取得したデータからシステム設定を復元する
   */
  static reconstruct(params: ReconstructSystemSettingParams): SystemSetting {
    const { encryptedApiKey, apiUrl, apiModel, updatedAt } = params;

    return new SystemSetting(
      encryptedApiKey,
      apiUrl,
      apiModel,
      updatedAt,
    );
  }

  /**
   * システム設定を更新する
   * 新しいインスタンスを返す（不変性を保持）
   * nullを渡した項目は既存値を保持する
   */
  update(params: CreateSystemSettingParams): SystemSetting {
    const { apiKey, apiUrl, apiModel } = params;

    // nullの場合は既存値を保持する
    const newEncryptedApiKey =
      apiKey !== null ? encrypt(apiKey) : this._encryptedApiKey;
    const newApiUrl = apiUrl !== null ? apiUrl : this._apiUrl;
    const newApiModel = apiModel !== null ? apiModel : this._apiModel;

    return new SystemSetting(newEncryptedApiKey, newApiUrl, newApiModel, new Date());
  }

  /**
   * 設定が有効かどうか（全項目が設定されているか）
   */
  isConfigured(): boolean {
    return (
      this._encryptedApiKey !== null &&
      this._apiUrl !== null &&
      this._apiModel !== null
    );
  }

  /**
   * DTOに変換する（APIキーは復号化）
   */
  toDto(): SystemSettingDto {
    return {
      apiKey: this._encryptedApiKey ? decrypt(this._encryptedApiKey) : null,
      apiUrl: this._apiUrl,
      apiModel: this._apiModel,
      updatedAt: this._updatedAt,
    };
  }

  // ゲッター
  get id(): number {
    return SystemSetting.SINGLETON_ID;
  }

  get encryptedApiKey(): string | null {
    return this._encryptedApiKey;
  }

  get apiUrl(): string | null {
    return this._apiUrl;
  }

  get apiModel(): string | null {
    return this._apiModel;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * 復号化したAPIキーを取得
   */
  decryptApiKey(): string | null {
    if (!this._encryptedApiKey) {
      return null;
    }
    return decrypt(this._encryptedApiKey);
  }
}
