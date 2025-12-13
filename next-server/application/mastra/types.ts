/**
 * Mastra共通のRuntimeContext基底型
 * すべてのワークフロー・エージェントのRuntimeContextはこの型を継承する
 */
export type BaseRuntimeContext = {
  employeeId?: string;
  projectApiKey?: string;
};
