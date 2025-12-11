"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import {
  Plus,
  Save,
  Trash2,
  Download,
  Upload,
  Sparkles,
  Info,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import {
  bulkSaveCheckListItemsAction,
  bulkDeleteCheckListItemsAction,
} from "../actions";
import { CheckListItemListItemDto } from "@/domain/checkListItem";
import { extractServerErrorMessage } from "@/hooks";

interface CheckListEditClientProps {
  projectId: string;
  projectName: string;
  spaceId: string;
  spaceName: string;
  initialItems: CheckListItemListItemDto[];
  initialTotal: number;
}

interface EditableItem {
  id: string;
  content: string;
  isNew?: boolean;
}

/**
 * チェックリスト編集クライアントコンポーネント
 */
export function CheckListEditClient({
  projectId,
  projectName,
  spaceId,
  spaceName,
  initialItems,
}: CheckListEditClientProps) {
  // 編集中のアイテムリスト
  const [items, setItems] = useState<EditableItem[]>(
    initialItems.map((item) => ({
      id: item.id,
      content: item.content,
    })),
  );

  // 選択中のアイテムID
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 最後に選択したアイテムのインデックス（Shift+クリック用）
  const lastSelectedIndex = useRef<number | null>(null);

  // 変更があったかどうか
  const [hasChanges, setHasChanges] = useState(false);

  // 一括保存アクション
  const { execute: executeBulkSave, isExecuting: isSaving } = useAction(
    bulkSaveCheckListItemsAction,
    {
      onSuccess: () => {
        toast.success("チェックリストを保存しました");
        setHasChanges(false);
        // 空アイテムを除外し、新規フラグをクリア
        setItems((prev) =>
          prev
            .filter((item) => item.content.trim().length > 0)
            .map((item) => ({ ...item, isNew: false })),
        );
      },
      onError: ({ error: actionError }) => {
        const message = extractServerErrorMessage(
          actionError,
          "保存に失敗しました",
        );
        toast.error(message);
      },
    },
  );

  // 削除対象のIDを保持するref（onSuccess時に参照するため）
  const deletingItemIds = useRef<string[]>([]);

  // 一括削除アクション
  const { execute: executeBulkDelete, isExecuting: isDeleting } = useAction(
    bulkDeleteCheckListItemsAction,
    {
      onSuccess: (result) => {
        toast.success(`${result.data?.deletedCount}件のチェック項目を削除しました`);
        // 削除したアイテムを除去（refから削除対象IDを取得）
        const deletedIds = new Set(deletingItemIds.current);
        setItems((prev) => prev.filter((item) => !deletedIds.has(item.id)));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          deletingItemIds.current.forEach((id) => next.delete(id));
          return next;
        });
        setHasChanges(true);
        deletingItemIds.current = [];
      },
      onError: ({ error: actionError }) => {
        const message = extractServerErrorMessage(
          actionError,
          "削除に失敗しました",
        );
        toast.error(message);
        deletingItemIds.current = [];
      },
    },
  );

  // アイテム追加
  const handleAddItem = useCallback(() => {
    const newItem: EditableItem = {
      id: `new-${crypto.randomUUID()}`,
      content: "",
      isNew: true,
    };
    setItems((prev) => [...prev, newItem]);
    setHasChanges(true);
  }, []);

  // アイテム内容変更
  const handleContentChange = useCallback((id: string, content: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, content } : item)),
    );
    setHasChanges(true);
  }, []);

  // アイテム削除（単体）
  const handleDeleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setHasChanges(true);
  }, []);

  // チェックボックス選択（Shift+クリック対応）
  const handleSelect = useCallback(
    (id: string, index: number, shiftKey: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);

        if (shiftKey && lastSelectedIndex.current !== null) {
          // Shift+クリック: 範囲選択
          const start = Math.min(lastSelectedIndex.current, index);
          const end = Math.max(lastSelectedIndex.current, index);
          for (let i = start; i <= end; i++) {
            next.add(items[i].id);
          }
        } else {
          // 通常クリック: トグル
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
        }

        return next;
      });

      lastSelectedIndex.current = index;
    },
    [items],
  );

  // 全選択/解除
  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)));
    }
  }, [items, selectedIds.size]);

  // 選択した項目を一括削除
  const handleBulkDelete = useCallback(() => {
    // 新規作成されたアイテム（DBに存在しない）をローカルで削除
    const newItemIds = Array.from(selectedIds).filter((id) =>
      id.startsWith("new-"),
    );
    if (newItemIds.length > 0) {
      setItems((prev) => prev.filter((item) => !newItemIds.includes(item.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        newItemIds.forEach((id) => next.delete(id));
        return next;
      });
    }

    // 既存アイテムをDB削除
    const existingItemIds = Array.from(selectedIds).filter(
      (id) => !id.startsWith("new-"),
    );
    if (existingItemIds.length > 0) {
      // 削除対象IDをrefに保持（onSuccess時に参照するため）
      deletingItemIds.current = existingItemIds;
      executeBulkDelete({
        reviewSpaceId: spaceId,
        checkListItemIds: existingItemIds,
      });
    } else if (newItemIds.length > 0) {
      toast.success(`${newItemIds.length}件のチェック項目を削除しました`);
      setHasChanges(true);
    }
  }, [selectedIds, spaceId, executeBulkDelete]);

  // 保存
  const handleSave = useCallback(() => {
    // 空のアイテムを除外
    const validContents = items
      .map((item) => item.content.trim())
      .filter((content) => content.length > 0);

    executeBulkSave({
      reviewSpaceId: spaceId,
      contents: validContents,
    });
  }, [items, spaceId, executeBulkSave]);

  const isAllSelected = items.length > 0 && selectedIds.size === items.length;
  const hasSelected = selectedIds.size > 0;

  // 空のアイテムが存在するか確認
  const hasEmptyItems = useMemo(() => {
    return items.some((item) => !item.content.trim());
  }, [items]);

  return (
    <div className="flex-1 flex flex-col">
      {/* Page Content */}
      <main className="flex-1 p-6">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: projectName, href: `/projects/${projectId}/spaces` },
            { label: spaceName, href: `/projects/${projectId}/spaces/${spaceId}` },
            { label: "チェックリスト" },
          ]}
        />

        {/* Page Header with Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <h1 className="text-xl font-bold text-gray-900">チェックリスト編集</h1>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex items-center gap-2"
              disabled
            >
              <Download className="w-4 h-4" />
              CSV出力
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              disabled
            >
              <Upload className="w-4 h-4" />
              インポート
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2 bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
              disabled
            >
              <Sparkles className="w-4 h-4" />
              AI生成
            </Button>
            <Button
              onClick={handleAddItem}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              項目を追加
            </Button>
          </div>
        </div>

        {/* Info Alert */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
          <div className="flex items-start">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="ml-3">
              <p className="text-sm text-blue-800 font-medium">
                チェックリストの編集について
              </p>
              <p className="mt-1 text-sm text-blue-700">
                項目をクリックすると編集モードになります。編集後は必ず保存ボタンをクリックしてください。
              </p>
            </div>
          </div>
        </div>

        {/* Checklist Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {/* Table Header with Bulk Actions */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-gray-700">全て選択</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-700 hover:bg-gray-100"
                disabled={!hasSelected || isDeleting}
                onClick={handleBulkDelete}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                削除
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left w-12">
                    <span className="sr-only">選択</span>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    チェック項目
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32"
                  >
                    アクション
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <p>チェック項目がありません</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAddItem}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          最初の項目を追加
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50 transition duration-150 group"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => {}}
                          onClick={(e) => {
                            e.preventDefault();
                            handleSelect(item.id, index, e.shiftKey);
                          }}
                        />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <Textarea
                          value={item.content}
                          onChange={(e) =>
                            handleContentChange(item.id, e.target.value)
                          }
                          placeholder="チェック項目を入力..."
                          className="flex-1 border-transparent hover:border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary resize-none min-h-[38px] max-h-[120px] overflow-y-auto"
                          rows={1}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-900 opacity-0 group-hover:opacity-100 transition duration-150"
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              合計 <span className="font-medium">{items.length}</span> 項目
            </div>
            <div className="text-sm text-gray-500 flex items-center gap-4">
              {hasEmptyItems && (
                <span className="text-red-600 font-medium">
                  未入力の項目があります
                </span>
              )}
              {hasChanges && !hasEmptyItems && (
                <span className="text-orange-600 font-medium">
                  未保存の変更があります
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges || hasEmptyItems}
            className="flex items-center gap-2"
          >
            <Save className="w-5 h-5" />
            {isSaving ? "保存中..." : "変更を保存"}
          </Button>
        </div>

        {/* Help Section */}
        <div className="mt-6 bg-gray-100 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-gray-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                チェックリスト編集のヒント
              </p>
              <ul className="mt-2 text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>項目をクリックして直接編集できます</li>
                <li>編集後は「変更を保存」ボタンをクリックしてください</li>
                <li>
                  Shiftキーを押しながらクリックすると、範囲選択ができます
                </li>
                <li>CSV出力・インポート・AI生成機能は今後追加予定です</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
