"use client";

import { useState, useCallback } from "react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { Sparkles, Info, HelpCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { FileUploadArea, UploadedFile, isPdfFile } from "@/components/upload";
import { convertPdfFileToFiles, showError, showSuccess } from "@/lib/client";
import { generateCheckListByAIAction } from "../actions";
import { extractServerErrorMessage } from "@/hooks";

interface AIChecklistGenerateClientProps {
  projectId: string;
  projectName: string;
  spaceId: string;
  spaceName: string;
  /** ファイルサイズ上限（バイト） */
  maxFileSize?: number;
}

/**
 * FormData送信用のメタデータ型
 */
interface FileMetadata {
  id: string;
  name: string;
  type: string;
  size: number;
  processMode: "text" | "image";
  convertedImageCount?: number;
}

/**
 * AIチェックリスト生成クライアントコンポーネント
 */
export function AIChecklistGenerateClient({
  projectId,
  projectName,
  spaceId,
  spaceName,
  maxFileSize,
}: AIChecklistGenerateClientProps) {
  const router = useRouter();

  // ファイル状態
  const [files, setFiles] = useState<UploadedFile[]>([]);

  // チェックリスト生成要件
  const [checklistRequirements, setChecklistRequirements] = useState("");

  // PDF変換中フラグ
  const [isConverting, setIsConverting] = useState(false);

  // AI生成アクション（FormData対応）
  const { execute: executeGenerate, isExecuting } = useAction(
    generateCheckListByAIAction,
    {
      onSuccess: (result) => {
        showSuccess(`${result.data?.generatedCount}件のチェック項目を生成しました`);
        // チェックリスト編集画面に遷移
        router.push(`/projects/${projectId}/spaces/${spaceId}/checklist`);
      },
      onError: ({ error: actionError }) => {
        const message = extractServerErrorMessage(
          actionError,
          "チェックリスト生成に失敗しました",
        );
        showError(message);
      },
    }
  );

  // UI用の統合ローディングフラグ
  const isProcessing = isConverting || isExecuting;

  // ファイル変更時のハンドラー
  const handleFilesChange = useCallback((newFiles: UploadedFile[]) => {
    setFiles(newFiles);

    // 新規追加されたpending状態のファイルを即座にcomplete状態に変更
    // （テキスト抽出はサーバー側で行うため、クライアントでは処理不要）
    const updatedFiles = newFiles.map((file) => {
      if (file.status === "pending") {
        if (isPdfFile(file.file)) {
          // PDFファイルはcomplete状態に（ユーザーが処理モードを選択可能）
          return { ...file, status: "complete" as const };
        } else {
          // 非PDFファイルは自動でtextモードに設定してcomplete
          return {
            ...file,
            status: "complete" as const,
            processMode: "text" as const,
          };
        }
      }
      return file;
    });

    // 状態が変わったファイルがあれば更新
    const hasChanges = updatedFiles.some(
      (f, i) => f.status !== newFiles[i].status || f.processMode !== newFiles[i].processMode
    );
    if (hasChanges) {
      setFiles(updatedFiles);
    }
  }, []);

  // 生成ボタンの有効/無効判定
  const canGenerate = useCallback(() => {
    // ファイルがあるか
    if (files.length === 0) return false;

    // 全てのファイルがcomplete状態か
    const allComplete = files.every((f) => f.status === "complete");
    if (!allComplete) return false;

    // PDFファイルはwillConvertToImageが設定されているか
    const allPdfReady = files
      .filter((f) => isPdfFile(f.file))
      .every((f) => f.willConvertToImage !== undefined);
    if (!allPdfReady) return false;

    // チェックリスト生成要件が入力されているか
    if (!checklistRequirements.trim()) return false;

    return true;
  }, [files, checklistRequirements]);

  /**
   * PDF画像変換を実行し、ファイルリストを更新
   */
  const processPdfFiles = async (
    currentFiles: UploadedFile[]
  ): Promise<UploadedFile[]> => {
    const result: UploadedFile[] = [];

    for (const file of currentFiles) {
      if (isPdfFile(file.file) && file.willConvertToImage === true) {
        // 画像変換を実行（File形式で取得）
        const convertedImages = await convertPdfFileToFiles(file.file);

        result.push({
          ...file,
          status: "complete",
          processMode: "image",
          convertedImages,
          willConvertToImage: false, // 変換完了後はフラグをクリア
        });
      } else if (isPdfFile(file.file) && file.willConvertToImage === false) {
        // テキスト抽出モードのPDF
        result.push({
          ...file,
          processMode: "text",
        });
      } else {
        result.push(file);
      }
    }

    return result;
  };

  /**
   * FormDataを構築
   */
  const buildFormData = (
    processedFiles: UploadedFile[],
    reviewSpaceId: string,
    requirements: string
  ): FormData => {
    const formData = new FormData();

    // 基本パラメータを追加
    formData.append("reviewSpaceId", reviewSpaceId);
    formData.append("checklistRequirements", requirements);

    // メタデータ配列を構築
    const metadata: FileMetadata[] = [];

    processedFiles.forEach((file, index) => {
      // メタデータを追加
      const fileMeta: FileMetadata = {
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        processMode: file.processMode || "text",
      };

      // 画像モードの場合、変換済み画像数を追加
      if (file.processMode === "image" && file.convertedImages) {
        fileMeta.convertedImageCount = file.convertedImages.length;
      }

      metadata.push(fileMeta);

      // 元ファイルを追加
      formData.append(`file_${index}`, file.file);

      // 変換済み画像を追加（存在する場合）
      if (file.convertedImages && file.convertedImages.length > 0) {
        file.convertedImages.forEach((img, imgIndex) => {
          formData.append(`file_${index}_image_${imgIndex}`, img);
        });
      }
    });

    // メタデータをJSON文字列として追加
    formData.append("metadata", JSON.stringify(metadata));

    return formData;
  };

  // 生成実行
  const handleGenerate = useCallback(async () => {
    if (!canGenerate()) return;

    setIsConverting(true);

    try {
      // willConvertToImage=trueのPDFを変換
      const processedFiles = await processPdfFiles(files);
      setIsConverting(false);

      // FormDataを構築
      const formData = buildFormData(
        processedFiles,
        spaceId,
        checklistRequirements.trim()
      );

      // アクションを実行（ここでisExecuting=trueになる）
      executeGenerate(formData);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "PDF変換に失敗しました";
      showError(errorMessage);
      setIsConverting(false);
    }
  }, [canGenerate, files, checklistRequirements, spaceId, executeGenerate]);

  return (
    <div className="flex-1 flex flex-col">
      {/* Page Content */}
      <main className="flex-1 p-6">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: projectName, href: `/projects/${projectId}/spaces` },
            { label: spaceName, href: `/projects/${projectId}/spaces/${spaceId}` },
            { label: "チェックリスト", href: `/projects/${projectId}/spaces/${spaceId}/checklist` },
            { label: "AI生成" },
          ]}
        />

        {/* Main Card */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-2xl font-bold text-gray-900">
                  AIでチェックリストを自動生成
                </h3>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI機能
                </span>
              </div>
              <p className="text-gray-600">
                ドキュメントをアップロードして、AIがレビュー項目を自動生成します
              </p>
            </div>

            {/* Info Alert */}
            <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-6 rounded">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-purple-500 mt-0.5" />
                <div className="ml-3">
                  <p className="text-sm text-purple-800 font-medium">
                    AI生成について
                  </p>
                  <p className="mt-1 text-sm text-purple-700">
                    AIは参考ドキュメントとレビュー要件から適切なチェック項目を提案します。生成後に項目の編集・追加・削除が可能です。
                  </p>
                </div>
              </div>
            </div>

            {/* Section 1: Document Upload */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <h4 className="text-lg font-semibold text-gray-900">
                  参考ドキュメントのアップロード
                </h4>
              </div>

              <div className="ml-11">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  参考ドキュメント <span className="text-red-500">*</span>
                </label>
                <FileUploadArea
                  files={files}
                  onFilesChange={handleFilesChange}
                  showImageConversion={true}
                  enableMultiSelect={true}
                  disabled={isProcessing}
                  maxFileSize={maxFileSize}
                />
                <p className="mt-2 text-sm text-gray-500">
                  PDFファイルは処理モードを選択できます。図表が多い場合は「画像変換」を推奨します。
                </p>
              </div>
            </div>

            {/* Section 2: Requirements */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <h4 className="text-lg font-semibold text-gray-900">
                  レビュー要件の指定
                </h4>
              </div>

              <div className="ml-11">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  チェック項目の生成条件 <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={checklistRequirements}
                  onChange={(e) => setChecklistRequirements(e.target.value)}
                  placeholder={`どのような観点でチェック項目を生成してほしいか記述してください

例:
- 設計書として必要な記載事項が網羅されているか
- セキュリティ要件が適切に考慮されているか
- パフォーマンス要件が満たされているか
- 保守性・拡張性が考慮されているか`}
                  rows={6}
                  disabled={isProcessing}
                  className="w-full"
                />
                <p className="mt-1 text-sm text-gray-500">
                  AIはこの要件に基づいてチェック項目を生成します。具体的に記述するほど精度が向上します。
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-end pt-6 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => router.push(`/projects/${projectId}/spaces/${spaceId}/checklist`)}
                disabled={isProcessing}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate() || isProcessing}
                className="bg-purple-500 hover:bg-purple-600 text-white flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    チェックリストを生成
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Help Section */}
          <div className="mt-6 bg-gray-100 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-gray-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">AI生成のヒント</p>
                <ul className="mt-2 text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li>
                    複数のドキュメントをアップロードすると、より包括的なチェック項目が生成されます
                  </li>
                  <li>
                    レビュー要件は具体的に記述するほど、適切な項目が生成されます
                  </li>
                  <li>
                    生成後にチェックリスト編集画面で項目の追加・削除・編集が可能です
                  </li>
                  <li>生成には1-3分程度かかる場合があります</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AIChecklistGenerateClient;
