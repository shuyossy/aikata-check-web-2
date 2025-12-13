import type {
  ITextExtractorStrategy,
  TextExtractorType,
} from "@/application/shared/port/textExtractor";
import { TxtExtractorStrategy } from "./strategies/TxtExtractorStrategy";
import { CsvExtractorStrategy } from "./strategies/CsvExtractorStrategy";
import { XlsxSheetJsStrategy } from "./strategies/XlsxSheetJsStrategy";
import { DocxExtractorStrategy } from "./strategies/DocxExtractorStrategy";
import { PptxExtractorStrategy } from "./strategies/PptxExtractorStrategy";
import { PdfExtractorStrategy } from "./strategies/PdfExtractorStrategy";

/**
 * 拡張子ごとのデフォルト戦略マッピング
 */
const DEFAULT_STRATEGY_MAP: Record<string, TextExtractorType> = {
  ".txt": "txt-default",
  ".csv": "csv-default",
  ".xlsx": "xlsx-sheetjs",
  ".xls": "xlsx-sheetjs",
  ".docx": "docx-mammoth",
  ".pptx": "pptx-officeparser",
  ".pdf": "unpdf",
};

/**
 * テキスト抽出戦略ファクトリ
 * 拡張子と抽出方式からStrategy実装を解決する
 */
export class TextExtractorStrategyFactory {
  private strategies: Map<TextExtractorType, ITextExtractorStrategy>;

  constructor() {
    this.strategies = new Map();
    this.registerDefaultStrategies();
  }

  /**
   * デフォルトの戦略を登録
   */
  private registerDefaultStrategies(): void {
    this.registerStrategy(new TxtExtractorStrategy());
    this.registerStrategy(new CsvExtractorStrategy());
    this.registerStrategy(new XlsxSheetJsStrategy());
    this.registerStrategy(new DocxExtractorStrategy());
    this.registerStrategy(new PptxExtractorStrategy());
    this.registerStrategy(new PdfExtractorStrategy());
  }

  /**
   * 戦略を登録
   * @param strategy 登録する戦略
   */
  registerStrategy(strategy: ITextExtractorStrategy): void {
    this.strategies.set(strategy.getStrategyType(), strategy);
  }

  /**
   * 拡張子から戦略を取得（デフォルト戦略を使用）
   * @param extension 拡張子（例: '.xlsx'）
   * @returns 戦略インスタンス、サポートされていない場合はundefined
   */
  getStrategy(extension: string): ITextExtractorStrategy | undefined {
    const normalizedExt = extension.toLowerCase();
    const defaultType = DEFAULT_STRATEGY_MAP[normalizedExt];

    if (!defaultType) {
      return undefined;
    }

    return this.strategies.get(defaultType);
  }

  /**
   * 拡張子と戦略タイプを指定して戦略を取得
   * @param extension 拡張子（例: '.xlsx'）
   * @param strategyType 戦略タイプ
   * @returns 戦略インスタンス、サポートされていない場合はundefined
   */
  getStrategyByType(
    extension: string,
    strategyType: TextExtractorType,
  ): ITextExtractorStrategy | undefined {
    const strategy = this.strategies.get(strategyType);

    if (!strategy) {
      return undefined;
    }

    // 戦略が指定された拡張子をサポートしているか確認
    const normalizedExt = extension.toLowerCase();
    if (!strategy.getSupportedExtensions().includes(normalizedExt)) {
      return undefined;
    }

    return strategy;
  }

  /**
   * 指定した拡張子で利用可能な戦略一覧を取得
   * @param extension 拡張子（例: '.xlsx'）
   * @returns 利用可能な戦略タイプの配列
   */
  getAvailableStrategies(extension: string): TextExtractorType[] {
    const normalizedExt = extension.toLowerCase();
    const available: TextExtractorType[] = [];

    for (const strategy of this.strategies.values()) {
      if (strategy.getSupportedExtensions().includes(normalizedExt)) {
        available.push(strategy.getStrategyType());
      }
    }

    return available;
  }

  /**
   * サポートされている拡張子の一覧を取得
   * @returns サポートされている拡張子の配列
   */
  getSupportedExtensions(): string[] {
    const extensions = new Set<string>();

    for (const strategy of this.strategies.values()) {
      for (const ext of strategy.getSupportedExtensions()) {
        extensions.add(ext);
      }
    }

    return Array.from(extensions);
  }

  /**
   * 指定した拡張子がサポートされているか判定
   * @param extension 拡張子（例: '.xlsx'）
   * @returns サポートされている場合true
   */
  isSupported(extension: string): boolean {
    const normalizedExt = extension.toLowerCase();
    return DEFAULT_STRATEGY_MAP[normalizedExt] !== undefined;
  }
}
