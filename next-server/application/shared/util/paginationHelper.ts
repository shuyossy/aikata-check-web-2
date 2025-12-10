/**
 * ページネーションパラメータ正規化オプション
 */
export interface NormalizePaginationOptions {
  /** ページ番号（1始まり） */
  page?: number;
  /** 1ページあたりの件数 */
  limit?: number;
  /** デフォルトの1ページあたりの件数 */
  defaultLimit: number;
  /** 最大の1ページあたりの件数 */
  maxLimit: number;
}

/**
 * 正規化されたページネーションパラメータ
 */
export interface NormalizedPagination {
  /** 正規化されたページ番号 */
  page: number;
  /** 正規化された1ページあたりの件数 */
  limit: number;
  /** オフセット */
  offset: number;
}

/**
 * ページネーションパラメータを正規化
 * @param options 正規化オプション
 * @returns 正規化されたパラメータ
 */
export function normalizePagination(
  options: NormalizePaginationOptions,
): NormalizedPagination {
  const { page: rawPage, limit: rawLimit, defaultLimit, maxLimit } = options;

  const page = Math.max(1, rawPage ?? 1);
  const limit = Math.min(maxLimit, Math.max(1, rawLimit ?? defaultLimit));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}
