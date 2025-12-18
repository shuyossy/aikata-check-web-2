/**
 * 調査サマリーの1項目
 */
export interface ResearchSummaryItem {
  /** ドキュメント名 */
  documentName: string;
  /** 調査内容 */
  researchContent: string;
  /** 調査結果 */
  researchResult: string;
}

/**
 * 調査サマリー値オブジェクト
 * AIによる調査履歴を表す
 */
export class ResearchSummary {
  private readonly _items: ReadonlyArray<ResearchSummaryItem>;

  private constructor(items: ResearchSummaryItem[]) {
    this._items = Object.freeze([...items]);
  }

  /**
   * 調査サマリーを作成する
   */
  static create(items: ResearchSummaryItem[]): ResearchSummary {
    return new ResearchSummary(items);
  }

  /**
   * 空の調査サマリーを作成する
   */
  static empty(): ResearchSummary {
    return new ResearchSummary([]);
  }

  /**
   * JSONから復元する（DBから読み込み時など）
   */
  static fromJson(json: unknown): ResearchSummary {
    if (!Array.isArray(json)) {
      return ResearchSummary.empty();
    }
    const items = json.map((item) => ({
      documentName: String(item?.documentName ?? ""),
      researchContent: String(item?.researchContent ?? ""),
      researchResult: String(item?.researchResult ?? ""),
    }));
    return new ResearchSummary(items);
  }

  /**
   * 調査サマリー項目を取得
   */
  get items(): ReadonlyArray<ResearchSummaryItem> {
    return this._items;
  }

  /**
   * 空かどうか
   */
  isEmpty(): boolean {
    return this._items.length === 0;
  }

  /**
   * JSONに変換する（DB保存時など）
   */
  toJson(): ResearchSummaryItem[] {
    return [...this._items];
  }

  /**
   * 等価性の比較
   */
  equals(other: ResearchSummary): boolean {
    if (this._items.length !== other._items.length) {
      return false;
    }
    return this._items.every((item, index) => {
      const otherItem = other._items[index];
      return (
        item.documentName === otherItem.documentName &&
        item.researchContent === otherItem.researchContent &&
        item.researchResult === otherItem.researchResult
      );
    });
  }
}
