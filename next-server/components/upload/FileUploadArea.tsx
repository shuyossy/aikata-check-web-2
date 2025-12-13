"use client";

import React, { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  UploadedFile,
  SUPPORTED_FILE_EXTENSIONS,
  formatFileSize,
  getFileExtension,
  isPdfFile,
} from "./types";
import { Upload, X, FileText, FileSpreadsheet, FileImage, File, Loader2, AlertCircle } from "lucide-react";

/**
 * FileUploadArea コンポーネントのプロパティ
 */
export interface FileUploadAreaProps {
  /** サポートするファイル拡張子 */
  acceptedFormats?: string[];
  /** 最大ファイルサイズ（バイト） */
  maxFileSize?: number;
  /** 最大ファイル数 */
  maxFiles?: number;
  /** アップロードされたファイル */
  files: UploadedFile[];
  /** ファイル変更時のコールバック */
  onFilesChange: (files: UploadedFile[]) => void;
  /** PDF画像変換機能を表示するか */
  showImageConversion?: boolean;
  /** 複数選択モードを有効にするか */
  enableMultiSelect?: boolean;
  /** 無効状態 */
  disabled?: boolean;
  /** クラス名 */
  className?: string;
}

/**
 * ファイルタイプに応じたアイコンを取得
 */
const getFileIcon = (file: UploadedFile) => {
  const extension = getFileExtension(file.name);

  switch (extension) {
    case ".pdf":
      return <FileText className="w-6 h-6 text-red-600" />;
    case ".docx":
      return <FileText className="w-6 h-6 text-blue-600" />;
    case ".xlsx":
    case ".csv":
      return <FileSpreadsheet className="w-6 h-6 text-green-600" />;
    case ".pptx":
      return <FileImage className="w-6 h-6 text-orange-600" />;
    case ".txt":
      return <File className="w-6 h-6 text-gray-600" />;
    default:
      return <File className="w-6 h-6 text-gray-600" />;
  }
};

/**
 * 処理モードセレクターコンポーネント
 */
interface ProcessModeSelectorProps {
  file: UploadedFile;
  disabled?: boolean;
  onModeChange: (fileId: string, willConvertToImage: boolean) => void;
}

const ProcessModeSelector: React.FC<ProcessModeSelectorProps> = ({
  file,
  disabled = false,
  onModeChange,
}) => {
  const isPdf = isPdfFile(file.file);
  const isImageMode = file.willConvertToImage === true;
  const isProcessing = file.status === "processing";

  // 非PDFファイルはテキスト抽出固定（disabled）
  const isDisabled = disabled || !isPdf || isProcessing;

  return (
    <div
      className={cn(
        "inline-flex rounded-md border",
        isDisabled ? "bg-gray-100 border-gray-200" : "bg-white border-gray-300"
      )}
    >
      <button
        type="button"
        className={cn(
          "px-3 py-1 text-xs font-medium rounded-l-md transition-colors",
          !isImageMode
            ? "bg-primary text-primary-foreground"
            : isDisabled
              ? "text-gray-400"
              : "text-gray-600 hover:bg-gray-50"
        )}
        disabled={isDisabled}
        onClick={() => onModeChange(file.id, false)}
      >
        テキスト抽出
      </button>
      <button
        type="button"
        className={cn(
          "px-3 py-1 text-xs font-medium rounded-r-md transition-colors border-l",
          isImageMode
            ? "bg-primary text-primary-foreground"
            : isDisabled
              ? "text-gray-400 border-gray-200"
              : "text-gray-600 hover:bg-gray-50 border-gray-300"
        )}
        disabled={isDisabled}
        onClick={() => onModeChange(file.id, true)}
      >
        画像変換
      </button>
    </div>
  );
};

/**
 * ステータスバッジを取得（エラー時のみ表示）
 */
const getStatusBadge = (file: UploadedFile) => {
  if (file.status === "processing") {
    return (
      <Badge variant="secondary" className="bg-blue-100 text-blue-700">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        処理中
      </Badge>
    );
  }

  if (file.status === "error") {
    return (
      <Badge variant="destructive" className="bg-red-100 text-red-700">
        <AlertCircle className="w-3 h-3 mr-1" />
        エラー
      </Badge>
    );
  }

  return null;
};

