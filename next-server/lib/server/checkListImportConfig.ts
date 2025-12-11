/**
 * チェックリストインポート設定
 * 環境変数から読み込む
 */
export const checkListImportConfig = {
  /** ファイルサイズ上限（MB） */
  maxFileSizeMB: parseInt(
    process.env.CHECK_LIST_IMPORT_MAX_FILE_SIZE_MB || "10",
    10,
  ),

  /** ファイルサイズ上限（バイト） */
  get maxFileSizeBytes(): number {
    return this.maxFileSizeMB * 1024 * 1024;
  },
};
