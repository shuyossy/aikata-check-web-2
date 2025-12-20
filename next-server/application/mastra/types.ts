/**
 * Mastra共通のRuntimeContext基底型
 * すべてのワークフロー・エージェントのRuntimeContextはこの型を継承する
 */
export type BaseRuntimeContext = {
  employeeId?: string;
  projectApiKey?: string;
  /** システム設定のAPIキー（管理者設定） */
  systemApiKey?: string;
  /** システム設定のAPI URL（管理者設定） */
  systemApiUrl?: string;
  /** システム設定のAPIモデル名（管理者設定） */
  systemApiModel?: string;
};
