"use client";

import Link from "next/link";
import { ClipboardList, Info, HelpCircle, Plus, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

interface ReviewTargetListClientProps {
  projectId: string;
  projectName: string;
  spaceId: string;
  spaceName: string;
  spaceDescription: string | null;
  checkListItemCount: number;
}

/**
 * レビュー対象一覧クライアントコンポーネント
 */
export function ReviewTargetListClient({
  projectId,
  projectName,
  spaceId,
  spaceName,
  spaceDescription,
  checkListItemCount,
}: ReviewTargetListClientProps) {
  return (
    <div className="flex-1 flex flex-col">
      {/* Page Content */}
      <main className="flex-1 p-6">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: projectName, href: `/projects/${projectId}/spaces` },
            { label: spaceName },
          ]}
        />

        {/* Space Information & Settings */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                スペース情報
              </h3>
              <Link
                href={`/projects/${projectId}/spaces/${spaceId}/edit`}
                className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
              >
                <Edit2 className="w-4 h-4" />
                編集
              </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Space Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  スペース名
                </label>
                <p className="text-sm text-gray-900">{spaceName}</p>
              </div>

              {/* Checklist Count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  チェックリスト
                </label>
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-gray-600" />
                  <p className="text-sm text-gray-900">
                    {checkListItemCount}項目
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  説明
                </label>
                <p className="text-sm text-gray-600">
                  {spaceDescription || "説明はありません"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Page Header with Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">
              レビュー対象一覧
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              このレビュースペースで管理するレビュー対象を確認・追加できます
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" asChild>
              <Link
                href={`/projects/${projectId}/spaces/${spaceId}/checklist`}
                className="flex items-center gap-2"
              >
                <ClipboardList className="w-5 h-5" />
                チェックリストを表示/編集
              </Link>
            </Button>
            <Button disabled className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              新規レビューを実行
            </Button>
          </div>
        </div>

        {/* Info Alert */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
          <div className="flex items-start">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="ml-3">
              <p className="text-sm text-blue-800 font-medium">
                レビュー対象について
              </p>
              <p className="mt-1 text-sm text-blue-700">
                各レビュー対象は、同一のチェックリストを使用してレビューされます。レビュー対象ごとに個別にレビューを実行し、結果を確認できます。
              </p>
            </div>
          </div>
        </div>

        {/* Review Targets Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16"
                  >
                    No.
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    レビュー対象名
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32"
                  >
                    ステータス
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40"
                  >
                    最終更新
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-56"
                  >
                    アクション
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <p>レビュー対象がありません</p>
                      <p className="text-sm">
                        レビュー実行機能は今後追加予定です
                      </p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-6 bg-gray-100 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-gray-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                レビュー対象管理のヒント
              </p>
              <ul className="mt-2 text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>すべてのレビュー対象は同一のチェックリストを使用します</li>
                <li>レビュー中の対象は途中経過を確認できます</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
