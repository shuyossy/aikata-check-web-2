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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { FileUploadArea, UploadedFile, isPdfFile } from "@/components/upload";
import {
  ReviewSettingsEditor,
  ReviewSettingsValue,
} from "@/components/reviewSpace";
import { convertPdfFileToFiles, showError, showSuccess } from "@/lib/client";
import { executeReviewAction } from "../actions";
import { extractServerErrorMessage } from "@/hooks";

/**
 * 評価基準項目
 */
interface EvaluationCriterionItem {
  label: string;
  description: string;
}

/**
 * レビュー種別
 */
type ReviewType = "small" | "large" | "api";

/**
 * デフォルトの評価基準
 */
const DEFAULT_EVALUATION_CRITERIA: EvaluationCriterionItem[] = [
  { label: "A", description: "基準を完全に満たしている" },
  { label: "B", description: "基準をある程度満たしている" },
  { label: "C", description: "基準を満たしていない" },
  { label: "-", description: "評価の対象外、または評価できない" },
];

/**
 * デフォルトのコメントフォーマット
 */
const DEFAULT_COMMENT_FORMAT = `【評価理由・根拠】
（具体的な理由と根拠を記載）

【改善提案】
（改善のための具体的な提案を記載）`;

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
  const [reviewType, setReviewType] = useState<ReviewType>("small");

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
    const validCriteria = reviewSettings.evaluationCriteria.every(
      (c) => c.label.trim() && c.description.trim()
    );
    if (
      !validCriteria ||
      reviewSettings.evaluationCriteria.length === 0
    )
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
    type: ReviewType
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
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <h4 className="text-lg font-semibold text-gray-900">
                  レビュー対象名
                </h4>
              </div>

              <div className="ml-11">
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
              </div>
            </div>

            {/* Section 2: ドキュメントアップロード */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <h4 className="text-lg font-semibold text-gray-900">
                  レビュー対象ドキュメント
                </h4>
              </div>

              <div className="ml-11">
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
              </div>
            </div>

            {/* Section 3: レビュー種別 */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <h4 className="text-lg font-semibold text-gray-900">
                  レビュー種別
                </h4>
              </div>

              <div className="ml-11">
                <RadioGroup
                  value={reviewType}
                  onValueChange={(v) => setReviewType(v as ReviewType)}
                  className="space-y-3"
                >
                  {/* 少量レビュー */}
                  <div className="flex items-start space-x-3 p-3 border rounded-lg bg-white hover:bg-gray-50">
                    <RadioGroupItem
                      value="small"
                      id="review-small"
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor="review-small"
                        className="font-medium cursor-pointer"
                      >
                        少量レビュー
                      </Label>
                      <p className="text-sm text-gray-500">
                        コンテキストウィンドウに収まるドキュメントをそのまま処理します
                      </p>
                    </div>
                  </div>

                  {/* 大量レビュー（無効） */}
                  <div className="flex items-start space-x-3 p-3 border rounded-lg bg-gray-100 opacity-60">
                    <RadioGroupItem
                      value="large"
                      id="review-large"
                      disabled
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor="review-large"
                          className="font-medium text-gray-400"
                        >
                          大量レビュー
                        </Label>
                        <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-500 rounded">
                          準備中
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">
                        大きなドキュメントを分割して処理し、結果を統合します
                      </p>
                    </div>
                  </div>

                  {/* 外部API呼び出し（無効） */}
                  <div className="flex items-start space-x-3 p-3 border rounded-lg bg-gray-100 opacity-60">
                    <RadioGroupItem
                      value="api"
                      id="review-api"
                      disabled
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor="review-api"
                          className="font-medium text-gray-400"
                        >
                          外部API呼び出し
                        </Label>
                        <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-500 rounded">
                          準備中
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">
                        外部サービスに処理を委託します
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </div>

            {/* Section 4: レビュー設定 */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                  4
                </div>
                <h4 className="text-lg font-semibold text-gray-900">
                  レビュー設定
                </h4>
                <Settings className="w-4 h-4 text-gray-400" />
              </div>

              <div className="ml-11">
                <ReviewSettingsEditor
                  value={reviewSettings}
                  onChange={setReviewSettings}
                  disabled={isProcessing}
                />
              </div>
            </div>

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
