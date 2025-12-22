import path from "path";
import type {
  IFileTextExtractor,
  FileTextExtractorOptions,
  TextExtractorType,
  ITextNormalizer,
} from "@/application/shared/port/textExtractor";
import { TextExtractorStrategyFactory } from "./TextExtractorStrategyFactory";
import { TextNormalizer } from "./TextNormalizer";

/**
 * ファイルテキスト抽出オーケストレーター
 * 拡張子に応じた抽出戦略の選択と正規化を行う
 */
export class FileTextExtractor implements IFileTextExtractor {
  private factory: TextExtractorStrategyFactory;
  private normalizer: ITextNormalizer;

  constructor(
    factory?: TextExtractorStrategyFactory,
    normalizer?: ITextNormalizer,
  ) {
    this.factory = factory ?? new TextExtractorStrategyFactory();
    this.normalizer = normalizer ?? new TextNormalizer();
  }

  /**
   * ファイルからテキストを抽出
   * @param buffer ファイルのバイナリデータ
   * @param fileName ファイル名（拡張子の判定に使用）
   * @param options 抽出オプション
   * @returns 抽出されたテキスト
   */
  async extract(
    buffer: Buffer,
    fileName: string,
    options?: FileTextExtractorOptions,
  ): Promise<string> {
    const extension = path.extname(fileName).toLowerCase();

    // 戦略を取得
    const strategy = options?.strategyType
      ? this.factory.getStrategyByType(extension, options.strategyType)
      : this.factory.getStrategy(extension);

    if (!strategy) {
      throw new Error(`サポートされていないファイル形式です: ${extension}`);
    }

    // 抽出実行
    const result = await strategy.extract(buffer, {
      encoding: options?.encoding,
    });

    // 正規化を適用するかどうか（デフォルトでtrue）
    const shouldNormalize = options?.normalize !== false;

    if (shouldNormalize) {
      return this.normalizer.normalize(
        result.content,
        options?.normalizerOptions,
      );
    }

    return result.content;
  }

  /**
   * 指定した拡張子で利用可能な抽出方式一覧を取得
   * @param extension 拡張子（例: '.xlsx'）
   * @returns 利用可能な抽出方式の配列
   */
  getAvailableStrategies(extension: string): TextExtractorType[] {
    return this.factory.getAvailableStrategies(extension);
  }

  /**
   * サポートされている拡張子かどうかを判定
   * @param extension 拡張子（例: '.xlsx'）
   * @returns サポートされている場合true
   */
  isSupported(extension: string): boolean {
    return this.factory.isSupported(extension);
  }
}
