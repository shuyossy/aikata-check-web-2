/**
 * Q&A SSEイベントの型定義
 * シンプルなSSE形式でQ&A処理の進捗をリアルタイム通知する
 */

/**
 * 調査タスク情報
 */
export interface QaResearchTask {
  /** ドキュメント名 */
  documentName: string;
  /** 調査内容 */
  researchContent: string;
}

/**
 * 調査開始イベント
 */
export interface QaResearchStartEvent {
  type: "research_start";
  data: {
    tasks: QaResearchTask[];
  };
}

/**
 * 調査進捗イベント
 */
export interface QaResearchProgressEvent {
  type: "research_progress";
  data: {
    /** ドキュメント名 */
    documentName: string;
    /** ステータス */
    status: "in_progress" | "completed";
    /** 調査結果（completedの場合のみ） */
    result?: string;
  };
}

/**
 * 回答チャンクイベント（ストリーミング）
 */
export interface QaAnswerChunkEvent {
  type: "answer_chunk";
  data: {
    /** 回答テキストのチャンク */
    text: string;
  };
}

/**
 * 完了イベント
 */
export interface QaCompleteEvent {
  type: "complete";
  data: {
    /** 最終回答 */
    answer: string;
    /** 調査サマリー */
    researchSummary: Array<{
      documentName: string;
      researchContent: string;
      researchResult: string;
    }>;
  };
}

/**
 * エラーイベント
 */
export interface QaErrorEvent {
  type: "error";
  data: {
    /** エラーメッセージ */
    message: string;
  };
}

/**
 * ワークフロー開始イベント
 * SSE接続確立後、ワークフロー開始直前に発行される
 */
export interface QaWorkflowStartEvent {
  type: "workflow_start";
  data: {
    /** 進捗メッセージ */
    message: string;
  };
}

/**
 * Q&A SSEイベントの共用体型
 */
export type QaSseEvent =
  | QaWorkflowStartEvent
  | QaResearchStartEvent
  | QaResearchProgressEvent
  | QaAnswerChunkEvent
  | QaCompleteEvent
  | QaErrorEvent;
