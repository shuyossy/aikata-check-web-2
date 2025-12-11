import type { TextExtractorType } from "./TextExtractorType";

/**
 * テキスト抽出結果
 */
export interface TextExtractionResult {
  /** 抽出されたテキスト */
  content: string;
  /** メタデータ */
  metadata: {
    /** ファイル形式（拡張子） */
    fileType: string;
    /** 使用された抽出方式 */
    strategyUsed: TextExtractorType;
    /** 元ファイルのサイズ（バイト） */
    originalSize: number;
    /** 抽出後の文字数 */
    extractedLength: number;
  };
}

/**
 * テキスト抽出オプション
 * 将来の拡張用（エンコーディング指定など）
 */
export interface TextExtractorOptions {
  /** エンコーディング（デフォルト: utf-8） */
  encoding?: string;
}

/**
 * 形式別テキスト抽出戦略インターフェース
 * Strategy Patternを採用し、拡張子ごとに複数の抽出方式を提供可能
 */
export interface ITextExtractorStrategy {
  /**
   * この戦略がサポートする拡張子を取得
   * @returns サポートする拡張子の配列（例: ['.txt']）
   */
  getSupportedExtensions(): string[];

  /**
   * この戦略の識別子を取得
   * @returns 抽出方式の識別子
   */
  getStrategyType(): TextExtractorType;

  /**
   * ファイルバッファからテキスト項目を抽出
   * @param buffer ファイルのバイナリデータ
   * @param options 抽出オプション
   * @returns 抽出結果
   */
  extract(
    buffer: Buffer,
    options?: TextExtractorOptions,
  ): Promise<TextExtractionResult>;
}
