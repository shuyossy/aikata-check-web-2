import type { TextNormalizerOptions } from "./ITextNormalizer";
import type { TextExtractorOptions } from "./ITextExtractorStrategy";
import type { TextExtractorType } from "./TextExtractorType";

/**
 * ファイルテキスト抽出オプション
 */
export interface FileTextExtractorOptions extends TextExtractorOptions {
  /** 使用する抽出方式（省略時はデフォルト） */
  strategyType?: TextExtractorType;
  /** 抽出後の正規化を行うか（デフォルト: true） */
  normalize?: boolean;
  /** 正規化オプション（normalizeがtrueの場合に適用） */
  normalizerOptions?: Partial<TextNormalizerOptions>;
}

/**
 * ファイルテキスト抽出オーケストレーターインターフェース
 * 拡張子に応じた抽出戦略の選択と正規化を行う
 */
export interface IFileTextExtractor {
  /**
   * ファイルからテキストを抽出
   * @param buffer ファイルのバイナリデータ
   * @param fileName ファイル名（拡張子の判定に使用）
   * @param options 抽出オプション
   * @returns 抽出されたテキスト
   */
  extract(
    buffer: Buffer,
    fileName: string,
    options?: FileTextExtractorOptions,
  ): Promise<string>;

  /**
   * 指定した拡張子で利用可能な抽出方式一覧を取得
   * @param extension 拡張子（例: '.xlsx'）
   * @returns 利用可能な抽出方式の配列
   */
  getAvailableStrategies(extension: string): TextExtractorType[];

  /**
   * サポートされている拡張子かどうかを判定
   * @param extension 拡張子（例: '.xlsx'）
   * @returns サポートされている場合true
   */
  isSupported(extension: string): boolean;
}
