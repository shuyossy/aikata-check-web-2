"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Eye, EyeOff, Check, Info, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MemberSearchModal } from "./MemberSearchModal";
import { MemberList } from "./MemberList";
import { UserDto } from "@/domain/user";

// バリデーションスキーマ
const projectFormSchema = z.object({
  name: z
    .string()
    .min(1, "プロジェクト名は必須です")
    .max(100, "プロジェクト名は100文字以内で入力してください"),
  description: z
    .string()
    .max(1000, "説明は1000文字以内で入力してください")
    .optional(),
  apiKey: z.string().optional(),
});

export type ProjectFormSchemaData = z.infer<typeof projectFormSchema>;

export interface ProjectFormData {
  name: string;
  description: string;
  apiKey: string | null; // nullは「変更なし」を意味する
  members: UserDto[];
}

export interface ProjectFormProps {
  /** 初期値（編集時） */
  initialData?: Partial<ProjectFormData> & { hasApiKey?: boolean };
  /** 現在のユーザー */
  currentUser: UserDto;
  /** 送信ハンドラ */
  onSubmit: (data: ProjectFormData) => void;
  /** キャンセルハンドラ */
  onCancel: () => void;
  /** 送信中かどうか */
  isSubmitting?: boolean;
  /** 送信ボタンのラベル */
  submitLabel?: string;
}

/**
 * プロジェクト作成・編集フォームコンポーネント
 */
