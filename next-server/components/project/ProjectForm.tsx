"use client";

import { useState } from "react";
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
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 ${
                  errors.name ? "border-red-300" : "border-gray-300"
                }`}
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
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 ${
                  errors.description ? "border-red-300" : "border-gray-300"
                }`}
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
                <svg
                  className="h-5 w-5 text-blue-500 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
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
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 font-mono text-sm"
                  placeholder="sk-xxxxxxxxxxxxxxxxxxxx"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
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
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition duration-150 font-medium flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              メンバーを追加
            </button>

            {/* メンバー一覧 */}
            <MemberList
              members={members}
              currentUserId={currentUser.id}
              onRemove={handleRemoveMember}
            />

            {/* 追加メンバーの空状態 */}
            {members.length <= 1 && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
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
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition duration-150 font-medium text-center disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-150 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                処理中...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {submitLabel}
              </>
            )}
          </button>
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
