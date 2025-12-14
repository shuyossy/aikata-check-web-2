"use client";

import { useState, useCallback } from "react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import {
  PlayCircle,
  Info,
  HelpCircle,
  Loader2,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSection } from "@/components/ui/form-section";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { FileUploadArea, UploadedFile, isPdfFile } from "@/components/upload";
import {
  ReviewSettingsEditor,
  ReviewSettingsValue,
  EvaluationCriterionItem,
  ReviewTypeSelector,
  ReviewTypeValue,
} from "@/components/reviewSpace";
import {
  DEFAULT_EVALUATION_CRITERIA,
  DEFAULT_COMMENT_FORMAT,
} from "@/domain/reviewSpace";
import {
  convertPdfFileToFiles,
  showError,
  showSuccess,
  validateEvaluationCriteria,
} from "@/lib/client";
import { executeReviewAction } from "../actions";
import { extractServerErrorMessage } from "@/hooks";

interface ReviewExecutionClientProps {
  projectId: string;
  projectName: string;
  spaceId: string;
  spaceName: string;
  /** レビュースペースのデフォルトレビュー設定 */
  defaultReviewSettings?: {
    additionalInstructions: string | null;
    concurrentReviewItems: number;
    commentFormat: string;
    evaluationCriteria: EvaluationCriterionItem[];
  } | null;
  /** チェックリスト件数 */
  checklistCount: number;
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
 * レビュー実行クライアントコンポーネント
 */
export function ReviewExecutionClient({
  projectId,
  projectName,
  spaceId,
  spaceName,
  defaultReviewSettings,
  checklistCount,
  maxFileSize,
}: ReviewExecutionClientProps) {
  const router = useRouter();

  // レビュー対象名
  const [name, setName] = useState("");

  // ファイル状態
  const [files, setFiles] = useState<UploadedFile[]>([]);

  // レビュー種別
  const [reviewType, setReviewType] = useState<ReviewTypeValue>("small");

  // レビュー設定
  const [reviewSettings, setReviewSettings] = useState<ReviewSettingsValue>({
    additionalInstructions:
      defaultReviewSettings?.additionalInstructions ?? "",
    concurrentReviewItems:
      defaultReviewSettings?.concurrentReviewItems ?? 1,
    commentFormat:
      defaultReviewSettings?.commentFormat ?? DEFAULT_COMMENT_FORMAT,
    evaluationCriteria:
      defaultReviewSettings?.evaluationCriteria ?? DEFAULT_EVALUATION_CRITERIA,
  });

  // PDF変換中フラグ
  const [isConverting, setIsConverting] = useState(false);

  // レビュー実行アクション
  const { execute: executeReview, isExecuting } = useAction(
    executeReviewAction,
    {
      onSuccess: (result) => {
        showSuccess("レビューを開始しました");
        // レビュー結果画面に遷移
        router.push(
          `/projects/${projectId}/spaces/${spaceId}/review/${result.data?.reviewTargetId}`
        );
      },
      onError: ({ error: actionError }) => {
        const message = extractServerErrorMessage(
          actionError,
          "レビュー実行に失敗しました"
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
    const updatedFiles = newFiles.map((file) => {
      if (file.status === "pending") {
        if (isPdfFile(file.file)) {
          return { ...file, status: "complete" as const };
        } else {
          return {
            ...file,
            status: "complete" as const,
            processMode: "text" as const,
          };
        }
      }
      return file;
    });

    const hasChanges = updatedFiles.some(
      (f, i) =>
        f.status !== newFiles[i].status ||
        f.processMode !== newFiles[i].processMode
    );
    if (hasChanges) {
      setFiles(updatedFiles);
    }
  }, []);

  // 実行ボタンの有効/無効判定
  const canExecute = useCallback(() => {
    // レビュー対象名が入力されているか
    if (!name.trim()) return false;

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

    // チェックリストがあるか
    if (checklistCount === 0) return false;

    // 評価基準が有効か
    if (!validateEvaluationCriteria(reviewSettings.evaluationCriteria))
      return false;

    return true;
  }, [name, files, checklistCount, reviewSettings.evaluationCriteria]);

  /**
   * PDF画像変換を実行し、ファイルリストを更新
   */
  const processPdfFiles = async (
    currentFiles: UploadedFile[]
  ): Promise<UploadedFile[]> => {
    const result: UploadedFile[] = [];

    for (const file of currentFiles) {
      if (isPdfFile(file.file) && file.willConvertToImage === true) {
        const convertedImages = await convertPdfFileToFiles(file.file);

        result.push({
          ...file,
          status: "complete",
          processMode: "image",
          convertedImages,
          willConvertToImage: false,
        });
      } else if (isPdfFile(file.file) && file.willConvertToImage === false) {
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
    reviewName: string,
    settings: ReviewSettingsValue,
    type: ReviewTypeValue
  ): FormData => {
    const formData = new FormData();

    // 基本パラメータを追加
    formData.append("reviewSpaceId", reviewSpaceId);
    formData.append("name", reviewName);
    formData.append("reviewType", type);

    // レビュー設定を追加
    formData.append(
      "reviewSettings",
      JSON.stringify({
        additionalInstructions: settings.additionalInstructions || null,
        concurrentReviewItems: settings.concurrentReviewItems,
        commentFormat: settings.commentFormat || null,
        evaluationCriteria: settings.evaluationCriteria,
      })
    );

    // メタデータ配列を構築
    const metadata: FileMetadata[] = [];

    processedFiles.forEach((file, index) => {
      const fileMeta: FileMetadata = {
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        processMode: file.processMode || "text",
      };

      if (file.processMode === "image" && file.convertedImages) {
        fileMeta.convertedImageCount = file.convertedImages.length;
      }

      metadata.push(fileMeta);

      formData.append(`file_${index}`, file.file);

      if (file.convertedImages && file.convertedImages.length > 0) {
        file.convertedImages.forEach((img, imgIndex) => {
          formData.append(`file_${index}_image_${imgIndex}`, img);
        });
      }
    });

    formData.append("metadata", JSON.stringify(metadata));

    return formData;
  };

  // 実行
  const handleExecute = useCallback(async () => {
    if (!canExecute()) return;

    setIsConverting(true);

    try {
      const processedFiles = await processPdfFiles(files);
      setIsConverting(false);

      const formData = buildFormData(
        processedFiles,
        spaceId,
        name.trim(),
        reviewSettings,
        reviewType
      );

      executeReview(formData);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "PDF変換に失敗しました";
      showError(errorMessage);
      setIsConverting(false);
    }
  }, [canExecute, files, spaceId, name, reviewSettings, reviewType, executeReview]);

  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 p-6">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: projectName, href: `/projects/${projectId}/spaces` },
            {
              label: spaceName,
              href: `/projects/${projectId}/spaces/${spaceId}`,
            },
            { label: "新規レビュー" },
          ]}
        />

        {/* Main Card */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-2xl font-bold text-gray-900">
                  レビューを実行
                </h3>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <PlayCircle className="w-3 h-3 mr-1" />
                  AI Review
                </span>
              </div>
              <p className="text-gray-600">
                ドキュメントをアップロードして、チェックリストに基づいてAIがレビューを実行します
              </p>
            </div>

            {/* チェックリスト未登録の警告 */}
            {checklistCount === 0 && (
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 rounded">
                <div className="flex items-start">
                  <Info className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div className="ml-3">
                    <p className="text-sm text-amber-800 font-medium">
                      チェックリストが登録されていません
                    </p>
                    <p className="mt-1 text-sm text-amber-700">
                      レビューを実行するには、先にチェックリストを登録してください。
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() =>
                        router.push(
                          `/projects/${projectId}/spaces/${spaceId}/checklist`
                        )
                      }
                    >
                      チェックリスト管理へ
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Section 1: レビュー対象名 */}
            <FormSection sectionNumber={1} title="レビュー対象名">
              <Label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                レビュー対象名 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 要件定義書 v1.0"
                disabled={isProcessing}
                className="w-full"
              />
              <p className="mt-1 text-sm text-gray-500">
                レビュー対象を識別するための名前を入力してください
              </p>
            </FormSection>

            {/* Section 2: ドキュメントアップロード */}
            <FormSection sectionNumber={2} title="レビュー対象ドキュメント">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                ドキュメント <span className="text-red-500">*</span>
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
            </FormSection>

            {/* Section 3: レビュー種別 */}
            <FormSection sectionNumber={3} title="レビュー種別">
              <ReviewTypeSelector
                value={reviewType}
                onChange={setReviewType}
                disabled={isProcessing}
                showApiOption={true}
              />
            </FormSection>

            {/* Section 4: レビュー設定 */}
            <FormSection
              sectionNumber={4}
              title="レビュー設定"
              titleIcon={<Settings className="w-4 h-4 text-gray-400" />}
            >
              <ReviewSettingsEditor
                value={reviewSettings}
                onChange={setReviewSettings}
                disabled={isProcessing}
              />
            </FormSection>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-end pt-6 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() =>
                  router.push(`/projects/${projectId}/spaces/${spaceId}`)
                }
                disabled={isProcessing}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleExecute}
                disabled={!canExecute() || isProcessing}
                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    レビュー実行中...
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-5 h-5" />
                    レビューを実行
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
                <p className="text-sm font-medium text-gray-900">
                  レビュー実行のヒント
                </p>
                <ul className="mt-2 text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li>
                    チェックリストに登録されている{checklistCount}
                    件の項目に対してレビューを実行します
                  </li>
                  <li>
                    PDFの図表が多い場合は「画像変換」モードがより正確なレビューができます
                  </li>
                  <li>レビュー結果は保存され、後からいつでも確認できます</li>
                  <li>レビューには数分程度かかる場合があります</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ReviewExecutionClient;
