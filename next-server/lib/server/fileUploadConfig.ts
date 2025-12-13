/**
 * ファイルアップロード共通設定
 * 環境変数から読み込み、全機能で統一的に利用
 */
export const fileUploadConfig = {
  /** ファイルサイズ上限（MB） */
  maxFileSizeMB: parseInt(
    process.env.FILE_UPLOAD_MAX_FILE_SIZE_MB || "50",
    10,
  ),

  /** ファイルサイズ上限（バイト） */
  get maxFileSizeBytes(): number {
    return this.maxFileSizeMB * 1024 * 1024;
  },
};
