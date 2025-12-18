"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useAction } from "next-safe-action/hooks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Send, X, Check } from "lucide-react";
import { showError } from "@/lib/client/toast";
import { template } from "@/messages/ja/template";
import { executeQaAction } from "../actions";

/**
 * チェックリスト項目
 */
interface ChecklistItem {
  id: string;
  content: string;
}

interface QaInputFormProps {
  targetId: string;
  checklistItems: ChecklistItem[];
  onQaStart: (qaHistoryId: string, question: string, checklistItemContents: string[]) => void;
  disabled?: boolean;
}

/**
 * Q&A入力フォームコンポーネント
 * @メンション機能でチェックリスト項目を複数選択して質問する
 */
export function QaInputForm({
  targetId,
  checklistItems,
  onQaStart,
  disabled = false,
}: QaInputFormProps) {
  // 入力テキスト
  const [message, setMessage] = useState("");
  // 選択されたチェックリスト項目（複数選択対応）
  const [selectedItems, setSelectedItems] = useState<ChecklistItem[]>([]);
  // @メンションメニュー表示フラグ
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  // @メンション検索テキスト
  const [mentionSearchText, setMentionSearchText] = useState("");
  // IME入力中フラグ
  const [isComposing, setIsComposing] = useState(false);
  // テキストエリアの参照
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Q&A実行アクション
  const { execute: executeQa, isExecuting } = useAction(executeQaAction, {
    onSuccess: ({ data }) => {
      if (data?.qaHistoryId && selectedItems.length > 0) {
        onQaStart(data.qaHistoryId, message, selectedItems.map((item) => item.content));
        setMessage("");
        setSelectedItems([]);
      }
    },
    onError: ({ error }) => {
      // serverErrorはAppErrorPayload（オブジェクト）または文字列の可能性がある
      let errorMessage = "Q&Aの実行に失敗しました";
      if (error.serverError) {
        if (typeof error.serverError === "string") {
          errorMessage = error.serverError;
        } else if (typeof error.serverError === "object" && "message" in error.serverError) {
          errorMessage = error.serverError.message;
        }
      }
      showError(errorMessage);
    },
  });

  // 選択済みのチェックリストIDセット（高速検索用）
  const selectedItemIds = useMemo(
    () => new Set(selectedItems.map((item) => item.id)),
    [selectedItems]
  );

  // フィルタリングされたチェックリストオプション
  const filteredOptions = useMemo(() => {
    if (!mentionSearchText) return checklistItems;
    const lowerSearch = mentionSearchText.toLowerCase();
    return checklistItems.filter((item) =>
      item.content.toLowerCase().includes(lowerSearch)
    );
  }, [checklistItems, mentionSearchText]);

  // @メンション検出
  const detectMention = useCallback((text: string): { atIndex: number; searchText: string } | null => {
    const atIndex = text.lastIndexOf("@");
    if (atIndex === -1) return null;

    // @が行の先頭にあるかチェック
    if (atIndex > 0) {
      const beforeAt = text[atIndex - 1];
      // @の直前が改行でない場合はnullを返す
      if (beforeAt !== "\n") return null;
    }

    // @以降の文字列を取得
    const afterAt = text.slice(atIndex + 1);
    // 空白や改行があれば@メンション終了とみなす
    if (/\s/.test(afterAt)) return null;

    return { atIndex, searchText: afterAt };
  }, []);

  // 入力変更ハンドラ
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setMessage(newValue);

      // @メンション検出
      const mention = detectMention(newValue);
      if (mention) {
        setShowMentionMenu(true);
        setMentionSearchText(mention.searchText);
      } else {
        setShowMentionMenu(false);
        setMentionSearchText("");
      }
    },
    [detectMention]
  );

  // チェックリスト選択ハンドラ（トグル動作）
  const handleChecklistSelect = useCallback(
    (item: ChecklistItem) => {
      const mention = detectMention(message);

      // @検索文字列を削除
      let newMessage = message;
      if (mention) {
        const beforeAt = message.slice(0, mention.atIndex);
        const afterMention = message.slice(
          mention.atIndex + 1 + mention.searchText.length
        );
        newMessage = beforeAt + afterMention;
        setMessage(newMessage);
      }

      // 選択リストをトグル
      setSelectedItems((prev) => {
        const isSelected = prev.some((selected) => selected.id === item.id);
        if (isSelected) {
          // すでに選択されている場合は解除
          return prev.filter((selected) => selected.id !== item.id);
        } else {
          // 新規選択
          return [...prev, item];
        }
      });

      // メニューを閉じる
      setShowMentionMenu(false);
      setMentionSearchText("");

      // テキストエリアにフォーカスを戻す
      textareaRef.current?.focus();
    },
    [message, detectMention]
  );

  // 選択解除ハンドラ
  const handleRemoveSelection = useCallback((itemId: string) => {
    setSelectedItems((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  // 送信ハンドラ
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      // チェックリストが選択されていない場合は警告
      if (selectedItems.length === 0) {
        showError(template.QA_CHECKLIST_NOT_SELECTED);
        return;
      }

      // メッセージが空の場合は送信しない
      if (!message.trim()) {
        showError(template.QA_QUESTION_EMPTY);
        return;
      }

      // Q&A実行（複数のチェックリスト項目を送信）
      executeQa({
        reviewTargetId: targetId,
        question: message.trim(),
        checklistItemContents: selectedItems.map((item) => item.content),
      });
    },
    [selectedItems, message, executeQa, targetId]
  );

  // Enter キー送信（Shift+Enter で改行）
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !isComposing) {
        // @メンションメニューが表示されている場合
        if (showMentionMenu && filteredOptions.length > 0) {
          e.preventDefault();
          // 最初の項目を選択
          handleChecklistSelect(filteredOptions[0]);
          return;
        }

        // Shift+Enterの場合は改行を許可
        if (!e.shiftKey) {
          e.preventDefault();
          handleSubmit(e);
        }
      }
    },
    [isComposing, showMentionMenu, filteredOptions, handleChecklistSelect, handleSubmit]
  );

  // IME制御
  const handleCompositionStart = useCallback(() => setIsComposing(true), []);
  const handleCompositionEnd = useCallback(() => setIsComposing(false), []);

  // メニューを閉じる際の処理
  const handleMentionMenuOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setShowMentionMenu(false);
      setMentionSearchText("");
    }
  }, []);

  // テキストエリアの自動リサイズ
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [message]);

  const isSubmitDisabled = disabled || isExecuting || !message.trim() || selectedItems.length === 0;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
      {/* 選択中のチェックリスト項目（複数表示） */}
      {selectedItems.length > 0 && (
        <div className="mb-3 max-h-24 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {selectedItems.map((item) => (
              <Badge
                key={item.id}
                variant="secondary"
                className="bg-purple-100 text-purple-700 hover:bg-purple-200 cursor-default"
              >
                <span className="truncate max-w-xs">{item.content}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSelection(item.id)}
                  className="ml-1.5 hover:text-purple-900"
                  aria-label="選択解除"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 入力フォーム */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="flex-1 relative">
          <Popover open={showMentionMenu} onOpenChange={handleMentionMenuOpenChange}>
            <PopoverAnchor asChild>
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                placeholder={`質問を入力してください...\n@を入力するとチェック項目を選択できます（複数選択可）`}
                disabled={disabled || isExecuting}
                rows={2}
                className="resize-none min-h-[60px] max-h-[150px]"
              />
            </PopoverAnchor>
            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] p-0"
              align="start"
              side="top"
              sideOffset={5}
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <Command>
                <CommandList>
                  <CommandEmpty>該当するチェック項目がありません</CommandEmpty>
                  <CommandGroup>
                    {filteredOptions.map((item) => {
                      const isSelected = selectedItemIds.has(item.id);
                      return (
                        <CommandItem
                          key={item.id}
                          value={item.content}
                          onSelect={() => handleChecklistSelect(item)}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-2 w-full">
                            <div
                              className={`flex-shrink-0 w-4 h-4 rounded border ${
                                isSelected
                                  ? "bg-purple-500 border-purple-500 text-white"
                                  : "border-gray-300"
                              } flex items-center justify-center`}
                            >
                              {isSelected && <Check className="h-3 w-3" />}
                            </div>
                            <span className="truncate flex-1">@{item.content}</span>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <Button
          type="submit"
          disabled={isSubmitDisabled}
          className="h-auto px-4"
        >
          <Send className="h-5 w-5" />
          <span className="ml-2 hidden sm:inline">送信</span>
        </Button>
      </form>
      <p className="text-xs text-gray-400 mt-3 text-center">
        AIはレビュー結果とドキュメント内容を参照して回答します
      </p>
    </div>
  );
}
