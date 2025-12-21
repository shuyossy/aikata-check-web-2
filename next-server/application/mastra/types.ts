/**
 * Mastra共通のRuntimeContext基底型
 * すべてのワークフロー・エージェントのRuntimeContextはこの型を継承する
 *
 * キューイング時点で確定した最終的なAPI設定のみを保持する
 * 優先順位判定（プロジェクト > システム > 環境変数）は事前に行われる
 */
export type BaseRuntimeContext = {
  /** 実行ユーザーID */
  employeeId?: string;
  /** 確定済みAPIキー（優先順位判定済み） */
  aiApiKey?: string;
  /** 確定済みAPIモデル名 */
  aiApiModel?: string;
  /** 確定済みAPI URL */
  aiApiUrl?: string;
};
