import { z } from "zod";

/**
 * ファイルの処理モード
 */
export const processModeSchema = z.enum(["text", "image"]);
export type ProcessMode = z.infer<typeof processModeSchema>;

/**
 * workflowのinputSchemaに渡すファイルメタデータ
 * Bufferは渡せないため、メタデータのみ
 */
export const rawUploadFileMetaSchema = z.object({
  /** ファイルの一意識別子 */
  id: z.string(),
  /** ファイル名 */
  name: z.string(),
  /** MIMEタイプ */
  type: z.string(),
  /** ファイルサイズ（バイト） */
  size: z.number(),
  /** 処理モード（テキストまたは画像） */
  processMode: processModeSchema,
  /** 画像変換済みの場合の画像数（PDF画像変換時に設定） */
  convertedImageCount: z.number().optional(),
});

export type RawUploadFileMeta = z.infer<typeof rawUploadFileMetaSchema>;

/**
 * RuntimeContextに格納する実際のファイルデータ
 * zodスキーマではBufferをシリアライズできないため、RuntimeContext経由で渡す
 */
export interface FileBufferData {
  /** 元ファイルのバイナリデータ */
  buffer: Buffer;
  /** PDF画像変換済みの場合のPNG画像バイナリ配列 */
  convertedImageBuffers?: Buffer[];
}

/**
 * RuntimeContextのキー定数
 */
export const FILE_BUFFERS_CONTEXT_KEY = "fileBuffers";

/**
 * RuntimeContextに格納するfileBuffersの型
 */
export type FileBuffersMap = Map<string, FileBufferData>;

/**
 * ファイル処理後の抽出済みファイル
 * fileProcessingStepの出力として使用
 */
export const extractedFileSchema = z.object({
  /** ファイルの一意識別子 */
  id: z.string(),
  /** ファイル名 */
  name: z.string(),
  /** MIMEタイプ */
  type: z.string(),
  /** 処理モード（テキストまたは画像） */
  processMode: processModeSchema,
  /** 抽出されたテキスト内容（テキストモード時） */
  textContent: z.string().optional(),
  /** Base64エンコードされた画像データ配列（画像モード時） */
  imageData: z.array(z.string()).optional(),
});

export type ExtractedFile = z.infer<typeof extractedFileSchema>;