/**
 * ファイルアップロードエリアコンポーネント
 * ドラッグ&ドロップ対応、PDF画像変換機能付き
 */
export const FileUploadArea: React.FC<FileUploadAreaProps> = ({
  acceptedFormats = [...SUPPORTED_FILE_EXTENSIONS],
  maxFileSize = 50 * 1024 * 1024, // 50MB
  maxFiles = 10,
  files,
  onFilesChange,
  showImageConversion = true,
  enableMultiSelect = false,
  disabled = false,
  className,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 最後に選択したファイルのインデックス（Shift+クリック用）
  const lastSelectedIndex = useRef<number | null>(null);

  // ドラッグオーバー時の処理
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  // ドラッグ離脱時の処理
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  // ファイルドロップ時の処理
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const droppedFiles = Array.from(e.dataTransfer.files);
      processFiles(droppedFiles);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, files, maxFiles, maxFileSize, acceptedFormats, onFilesChange]
  );

  // ファイル選択時の処理
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled || !e.target.files) return;
      const selectedFiles = Array.from(e.target.files);
      processFiles(selectedFiles);
      // input をリセット（同じファイルを再選択できるように）
      e.target.value = "";
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, files, maxFiles, maxFileSize, acceptedFormats, onFilesChange]
  );

  // ファイルを処理してstateに追加
  const processFiles = (newFiles: File[]) => {
    const currentCount = files.length;
    const availableSlots = maxFiles - currentCount;

    if (availableSlots <= 0) {
      return;
    }

    const filesToAdd = newFiles.slice(0, availableSlots);
    const processedFiles: UploadedFile[] = filesToAdd
      .filter((file) => {
        // 拡張子チェック
        const ext = getFileExtension(file.name);
        if (!acceptedFormats.includes(ext)) {
          return false;
        }
        // ファイルサイズチェック
        if (file.size > maxFileSize) {
          return false;
        }
        // 重複チェック
        const isDuplicate = files.some(
          (f) => f.name === file.name && f.size === file.size
        );
        if (isDuplicate) {
          return false;
        }
        return true;
      })
      .map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: "pending" as const,
        processMode: isPdfFile(file) ? undefined : ("text" as const),
        // PDFファイルはデフォルトでテキスト抽出（画像変換しない）
        willConvertToImage: isPdfFile(file) ? false : undefined,
      }));

    if (processedFiles.length > 0) {
      onFilesChange([...files, ...processedFiles]);
    }
  };

  // ファイル削除
  const handleRemoveFile = useCallback(
    (fileId: string) => {
      onFilesChange(files.filter((f) => f.id !== fileId));
      setSelectedFileIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    },
    [files, onFilesChange]
  );

  // 処理モード変更
  const handleModeChange = useCallback(
    (fileId: string, willConvertToImage: boolean) => {
      onFilesChange(
        files.map((f) =>
          f.id === fileId ? { ...f, willConvertToImage } : f
        )
      );
    },
    [files, onFilesChange]
  );

  // 複数選択のトグル（Shift+クリック対応）
  const handleSelectToggle = useCallback(
    (fileId: string, index: number, shiftKey: boolean) => {
      // PDFファイルのみを対象にしたインデックスリストを作成
      const pdfFileIndices = files
        .map((f, i) => ({ file: f, index: i }))
        .filter(({ file }) => isPdfFile(file.file));

      setSelectedFileIds((prev) => {
        const next = new Set(prev);

        if (shiftKey && lastSelectedIndex.current !== null) {
          // Shift+クリック: 範囲選択
          const start = Math.min(lastSelectedIndex.current, index);
          const end = Math.max(lastSelectedIndex.current, index);

          // start〜endの範囲内のPDFファイルを全て選択
          pdfFileIndices.forEach(({ file, index: fileIndex }) => {
            if (fileIndex >= start && fileIndex <= end) {
              next.add(file.id);
            }
          });
        } else {
          // 通常クリック: トグル
          if (next.has(fileId)) {
            next.delete(fileId);
          } else {
            next.add(fileId);
          }
        }

        return next;
      });

      lastSelectedIndex.current = index;
    },
    [files]
  );

  // 一括処理モード変更（選択されたPDFのみ）
  const handleBatchModeChange = useCallback(
    (willConvertToImage: boolean) => {
      onFilesChange(
        files.map((f) =>
          selectedFileIds.has(f.id) && isPdfFile(f.file)
            ? { ...f, willConvertToImage }
            : f
        )
      );
      setSelectedFileIds(new Set());
    },
    [files, selectedFileIds, onFilesChange]
  );

  // 選択解除
  const handleClearSelection = useCallback(() => {
    setSelectedFileIds(new Set());
  }, []);

  // ドロップゾーンクリック
  const handleDropZoneClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 選択中のPDFファイル数
  const selectedPdfCount = Array.from(selectedFileIds).filter((id) => {
    const file = files.find((f) => f.id === id);
    return file && isPdfFile(file.file);
  }).length;

  // accept属性の値を生成
  const acceptValue = acceptedFormats.join(",");

  return (
    <div className={cn("space-y-4", className)}>
      {/* ドロップゾーン */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-gray-300 hover:border-primary/50 bg-gray-50 hover:bg-gray-100",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleDropZoneClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={acceptValue}
          multiple
          onChange={handleFileSelect}
          disabled={disabled}
        />
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
        <p className="text-base text-gray-700 font-medium mb-1">
          ファイルをドラッグ&ドロップ
        </p>
        <p className="text-sm text-gray-600 mb-3">
          または クリックして選択（複数ファイル対応）
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
          {acceptedFormats.map((ext) => (
            <Badge
              key={ext}
              variant="secondary"
              className="bg-gray-200 text-gray-700"
            >
              {ext.replace(".", "").toUpperCase()}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          各ファイル最大{formatFileSize(maxFileSize)} | 合計{maxFiles}
          ファイルまで
        </p>
      </div>

      {/* 一括操作ツールバー（PDFが1件以上選択時に表示） */}
      {enableMultiSelect && showImageConversion && selectedPdfCount > 0 && (
        <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg px-4 py-2">
          <span className="text-sm text-purple-800 font-medium">
            {selectedPdfCount}件のPDFを選択中
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBatchModeChange(false)}
              disabled={disabled}
              className="text-purple-700 border-purple-300 hover:bg-purple-100"
            >
              一括: テキスト抽出
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBatchModeChange(true)}
              disabled={disabled}
              className="text-purple-700 border-purple-300 hover:bg-purple-100"
            >
              一括: 画像変換
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSelection}
              disabled={disabled}
              className="text-gray-600"
            >
              選択解除
            </Button>
          </div>
        </div>
      )}

      {/* アップロードファイル一覧 */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={file.id}
              className={cn(
                "bg-gray-50 border rounded-lg p-4",
                file.status === "error"
                  ? "border-red-200"
                  : selectedFileIds.has(file.id)
                    ? "border-purple-300 bg-purple-50/50"
                    : "border-gray-200"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* 複数選択チェックボックス（Shift+クリック範囲選択対応） */}
                  {enableMultiSelect && showImageConversion && isPdfFile(file.file) && (
                    <Checkbox
                      checked={selectedFileIds.has(file.id)}
                      onCheckedChange={() => {}}
                      onClick={(e) => {
                        e.preventDefault();
                        handleSelectToggle(file.id, index, e.shiftKey);
                      }}
                      disabled={disabled || file.status === "processing"}
                      className="flex-shrink-0"
                    />
                  )}

                  <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                    {getFileIcon(file)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                    {file.error && (
                      <p className="text-xs text-red-600 mt-1">{file.error}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* 処理中/エラーバッジ */}
                  {getStatusBadge(file)}

                  {/* 処理モードセレクター */}
                  {showImageConversion && file.status !== "error" && (
                    <ProcessModeSelector
                      file={file}
                      disabled={disabled}
                      onModeChange={handleModeChange}
                    />
                  )}

                  {/* 削除ボタン */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFile(file.id)}
                    disabled={disabled || file.status === "processing"}
                    className="text-red-600 hover:text-red-800 hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUploadArea;
