"use client";

import { useState } from "react";
import { Plus, Eye, EyeOff, Check, Info, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MemberSearchModal } from "./MemberSearchModal";
import { MemberList } from "./MemberList";
import { UserDto } from "@/domain/user";

export interface ProjectFormData {
  name: string;
  description: string;
  apiKey: string;
  members: UserDto[];
}

export interface ProjectFormProps {
  /** 初期値（編集時） */
  initialData?: Partial<ProjectFormData>;
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
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(
    initialData?.description ?? "",
  );
  const [apiKey, setApiKey] = useState(initialData?.apiKey ?? "");
  const [showApiKey, setShowApiKey] = useState(false);
  const [members, setMembers] = useState<UserDto[]>(
    initialData?.members ?? [currentUser],
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // バリデーション
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "プロジェクト名は必須です";
    } else if (name.length > 100) {
      newErrors.name = "プロジェクト名は100文字以内で入力してください";
    }

    if (description.length > 1000) {
      newErrors.description = "説明は1000文字以内で入力してください";
    }

    if (members.length === 0) {
      newErrors.members = "メンバーは少なくとも1名必要です";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // フォーム送信
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({
        name: name.trim(),
        description: description.trim(),
        apiKey: apiKey.trim(),
        members,
      });
    }
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
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                プロジェクト名 <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`h-11 ${errors.name ? "border-red-300 focus-visible:ring-red-500" : ""}`}
                placeholder="例: ○○システム開発プロジェクト"
              />
              {errors.name ? (
                <p className="mt-1 text-sm text-red-500">{errors.name}</p>
              ) : (
                <p className="mt-1 text-sm text-gray-500">
                  プロジェクトを識別するための名称を入力してください
                </p>
              )}
            </div>

            {/* 説明 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                説明 <span className="text-gray-400 text-xs">(任意)</span>
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`min-h-[100px] ${errors.description ? "border-red-300 focus-visible:ring-red-500" : ""}`}
                rows={4}
                placeholder="プロジェクトの目的や概要を入力してください"
              />
              {errors.description ? (
                <p className="mt-1 text-sm text-red-500">
                  {errors.description}
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                APIキー{" "}
                <span className="text-gray-400 text-xs">
                  (任意・後で設定可能)
                </span>
              </label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="h-11 pr-10 font-mono text-sm"
                  placeholder="sk-xxxxxxxxxxxxxxxxxxxx"
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

            {errors.members && (
              <p className="text-sm text-red-500">{errors.members}</p>
            )}

            {/* メンバー追加ボタン */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(true)}
              className="h-10"
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
