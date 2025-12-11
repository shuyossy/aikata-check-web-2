// テキスト抽出ポート
// アプリケーション層のインターフェース定義

export type { TextExtractorType } from "./TextExtractorType";
export type {
  TextExtractionResult,
  TextExtractorOptions,
  ITextExtractorStrategy,
} from "./ITextExtractorStrategy";
export type {
  TextNormalizerOptions,
  ITextNormalizer,
} from "./ITextNormalizer";
export type {
  FileTextExtractorOptions,
  IFileTextExtractor,
} from "./IFileTextExtractor";
