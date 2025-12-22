"use client";

import { useState, useCallback, useRef } from "react";
import { useAction } from "next-safe-action/hooks";
import { Upload, FileText, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { importCheckListFromFileAction } from "../actions/importCheckListFromFile";
import { extractServerErrorMessage } from "@/hooks";
import {
  showError,
  showSuccess,
  getMessage,
  formatClientMessage,
} from "@/lib/client";

interface CheckListImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewSpaceId: string;
  onImportSuccess: () => void;
}

const ACCEPTED_FILE_TYPES = {
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],
  "application/vnd.ms-excel": [".xls"],
};

const ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".xls"];

/**
 * チェックリストインポートモーダル
 */
export function CheckListImportModal({
  open,
  onOpenChange,
  reviewSpaceId,
  onImportSuccess,
}: CheckListImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [skipHeaderRow, setSkipHeaderRow] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { execute, isExecuting } = useAction(importCheckListFromFileAction, {
    onSuccess: (result) => {
      showSuccess(
        formatClientMessage("SUCCESS_CHECKLIST_IMPORTED", {
          count: result.data?.importedCount ?? 0,
        }),
      );
      handleClose();
      onImportSuccess();
    },
    onError: ({ error: actionError }) => {
      const message = extractServerErrorMessage(
        actionError,
        "インポートに失敗しました",
      );
      showError(message);
    },
  });

  const handleClose = useCallback(() => {
    if (!isExecuting) {
      setFile(null);
      setSkipHeaderRow(false);
      onOpenChange(false);
    }
  }, [isExecuting, onOpenChange]);

  const validateFile = useCallback((file: File): boolean => {
    const extension = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      showError(getMessage("ERROR_UNSUPPORTED_FILE_FORMAT_CHECKLIST"));
      return false;
    }
    return true;
  }, []);

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
      }
    },
    [validateFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFileSelect(selectedFile);
      }
    },
    [handleFileSelect],
  );

  const handleImport = useCallback(async () => {
    if (!file) return;

    try {
      // FormDataでファイルを送信
      const formData = new FormData();
      formData.append("reviewSpaceId", reviewSpaceId);
      formData.append("file", file);
      formData.append("skipHeaderRow", String(skipHeaderRow));

      execute(formData);
    } catch {
      showError(getMessage("ERROR_FILE_READ_FAILED"));
    }
  }, [file, execute, reviewSpaceId, skipHeaderRow]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>チェックリストのインポート</DialogTitle>
          <DialogDescription>
            csv, xlsx, xlsファイルからチェックリストをインポートします。
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* ファイル選択エリア */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              isDragOver
                ? "border-primary bg-primary/5"
                : file
                  ? "border-green-500 bg-green-50"
                  : "border-gray-300 hover:border-gray-400"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept={ACCEPTED_EXTENSIONS.join(",")}
              onChange={handleFileInputChange}
            />

            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-8 h-8 text-green-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-10 h-10 mx-auto text-gray-400" />
                <p className="text-gray-600">
                  ファイルをドラッグ&ドロップ
                  <br />
                  または
                  <span className="text-primary font-medium">
                    クリックして選択
                  </span>
                </p>
                <p className="text-xs text-gray-500">
                  対応形式: csv, xlsx, xls
                </p>
              </div>
            )}
          </div>

          {/* インポートオプション */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-900">
              インポートオプション
            </h4>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="skipHeaderRow"
                checked={skipHeaderRow}
                onCheckedChange={(checked) =>
                  setSkipHeaderRow(checked === true)
                }
              />
              <label
                htmlFor="skipHeaderRow"
                className="text-sm text-gray-700 cursor-pointer"
              >
                1行目をヘッダーとしてスキップ
              </label>
            </div>
          </div>

          {/* 注意事項 */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">注意事項</p>
                <ul className="mt-1 list-disc list-inside space-y-1 text-amber-700">
                  <li>
                    インポートされた項目は既存のチェックリストに追加されます
                  </li>
                  <li>
                    CSV/Excelファイルは1列目のみがチェック項目として読み込まれます
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isExecuting}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || isExecuting}
            className="flex items-center gap-2"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                インポート中...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                インポート
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
