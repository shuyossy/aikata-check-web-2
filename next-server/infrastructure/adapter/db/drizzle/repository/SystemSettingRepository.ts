import { eq } from "drizzle-orm";
import { ISystemSettingRepository } from "@/application/shared/port/repository";
import { SystemSetting } from "@/domain/system-setting";
import { db } from "../index";
import { systemSettings } from "@/drizzle/schema";

/**
 * システム設定リポジトリ実装
 * Drizzle ORMを使用してPostgreSQLと通信
 */
export class SystemSettingRepository implements ISystemSettingRepository {
  /**
   * システム設定を取得
   * シングルトンなのでid=1のレコードを取得
   */
  async find(): Promise<SystemSetting | null> {
    const result = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.id, 1))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return SystemSetting.reconstruct({
      encryptedApiKey: row.encryptedApiKey,
      apiUrl: row.apiUrl,
      apiModel: row.apiModel,
      updatedAt: row.updatedAt,
    });
  }

  /**
   * システム設定を保存（更新 or 新規作成）
   */
  async save(setting: SystemSetting): Promise<void> {
    const dto = setting.toDto();

    await db
      .insert(systemSettings)
      .values({
        id: 1, // シングルトン
        encryptedApiKey: setting.encryptedApiKey,
        apiUrl: dto.apiUrl,
        apiModel: dto.apiModel,
        updatedAt: dto.updatedAt,
      })
      .onConflictDoUpdate({
        target: systemSettings.id,
        set: {
          encryptedApiKey: setting.encryptedApiKey,
          apiUrl: dto.apiUrl,
          apiModel: dto.apiModel,
          updatedAt: dto.updatedAt,
        },
      });
  }
}
