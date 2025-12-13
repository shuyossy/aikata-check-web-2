/**
 * アップロードファイルの処理状態
 */
export type UploadFileStatus =
  | "pending"
  | "processing"
  | "complete"
  | "error";

/**
 * ファイルの処理モード
 * - text: テキストとして処理
 * - image: 画像として処理（PDFの画像変換後など）
 */
export type ProcessMode = "text" | "image";

/**
 * アップロードされたファイルの情報
 */
export interface UploadedFile {
  /** 一意識別子 */
  id: string;
  /** 元のファイルオブジェクト */
  file: File;
  /** ファイル名 */
  name: string;
  /** ファイルサイズ（バイト） */
  size: number;
  /** MIMEタイプ */
  type: string;
  /** 処理状態 */
  status: UploadFileStatus;
  /** 処理モード */
  processMode?: ProcessMode;
  /** エラーメッセージ */
  error?: string;
  /** 画像変換予定フラグ（PDFの遅延変換用） */
  willConvertToImage?: boolean;
  /** PDF画像変換後のPNGファイル配列（FormData送信用） */
  convertedImages?: File[];
}

/**
 * サポートされるファイル形式
 */
export const SUPPORTED_FILE_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".xlsx",
  ".pptx",
  ".csv",
  ".txt",
] as const;

export type SupportedFileExtension = (typeof SUPPORTED_FILE_EXTENSIONS)[number];

/**
 * ファイル形式とMIMEタイプのマッピング
 */
export const FILE_MIME_TYPES: Record<SupportedFileExtension, string[]> = {
  ".pdf": ["application/pdf"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  ".pptx": [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  ".csv": ["text/csv", "application/csv"],
  ".txt": ["text/plain"],
};

/**
 * 拡張子からファイルタイプを取得
 */
export const getFileTypeFromExtension = (
  extension: string,
): SupportedFileExtension | undefined => {
  const ext = extension.toLowerCase() as SupportedFileExtension;
  return SUPPORTED_FILE_EXTENSIONS.includes(ext) ? ext : undefined;
};

/**
 * ファイル名から拡張子を取得
 */
export const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.substring(lastDot).toLowerCase();
};

/**
 * PDFファイルかどうかを判定
 */
export const isPdfFile = (file: File): boolean => {
  return (
    file.type === "application/pdf" ||
    getFileExtension(file.name) === ".pdf"
  );
};

/**
 * ファイルサイズをフォーマット
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};
