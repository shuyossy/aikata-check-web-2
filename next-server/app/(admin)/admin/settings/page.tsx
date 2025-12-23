import { SystemSettingRepository } from "@/infrastructure/adapter/db";
import { GetSystemSettingService } from "@/application/system-setting";
import { SettingsClient } from "./components/SettingsClient";

// ビルド時のpre-renderingをスキップ（DBアクセスが必要なため）
export const dynamic = "force-dynamic";

/**
 * API設定管理ページ（サーバーコンポーネント）
 * RSCで初期データを取得してクライアントコンポーネントに渡す
 */
export default async function AdminSettingsPage() {
  const repository = new SystemSettingRepository();
  const service = new GetSystemSettingService(repository);
  const settings = await service.execute();

  return <SettingsClient initialSettings={settings} />;
}
