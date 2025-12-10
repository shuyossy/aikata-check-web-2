import { vi } from "vitest";

// グローバルモックの設定
// 必要に応じてここにグローバルなモックやセットアップを追加

// 環境変数のモック（テスト時のデフォルト値）
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.NEXTAUTH_SECRET = "test-secret-key-for-testing-only";
process.env.NEXTAUTH_URL = "http://localhost:3000";
