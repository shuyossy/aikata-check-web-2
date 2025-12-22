"use client";

import { useState, useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import {
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Bot,
  User,
  CheckCircle,
  Circle,
} from "lucide-react";
import { useSseSubscription } from "@/lib/client/useSseSubscription";
import type {
  QaSseEvent,
  QaResearchTask,
} from "@/application/shared/port/push/QaSseEventTypes";

/**
 * Q&A履歴データ
 */
interface QaHistoryData {
  id: string;
  question: string;
  checklistItemContent: string;
  answer: string | null;
  researchSummary: string | null;
  status: "pending" | "processing" | "completed" | "error";
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 調査サマリーアイテム
 */
interface ResearchSummaryItem {
  documentName: string;
  researchContent: string;
  researchResult: string;
}

/**
 * 調査タスクの状態
 */
interface ResearchTaskState extends QaResearchTask {
  status: "pending" | "in_progress" | "completed";
  result?: string;
}

interface QaHistoryListProps {
  histories: QaHistoryData[];
  /** 現在処理中のQ&A履歴ID（ストリーミング中の場合） */
  activeQaHistoryId?: string | null;
  /** 処理中の質問 */
  currentQuestion?: string | null;
  /** 処理中のチェックリスト項目内容 */
  currentChecklistItemContents?: string[];
  /** 完了時のコールバック */
  onComplete?: (
    qaHistoryId: string,
    answer: string,
    researchSummary: string,
  ) => void;
  /** エラー時のコールバック */
  onError?: (qaHistoryId: string, errorMessage: string) => void;
  /** 末尾にスクロールするコールバック（親コンポーネントで管理） */
  onScrollToBottom?: () => void;
}

/**
 * 日時フォーマット
 */
function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * チェックリスト項目の内容をパース
 * JSON配列または単一の文字列を配列として返す
 */
function parseChecklistItemContents(content: string): string[] {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [content];
  } catch {
    // JSONパースに失敗した場合は単一の文字列として扱う
    return [content];
  }
}

/**
 * Q&A履歴アイテムコンポーネント
 */
function QaHistoryItem({ history }: { history: QaHistoryData }) {
  const [isResearchOpen, setIsResearchOpen] = useState(false);

  // 調査サマリーをパース
  const researchSummary: ResearchSummaryItem[] | null = history.researchSummary
    ? (() => {
        try {
          return JSON.parse(history.researchSummary);
        } catch {
          return null;
        }
      })()
    : null;

  // チェックリスト項目をパース（複数対応）
  const checklistItemContents = parseChecklistItemContents(
    history.checklistItemContent,
  );

  const toggleResearch = useCallback(() => {
    setIsResearchOpen((prev) => !prev);
  }, []);

  return (
    <div className="space-y-4">
      {/* ユーザーの質問 */}
      <div className="flex gap-3 justify-end">
        <div className="flex-1 max-w-3xl">
          {/* チェック項目バッジ（複数表示） */}
          <div className="flex flex-wrap justify-end gap-1 mb-1">
            {checklistItemContents.map((content, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="bg-purple-100 text-purple-700 text-xs"
              >
                {content}
              </Badge>
            ))}
          </div>
          <div className="bg-blue-500 rounded-lg p-4 shadow-sm">
            <p className="text-sm text-white whitespace-pre-wrap">
              {history.question}
            </p>
          </div>
          <div className="text-xs text-gray-500 mt-1 text-right">
            {formatDateTime(history.createdAt)}
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white flex-shrink-0">
          <User className="h-4 w-4" />
        </div>
      </div>

      {/* AIの回答 */}
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white flex-shrink-0">
          <Bot className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <Card>
            <CardContent className="p-4">
              {/* 処理待機中 */}
              {history.status === "pending" && (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="h-4 w-4 border-2 border-gray-300 rounded-full" />
                  <span className="text-sm">処理待機中...</span>
                </div>
              )}

              {/* 処理中 */}
              {history.status === "processing" && (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="animate-spin h-4 w-4 border-2 border-purple-500 border-t-transparent rounded-full" />
                  <span className="text-sm">回答を生成中...</span>
                </div>
              )}

              {/* エラー */}
              {history.status === "error" && (
                <div className="flex items-start gap-2 text-red-600">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">エラーが発生しました</p>
                    {history.errorMessage && (
                      <p className="text-sm text-red-500 mt-1">
                        {history.errorMessage}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* 完了 */}
              {history.status === "completed" && history.answer && (
                <div className="space-y-4">
                  {/* 回答（マークダウンレンダリング） */}
                  <MarkdownRenderer className="text-sm text-gray-900">
                    {history.answer}
                  </MarkdownRenderer>

                  {/* 調査履歴（折りたたみ） */}
                  {researchSummary && researchSummary.length > 0 && (
                    <Collapsible
                      open={isResearchOpen}
                      onOpenChange={setIsResearchOpen}
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={toggleResearch}
                          className="text-gray-500 hover:text-gray-700 p-0 h-auto"
                        >
                          {isResearchOpen ? (
                            <ChevronUp className="h-4 w-4 mr-1" />
                          ) : (
                            <ChevronDown className="h-4 w-4 mr-1" />
                          )}
                          調査履歴を{isResearchOpen ? "閉じる" : "表示"}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-3 space-y-3 border-l-2 border-purple-200 pl-4">
                          {researchSummary.map((item, index) => (
                            <div key={index} className="text-sm">
                              <div className="font-medium text-gray-700 mb-1">
                                {item.documentName}
                              </div>
                              <div className="text-gray-500 text-xs mb-1">
                                調査内容: {item.researchContent}
                              </div>
                              <div className="text-gray-600 bg-gray-50 p-2 rounded text-xs whitespace-pre-wrap">
                                {item.researchResult}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          <div className="text-xs text-gray-500 mt-1">
            AI{" "}
            {history.status === "completed" &&
              `• ${formatDateTime(history.updatedAt)}`}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ストリーミング中のQ&Aアイテムコンポーネント
 */
interface StreamingQaItemProps {
  qaHistoryId: string;
  /** 質問テキスト（propsから渡す場合） */
  question?: string;
  /** チェックリスト項目内容（propsから渡す場合） */
  checklistItemContents?: string[];
  /** 履歴データ（処理中の既存履歴から表示する場合） */
  historyData?: QaHistoryData;
  onComplete: (
    qaHistoryId: string,
    answer: string,
    researchSummary: string,
  ) => void;
  onError: (qaHistoryId: string, errorMessage: string) => void;
  onScrollToBottom: () => void;
}

function StreamingQaItem({
  qaHistoryId,
  question: questionProp,
  checklistItemContents: checklistItemContentsProp,
  historyData,
  onComplete,
  onError,
  onScrollToBottom,
}: StreamingQaItemProps) {
  // propsまたは履歴データから質問とチェックリスト項目を取得
  const question = questionProp ?? historyData?.question ?? "";
  const checklistItemContents =
    checklistItemContentsProp ??
    (historyData
      ? parseChecklistItemContents(historyData.checklistItemContent)
      : []);
  // 調査タスクの状態
  const [researchTasks, setResearchTasks] = useState<ResearchTaskState[]>([]);
  // 回答テキスト（ストリーミング中）
  const [answerText, setAnswerText] = useState("");
  // 処理フェーズ（preparing: 質問分析中、researching: ドキュメント調査中）
  const [phase, setPhase] = useState<
    | "connecting"
    | "preparing"
    | "researching"
    | "answering"
    | "completed"
    | "error"
  >("connecting");
  // 準備中メッセージ
  const [preparingMessage, setPreparingMessage] = useState<string>("");
  // エラーメッセージ
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 完了した調査タスク数
  const completedTaskCount = researchTasks.filter(
    (t) => t.status === "completed",
  ).length;
  // 調査進捗率
  const researchProgress =
    researchTasks.length > 0
      ? (completedTaskCount / researchTasks.length) * 100
      : 0;

  // SSEイベントハンドラー
  const handleSseEvent = useCallback(
    (event: QaSseEvent) => {
      switch (event.type) {
        case "workflow_start":
          // ワークフロー開始：準備中フェーズに遷移
          setPhase("preparing");
          setPreparingMessage(event.data.message);
          // スクロール
          setTimeout(onScrollToBottom, 100);
          break;

        case "research_start":
          // 調査開始：タスク一覧を設定
          setResearchTasks(
            event.data.tasks.map((task) => ({
              ...task,
              status: "pending",
            })),
          );
          setPhase("researching");
          // スクロール
          setTimeout(onScrollToBottom, 100);
          break;

        case "research_progress":
          // 調査進捗：タスクの状態を更新
          setResearchTasks((prev) => {
            const existingTask = prev.find(
              (task) => task.documentName === event.data.documentName,
            );
            if (existingTask) {
              // 既存タスクを更新
              return prev.map((task) =>
                task.documentName === event.data.documentName
                  ? {
                      ...task,
                      status: event.data.status,
                      result: event.data.result,
                    }
                  : task,
              );
            } else {
              // 新しいタスクを追加
              return [
                ...prev,
                {
                  documentName: event.data.documentName,
                  researchContent: "",
                  status: event.data.status,
                  result: event.data.result,
                },
              ];
            }
          });
          if (
            phase !== "researching" &&
            phase !== "answering" &&
            phase !== "completed"
          ) {
            setPhase("researching");
          }
          break;

        case "answer_chunk":
          // 回答チャンク：テキストを追加
          if (phase !== "answering") {
            setPhase("answering");
          }
          setAnswerText((prev) => prev + event.data.text);
          // スクロール
          setTimeout(onScrollToBottom, 50);
          break;

        case "complete":
          // 完了
          setPhase("completed");
          setAnswerText(event.data.answer);
          const researchSummaryJson = JSON.stringify(
            event.data.researchSummary,
          );
          onComplete(qaHistoryId, event.data.answer, researchSummaryJson);
          break;

        case "error":
          // エラー
          setPhase("error");
          setErrorMessage(event.data.message);
          onError(qaHistoryId, event.data.message);
          break;
      }
    },
    [qaHistoryId, phase, onComplete, onError, onScrollToBottom],
  );

  // SSEエラーハンドラー
  const handleSseError = useCallback(() => {
    setPhase("error");
    setErrorMessage("接続エラーが発生しました");
    onError(qaHistoryId, "接続エラーが発生しました");
  }, [qaHistoryId, onError]);

  // SSE接続時のハンドラー
  // 注: フェーズ遷移はworkflow_startイベントで行われるため、ここではスクロールのみ
  const handleConnected = useCallback(() => {
    setTimeout(onScrollToBottom, 100);
  }, [onScrollToBottom]);

  // SSE購読
  const { connectionState } = useSseSubscription<QaSseEvent>({
    url: `/api/sse/qa/${qaHistoryId}`,
    onEvent: handleSseEvent,
    onError: handleSseError,
    onConnected: handleConnected,
    autoConnect: true,
  });

  // 接続状態に応じたフェーズ更新
  useEffect(() => {
    if (connectionState === "connecting") {
      setPhase("connecting");
    }
  }, [connectionState]);

  return (
    <div className="space-y-4">
      {/* ユーザーの質問 */}
      <div className="flex gap-3 justify-end">
        <div className="flex-1 max-w-3xl">
          {/* チェック項目バッジ（複数表示） */}
          <div className="flex flex-wrap justify-end gap-1 mb-1">
            {checklistItemContents.map((content, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="bg-purple-100 text-purple-700 text-xs"
              >
                {content}
              </Badge>
            ))}
          </div>
          <div className="bg-blue-500 rounded-lg p-4 shadow-sm">
            <p className="text-sm text-white whitespace-pre-wrap">{question}</p>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white flex-shrink-0">
          <User className="h-4 w-4" />
        </div>
      </div>

      {/* AIの応答 */}
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white flex-shrink-0">
          <Bot className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <Card>
            <CardContent className="p-4 space-y-4">
              {/* 接続中 */}
              {phase === "connecting" && (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="animate-spin h-4 w-4 border-2 border-purple-500 border-t-transparent rounded-full" />
                  <span className="text-sm">接続中...</span>
                </div>
              )}

              {/* 準備中フェーズ */}
              {phase === "preparing" && (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="animate-spin h-4 w-4 border-2 border-purple-500 border-t-transparent rounded-full" />
                  <span className="text-sm">
                    {preparingMessage || "質問を分析しています..."}
                  </span>
                </div>
              )}

              {/* 調査フェーズ */}
              {(phase === "researching" ||
                phase === "answering" ||
                phase === "completed") &&
                researchTasks.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-medium">調査中</span>
                      <span className="text-gray-500">
                        {completedTaskCount}/{researchTasks.length} 完了
                      </span>
                    </div>
                    <Progress value={researchProgress} className="h-2" />
                    <div className="space-y-2">
                      {researchTasks.map((task, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-2 text-sm"
                        >
                          {task.status === "completed" ? (
                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          ) : task.status === "in_progress" ? (
                            <div className="animate-spin h-4 w-4 border-2 border-purple-500 border-t-transparent rounded-full flex-shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="h-4 w-4 text-gray-300 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div
                              className={`truncate ${
                                task.status === "completed"
                                  ? "text-green-700"
                                  : task.status === "in_progress"
                                    ? "text-purple-700"
                                    : "text-gray-500"
                              }`}
                            >
                              {task.documentName}
                            </div>
                            {task.researchContent && (
                              <div className="text-xs text-gray-400 line-clamp-2 break-words">
                                {task.researchContent}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* 回答フェーズ */}
              {(phase === "answering" || phase === "completed") && (
                <div className="space-y-2">
                  {phase === "answering" && (
                    <div className="flex items-center gap-2 text-gray-600 text-sm font-medium">
                      <div className="animate-spin h-4 w-4 border-2 border-purple-500 border-t-transparent rounded-full" />
                      回答を生成中...
                    </div>
                  )}
                  {answerText && (
                    <div className="relative">
                      <MarkdownRenderer className="text-sm text-gray-900">
                        {answerText}
                      </MarkdownRenderer>
                      {phase === "answering" && (
                        <span className="inline-block w-2 h-4 bg-purple-500 animate-pulse ml-0.5" />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* エラー */}
              {phase === "error" && (
                <div className="flex items-start gap-2 text-red-600">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">エラーが発生しました</p>
                    {errorMessage && (
                      <p className="text-sm text-red-500 mt-1">
                        {errorMessage}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="text-xs text-gray-500 mt-1">AI</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Q&A履歴リストコンポーネント
 * 履歴は古い順（最新が下）で表示される
 * ストリーミング中のQ&Aも末尾に表示
 */
export function QaHistoryList({
  histories,
  activeQaHistoryId,
  currentQuestion,
  currentChecklistItemContents,
  onComplete,
  onError,
  onScrollToBottom,
}: QaHistoryListProps) {
  // スクロール制御は親コンポーネント（QaPageClient）が管理
  // onScrollToBottomがない場合はno-opのコールバックを使用
  const scrollToBottom = useCallback(() => {
    onScrollToBottom?.();
  }, [onScrollToBottom]);

  // ユーザーが自分で送信した新規Q&Aのストリーミング中かどうか
  const isNewQaStreaming = !!(
    activeQaHistoryId &&
    currentQuestion &&
    currentChecklistItemContents &&
    currentChecklistItemContents.length > 0 &&
    onComplete &&
    onError
  );

  // コールバックが設定されているか（ストリーミング対応可能か）
  const hasCallbacks = !!(onComplete && onError);

  // 何も表示するものがない場合
  if (histories.length === 0 && !isNewQaStreaming) {
    return null;
  }

  return (
    <div className="space-y-8 pb-6">
      {histories.map((history) => {
        // 現在のユーザーが送信したストリーミング中のQ&Aは後で別途レンダリングするのでスキップ
        if (history.id === activeQaHistoryId && isNewQaStreaming) {
          return null;
        }

        // 処理中の履歴はStreamingQaItemでレンダリング（リアルタイム更新を受信するため）
        if (history.status === "processing" && hasCallbacks) {
          return (
            <StreamingQaItem
              key={history.id}
              qaHistoryId={history.id}
              historyData={history}
              onComplete={onComplete!}
              onError={onError!}
              onScrollToBottom={scrollToBottom}
            />
          );
        }

        // 完了/エラー/pending状態の履歴は静的なQaHistoryItemでレンダリング
        return <QaHistoryItem key={history.id} history={history} />;
      })}
      {/* 現在のユーザーが送信した新規Q&A（マップ内でスキップされたもの） */}
      {isNewQaStreaming && (
        <StreamingQaItem
          key={`streaming-${activeQaHistoryId}`}
          qaHistoryId={activeQaHistoryId!}
          question={currentQuestion!}
          checklistItemContents={currentChecklistItemContents!}
          onComplete={onComplete!}
          onError={onError!}
          onScrollToBottom={scrollToBottom}
        />
      )}
    </div>
  );
}
