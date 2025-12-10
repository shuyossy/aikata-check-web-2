export const template = {
  UNKNOWN_ERROR: `予期せぬエラーが発生しました。`,
  VALIDATION_ERROR: `不正なリクエストパラメータを検知しました\n{detail}`,
  VALIDATION_GENERAL_PARAM_ERROR: `不正なリクエストパラメータを検知しました`,
  DATA_ACCESS_ERROR: `データ操作中にエラーが発生しました\n{detail}`,
  UNAUTHORIZED_ERROR: `認証されていません。ログインが必要です。`,
  AI_MESSAGE_TOO_LARGE: `AIへの入力データが大きすぎます。入力データを減らしてください。`,
  AI_API_ERROR: `AIのAPIと通信中にエラーが発生しました\n{detail}`,
  ANALYSIS_DUPLICATE_COMMIT_IN_PROGRESS: `同じコミットの分析が進行中のため処理を終了しました`,
  // URL関連
  INVALID_URL_FORMAT: `無効なURL形式です`,
  // ユーザ管理ドメインバリデーションエラー
  USER_ID_INVALID_FORMAT: `ユーザIDの形式が不正です。有効なUUID形式である必要があります。`,
  EMPLOYEE_ID_EMPTY: `社員IDは必須です。`,
  EMPLOYEE_ID_TOO_LONG: `社員IDは255文字以内で入力してください。`,
  DISPLAY_NAME_EMPTY: `表示名は必須です。`,
  // 認証エラー
  USER_SYNC_FAILED: `システムに問題が発生しており、ログイン処理を完了できません`,
} as const;