export function ProjectForm({
  initialData,
  currentUser,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = "プロジェクトを作成",
}: ProjectFormProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  // APIキーが変更されたかを追跡
  const [isApiKeyChanged, setIsApiKeyChanged] = useState(false);
  // APIキー設定有無の判定
  const hasApiKey = initialData?.hasApiKey ?? false;
  // membersは配列なのでuseStateで別管理
  const [members, setMembers] = useState<UserDto[]>(
    initialData?.members ?? [currentUser],
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectFormSchemaData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: initialData?.name ?? "",
      description: initialData?.description ?? "",
      apiKey: initialData?.apiKey ?? "",
    },
  });

  // フォーム送信
  const onFormSubmit = (data: ProjectFormSchemaData) => {
    // メンバーバリデーション
    if (members.length === 0) {
      setMembersError("メンバーは少なくとも1名必要です");
      return;
    }
    setMembersError(null);

    // APIキーは変更された場合のみ送信、空文字の場合はnull
    const trimmedApiKey = data.apiKey?.trim();
    const apiKeyToSubmit =
      isApiKeyChanged && trimmedApiKey ? trimmedApiKey : null;

    onSubmit({
      name: data.name.trim(),
      description: data.description?.trim() ?? "",
      apiKey: apiKeyToSubmit,
      members,
    });
  };

  // メンバー削除
  const handleRemoveMember = (userId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== userId));
  };

  // メンバー検索モーダルで確定
  const handleMemberConfirm = (selectedUsers: UserDto[]) => {
    // 自分は常に含める
    const hasSelf = selectedUsers.some((u) => u.id === currentUser.id);
    if (hasSelf) {
      setMembers(selectedUsers);
    } else {
      setMembers([currentUser, ...selectedUsers]);
    }
    setMembersError(null);
  };

  return (
    <>
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        {/* 基本情報セクション */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold mr-3">
              1
            </span>
            基本情報
          </h3>

          <div className="space-y-4 ml-11">
            {/* プロジェクト名 */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                プロジェクト名 <span className="text-red-500">*</span>
              </label>
              <Input
                id="name"
                type="text"
                {...register("name")}
                className={`h-11 ${errors.name ? "border-red-300 focus-visible:ring-red-500" : ""}`}
                placeholder="例: ○○システム開発プロジェクト"
                disabled={isSubmitting}
              />
              {errors.name ? (
                <p className="mt-1 text-sm text-red-500">
                  {errors.name.message}
                </p>
              ) : (
                <p className="mt-1 text-sm text-gray-500">
                  プロジェクトを識別するための名称を入力してください
                </p>
              )}
            </div>

            {/* 説明 */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                説明 <span className="text-gray-400 text-xs">(任意)</span>
              </label>
              <Textarea
                id="description"
                {...register("description")}
                className={`min-h-[100px] ${errors.description ? "border-red-300 focus-visible:ring-red-500" : ""}`}
                rows={4}
                placeholder="プロジェクトの目的や概要を入力してください"
                disabled={isSubmitting}
              />
              {errors.description ? (
                <p className="mt-1 text-sm text-red-500">
                  {errors.description.message}
                </p>
              ) : (
                <p className="mt-1 text-sm text-gray-500">
                  プロジェクトの詳細な説明を入力できます
                </p>
              )}
            </div>
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* API設定セクション */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold mr-3">
              2
            </span>
            API設定
          </h3>

          <div className="space-y-4 ml-11">
            {/* APIキー説明 */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <div className="flex items-start">
                <Info className="size-5 text-blue-500 mt-0.5" />
                <div className="ml-3">
                  <p className="text-sm text-blue-800 font-medium">
                    APIキーについて
                  </p>
                  <p className="mt-1 text-sm text-blue-700">
                    プロジェクトごとにAI
                    APIキーを設定する必要があります。APIキーは安全に暗号化されて保管されます。
                  </p>
                </div>
              </div>
            </div>

            {/* APIキー入力 */}
            <div>
              <label
                htmlFor="apiKey"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                APIキー{" "}
                {hasApiKey && !isApiKeyChanged ? (
                  <span className="text-xs text-green-600">（設定済み）</span>
                ) : (
                  <span className="text-gray-400 text-xs">
                    (任意・後で設定可能)
                  </span>
                )}
              </label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showApiKey ? "text" : "password"}
                  {...register("apiKey", {
                    onChange: (e) =>
                      setIsApiKeyChanged(e.target.value.length > 0),
                  })}
                  className="h-11 pr-10 font-mono text-sm"
                  placeholder={
                    hasApiKey
                      ? "新しいAPIキーを入力すると上書きされます"
                      : "sk-xxxxxxxxxxxxxxxxxxxx"
                  }
                  disabled={isSubmitting}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? (
                    <EyeOff className="size-5" />
                  ) : (
                    <Eye className="size-5" />
                  )}
                </Button>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                APIキーは安全に保管されます
              </p>
            </div>
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* メンバーセクション */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold mr-3">
              3
            </span>
            メンバー
          </h3>

          <div className="space-y-4 ml-11">
            <p className="text-sm text-gray-600">
              プロジェクトに参加するメンバーを追加してください。デフォルトで自身が選択されています。
            </p>

            {membersError && (
              <p className="text-sm text-red-500">{membersError}</p>
            )}

            {/* メンバー追加ボタン */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(true)}
              className="h-10"
              disabled={isSubmitting}
            >
              <Plus className="size-5" />
              メンバーを追加
            </Button>

            {/* メンバー一覧 */}
            <MemberList
              members={members}
              currentUserId={currentUser.id}
              onRemove={handleRemoveMember}
            />

            {/* 追加メンバーの空状態 */}
            {members.length <= 1 && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Users className="mx-auto size-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">
                  「メンバーを追加」ボタンから追加できます
                </p>
              </div>
            )}
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* アクションボタン */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="h-10"
          >
            キャンセル
          </Button>
          <Button type="submit" disabled={isSubmitting} className="h-10">
            {isSubmitting ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                処理中...
              </>
            ) : (
              <>
                <Check className="size-5" />
                {submitLabel}
              </>
            )}
          </Button>
        </div>
      </form>

      {/* メンバー検索モーダル */}
      <MemberSearchModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleMemberConfirm}
        initialSelected={members}
        excludeUserIds={[]}
      />
    </>
  );
}
