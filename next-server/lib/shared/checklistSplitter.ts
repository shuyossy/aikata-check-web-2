/**
 * チェックリスト分割ユーティリティ
 * クライアント・サーバー両方で使用可能
 */

/**
 * チェックリストのチャンク
 */
export interface CheckListChunk<T> {
  /** チャンクインデックス（0始まり） */
  chunkIndex: number;
  /** チャンク内のアイテム */
  items: T[];
}

/**
 * チェック項目を指定サイズで均等分割する
 * @param items 分割対象のアイテム配列
 * @param maxSize 各チャンクの最大サイズ
 * @returns 分割されたアイテムの2次元配列
 * @throws maxSizeが1未満の場合
 */
export function splitChecklistEqually<T>(items: T[], maxSize: number): T[][] {
  if (maxSize < 1) {
    throw new Error("maxSize must be at least 1");
  }
  if (items.length === 0) {
    return [];
  }

  // 必要なチャンク数を計算
  const parts = Math.ceil(items.length / maxSize);
  // 等分割のための基礎情報
  const baseSize = Math.floor(items.length / parts);
  const remainder = items.length % parts;

  const result: T[][] = [];
  let offset = 0;

  for (let i = 0; i < parts; i++) {
    // 先頭remainder個のチャンクには+1
    const thisSize = baseSize + (i < remainder ? 1 : 0);
    result.push(items.slice(offset, offset + thisSize));
    offset += thisSize;
  }

  return result;
}

/**
 * チェック項目を指定サイズで均等分割し、チャンク情報を付与する
 * @param items 分割対象のアイテム配列
 * @param maxSize 各チャンクの最大サイズ
 * @returns チャンク情報を含む配列
 * @throws maxSizeが1未満の場合
 */
export function splitChecklistIntoChunks<T>(
  items: T[],
  maxSize: number,
): CheckListChunk<T>[] {
  const chunks = splitChecklistEqually(items, maxSize);
  return chunks.map((chunkItems, index) => ({
    chunkIndex: index,
    items: chunkItems,
  }));
}
