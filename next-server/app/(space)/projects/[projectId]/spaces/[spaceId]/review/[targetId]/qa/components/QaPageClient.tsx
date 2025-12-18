"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { QaInputForm } from "./QaInputForm";
import { QaHistoryList } from "./QaHistoryList";

/**
 * チェックリスト項目
 */
interface ChecklistItem {
  id: string;
  content: string;
}

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

interface QaPageClientProps {
  projectId: string;
  projectName: string;
  spaceId: string;
  spaceName: string;
  targetId: string;
  targetName: string;
  checklistItems: ChecklistItem[];
  initialHistories: QaHistoryData[];
}

/**
 * Q&Aページクライアントコンポーネント
 */
export function QaPageClient({
  projectId,
  projectName,
  spaceId,
  spaceName,
  targetId,
  targetName,
  checklistItems,
  initialHistories,
}: QaPageClientProps) {
  // 現在処理中のQ&A履歴ID
  const [activeQaHistoryId, setActiveQaHistoryId] = useState<string | null>(null);
  // 履歴リスト（初期値はサーバーから取得、古い順にソート）
  const [histories, setHistories] = useState<QaHistoryData[]>(() => {
    // 初期履歴を古い順（createdAt昇順）にソート
    return [...initialHistories].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  });
  // ストリーミング中の状態
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [currentChecklistItemContents, setCurrentChecklistItemContents] = useState<string[]>([]);

  // 履歴リストの表示用（古い順 = 最新が下）
  const sortedHistories = useMemo(() => {
    return [...histories].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [histories]);

  // Q&A実行開始時のハンドラー
  const handleQaStart = useCallback(
    (qaHistoryId: string, question: string, checklistItemContents: string[]) => {
      setActiveQaHistoryId(qaHistoryId);
      setCurrentQuestion(question);
      setCurrentChecklistItemContents(checklistItemContents);
      // 履歴リストに新規項目を末尾に追加（processing状態）
      // checklistItemContentはJSON配列として保存
      setHistories((prev) => [
        ...prev,
        {
          id: qaHistoryId,
          question,
          checklistItemContent: JSON.stringify(checklistItemContents),
          answer: null,
          researchSummary: null,
          status: "processing",
          errorMessage: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    },
    []
  );

  // Q&A完了時のハンドラー
  const handleQaComplete = useCallback(
    (qaHistoryId: string, answer: string, researchSummary: string) => {
      setActiveQaHistoryId(null);
      setCurrentQuestion(null);
      setCurrentChecklistItemContents([]);
      // 履歴リストを更新
      setHistories((prev) =>
        prev.map((history) =>
          history.id === qaHistoryId
            ? {
                ...history,
                answer,
                researchSummary,
                status: "completed" as const,
                updatedAt: new Date(),
              }
            : history
        )
      );
    },
    []
  );

  // Q&Aエラー時のハンドラー
  const handleQaError = useCallback((qaHistoryId: string, errorMessage: string) => {
    setActiveQaHistoryId(null);
    setCurrentQuestion(null);
    setCurrentChecklistItemContents([]);
    // 履歴リストを更新
    setHistories((prev) =>
      prev.map((history) =>
        history.id === qaHistoryId
          ? {
              ...history,
              status: "error" as const,
              errorMessage,
              updatedAt: new Date(),
            }
          : history
      )
    );
  }, []);

  // 入力可能かどうか
  const isInputEnabled = activeQaHistoryId === null;

  // スクロールコンテナの参照
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 末尾にスクロール
  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, []);

  // 履歴が追加されたら末尾にスクロール
  const prevHistoriesLengthRef = useRef(histories.length);
  useEffect(() => {
    if (histories.length > prevHistoriesLengthRef.current) {
      scrollToBottom();
    }
    prevHistoriesLengthRef.current = histories.length;
  }, [histories.length, scrollToBottom]);

  // 初回マウント時も末尾にスクロール
  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  // activeQaHistoryIdが変わったら（新規ストリーミング開始時）末尾にスクロール
  useEffect(() => {
    if (activeQaHistoryId) {
      scrollToBottom();
    }
  }, [activeQaHistoryId, scrollToBottom]);

  return (
    // 親のp-6を打ち消し、画面全体を使う
    <div className="-m-6 h-[calc(100vh-64px)] flex flex-col">
      {/* ヘッダー部分（Breadcrumb + Title） */}
      <div className="px-6 pt-6 pb-4 bg-gray-50 border-b flex-shrink-0">
        <Breadcrumb
          items={[
            { label: projectName, href: `/projects/${projectId}/spaces` },
            {
              label: spaceName,
              href: `/projects/${projectId}/spaces/${spaceId}`,
            },
            {
              label: targetName,
              href: `/projects/${projectId}/spaces/${spaceId}/review/${targetId}`,
            },
            { label: "Q&A" },
          ]}
        />
        <div className="mt-4">
          <h2 className="text-xl font-bold text-gray-900">Q&A</h2>
          <p className="text-sm text-gray-500 mt-1">
            レビュー結果について質問できます。@でチェック項目を選択してください。
          </p>
        </div>
      </div>

      {/* メインコンテンツエリア */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Q&A履歴リスト（スクロール可能エリア） */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6">
          <div className="max-w-5xl mx-auto w-full py-6">
            {(sortedHistories.length > 0 || activeQaHistoryId) && (
              <QaHistoryList
                histories={sortedHistories}
                activeQaHistoryId={activeQaHistoryId}
                currentQuestion={currentQuestion}
                currentChecklistItemContents={currentChecklistItemContents}
                onComplete={handleQaComplete}
                onError={handleQaError}
                onScrollToBottom={scrollToBottom}
              />
            )}

            {/* 履歴なし・処理中でない場合の案内 */}
            {!activeQaHistoryId && histories.length === 0 && (
              <div className="flex items-center justify-center h-[calc(100vh-350px)]">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">💬</span>
                  </div>
                  <p className="text-gray-900 font-medium mb-2">
                    レビュー結果について質問してみましょう
                  </p>
                  <p className="text-sm text-gray-500 max-w-md">
                    @を入力するとチェック項目を選択できます。選択した項目についての詳しい説明や改善方法を質問できます。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 入力フォーム（下部固定） */}
        <div className="flex-shrink-0 border-t bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="max-w-5xl mx-auto w-full px-6 py-4">
            <QaInputForm
              targetId={targetId}
              checklistItems={checklistItems}
              onQaStart={handleQaStart}
              disabled={!isInputEnabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
