import { APICallError } from "ai";
import { AppError, extractAIAPISafeError } from "@/lib/server/error";

/**
 * 文書を等分ベースで分割し、指定のオーバーラップを安全に付与する関数
 * - テキスト: overlapChars 文字
 * - 画像配列: overlapItems 個
 * - 取りこぼし無し、負インデックス無し、end超過はクリップ
 * - 各チャンクに原文カバレッジ範囲（start,end）をメタとして付与
 *
 * @param data 分割対象（文字列または配列など、lengthプロパティを持つもの）
 * @param splitCount 分割数
 * @param overlap オーバーラップ量（文字数または要素数）
 * @returns 分割範囲の配列
 */
export function makeChunksByCount<T extends { length: number }>(
  data: T,
  splitCount: number,
  overlap: number,
): Array<{ start: number; end: number }> {
  const total = data.length;

  // ガード: 空データや不正パラメータ
  if (total === 0 || splitCount <= 0) {
    return [{ start: 0, end: 0 }];
  }

  // ベースとなる等分幅（オーバーラップを除いた基準幅）
  const base = Math.ceil(total / splitCount);

  const ranges: Array<{ start: number; end: number }> = [];

  for (let i = 0; i < splitCount; i++) {
    // ベースの等分範囲（半開区間）
    const baseStart = i * base;
    const baseEnd = Math.min((i + 1) * base, total);

    // オーバーラップは、前後に付与するが、両端は片側のみ
    const extendLeft = i > 0 ? overlap : 0;
    const extendRight = i < splitCount - 1 ? overlap : 0;

    // 実際のチャンク開始・終了（安全にクリップ）
    const start = Math.max(0, baseStart - extendLeft);
    const end = Math.min(total, baseEnd + extendRight);

    // 連続性をさらに堅牢にするため、前チャンクの end を下回らないように調整
    if (ranges.length > 0) {
      const prevEnd = ranges[ranges.length - 1].end;
      // 万一、計算誤差で「隙間」が出る場合は、start を前の end に寄せる
      const fixedStart = Math.min(Math.max(start, prevEnd - overlap), total);
      ranges.push({ start: fixedStart, end });
    } else {
      ranges.push({ start, end });
    }
  }

  // 念のため、最後のチャンクが必ず total まで伸びていることを保証
  ranges[ranges.length - 1].end = total;

  return ranges;
}

/**
 * コンテキスト長エラーかどうかを判定する関数
 * AI APIからのエラーやfinishReasonを検査し、コンテキスト長超過エラーかを判定
 *
 * @param error エラーオブジェクトまたはfinishReason
 * @returns コンテキスト長エラーの場合はtrue
 */
export const judgeErrorIsContentLengthError = (error: unknown) => {
  const apiError = extractAIAPISafeError(error);
  if (!apiError) return false;
  if (apiError instanceof AppError) {
    return apiError.messageCode === "AI_MESSAGE_TOO_LARGE";
  }
  if (APICallError.isInstance(apiError)) {
    return (
      apiError.responseBody?.includes("maximum context length") ||
      apiError.responseBody?.includes("tokens_limit_reached") ||
      apiError.responseBody?.includes("context_length_exceeded") ||
      apiError.responseBody?.includes("many images")
    );
  }
  return false;
};

/**
 * デフォルトの分割オーバーラップ設定
 */
export const DEFAULT_CHUNK_OVERLAP = {
  /** テキスト分割時のオーバーラップ文字数 */
  TEXT_CHARS: 300,
  /** 画像分割時のオーバーラップ枚数 */
  IMAGE_COUNT: 3,
} as const;

/**
 * テキストを指定された分割数で分割し、各チャンクを文字列として返す
 *
 * @param text 分割対象のテキスト
 * @param splitCount 分割数
 * @param overlapChars オーバーラップ文字数（デフォルト: 300）
 * @returns 分割されたテキストチャンクの配列
 */
export function splitTextByCount(
  text: string,
  splitCount: number,
  overlapChars: number = DEFAULT_CHUNK_OVERLAP.TEXT_CHARS,
): string[] {
  const ranges = makeChunksByCount(text, splitCount, overlapChars);
  return ranges.map((range) => text.slice(range.start, range.end));
}

/**
 * 画像配列を指定された分割数で分割し、各チャンクを配列として返す
 *
 * @param images 分割対象の画像配列（base64文字列の配列）
 * @param splitCount 分割数
 * @param overlapCount オーバーラップ枚数（デフォルト: 3）
 * @returns 分割された画像チャンクの配列
 */
export function splitImagesByCount(
  images: string[],
  splitCount: number,
  overlapCount: number = DEFAULT_CHUNK_OVERLAP.IMAGE_COUNT,
): string[][] {
  const ranges = makeChunksByCount(images, splitCount, overlapCount);
  return ranges.map((range) => images.slice(range.start, range.end));
}
