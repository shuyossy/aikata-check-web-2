/**
 * テキスト正規化オプション
 */
export interface TextNormalizerOptions {
  /** 連続空白（半角/全角/タブ/NBSP）を1つに圧縮 */
  collapseConsecutiveWhitespaces: boolean;
  /** 行頭インデントは保持したまま圧縮 */
  collapsePreserveIndent: boolean;
  /** 行末の空白を削除 */
  trimLineEndSpaces: boolean;
  /** 行末カンマを削除 */
  removeTrailingCommas: boolean;
  /** CSV の末尾空セルらしき行は行末カンマを温存する */
  preserveCsvTrailingEmptyFields: boolean;
  /** "空行"連続の最大許容数（例: 2） */
  maxConsecutiveBlankLines: number;
  /** カンマと空白のみで構成される行を削除 */
  removeCommaOnlyLines: boolean;
}

/**
 * テキスト正規化インターフェース
 * 抽出されたテキストの後処理を行う
 */
export interface ITextNormalizer {
  /**
   * テキストを正規化する
   * @param text 正規化対象のテキスト
   * @param options 正規化オプション（部分指定可能）
   * @returns 正規化されたテキスト
   */
  normalize(text: string, options?: Partial<TextNormalizerOptions>): string;

  /**
   * デフォルトのオプションを取得
   * @returns デフォルトの正規化オプション
   */
  getDefaultOptions(): TextNormalizerOptions;
}
