"use client";

import Link from "next/link";
import { ArrowLeft, Copy, Check, ExternalLink, Code, FileJson } from "lucide-react";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ApiSpecClientProps {
  projectId: string;
  projectName: string;
  spaceId: string;
  spaceName: string;
}

/**
 * リクエストスキーマのサンプルJSON
 */
const REQUEST_SCHEMA_SAMPLE = `{
  "documents": [
    {
      "name": "設計書.pdf",
      "type": "text",
      "content": "抽出されたテキストコンテンツ..."
    },
    {
      "name": "diagram.png",
      "type": "image",
      "content": "data:image/png;base64,iVBORw0KGgo..."
    }
  ],
  "checkListItems": [
    {
      "id": "item-1",
      "content": "設計書に目次が含まれているか"
    },
    {
      "id": "item-2",
      "content": "用語が統一されているか"
    }
  ],
  "reviewSettings": {
    "additionalInstructions": "厳格にレビューしてください",
    "commentFormat": "【問題点】\\n【改善案】",
    "evaluationCriteria": [
      {
        "label": "A",
        "description": "問題なし"
      },
      {
        "label": "B",
        "description": "軽微な問題あり"
      },
      {
        "label": "C",
        "description": "重大な問題あり"
      }
    ]
  }
}`;

/**
 * レスポンススキーマのサンプルJSON
 */
const RESPONSE_SCHEMA_SAMPLE = `{
  "results": [
    {
      "checkListItemId": "item-1",
      "evaluation": "A",
      "comment": "設計書には適切な目次が含まれています。"
    },
    {
      "checkListItemId": "item-2",
      "evaluation": "B",
      "comment": "【問題点】\\n一部の用語に揺れがあります。\\n【改善案】\\n用語集を作成し、統一してください。"
    },
    {
      "checkListItemId": "item-3",
      "evaluation": "",
      "comment": "",
      "error": "チェック項目の処理中にエラーが発生しました"
    }
  ]
}`;

/**
 * コードブロックコンポーネント
 */
function CodeBlock({
  code,
  language,
}: {
  code: string;
  language: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="relative group">
      <div className="absolute right-2 top-2 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-8 px-2 bg-gray-700 hover:bg-gray-600 text-gray-300"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-400" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  );
}

/**
 * スキーマフィールド説明コンポーネント
 */
function SchemaField({
  name,
  type,
  required,
  description,
  children,
}: {
  name: string;
  type: string;
  required?: boolean;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-l-2 border-gray-200 pl-4 py-2">
      <div className="flex items-center gap-2 mb-1">
        <code className="text-sm font-semibold text-blue-600">{name}</code>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
          {type}
        </span>
        {required && (
          <span className="text-xs text-red-500 font-medium">必須</span>
        )}
      </div>
      <p className="text-sm text-gray-600">{description}</p>
      {children && <div className="mt-2 ml-4">{children}</div>}
    </div>
  );
}

/**
 * API仕様説明クライアントコンポーネント
 */
export function ApiSpecClient({
  projectId,
  projectName,
  spaceId,
  spaceName,
}: ApiSpecClientProps) {
  return (
    <div className="bg-gray-50 min-h-screen">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* パンくずリスト */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/projects" className="hover:text-gray-700">
            プロジェクト
          </Link>
          <span>/</span>
          <Link
            href={`/projects/${projectId}/spaces`}
            className="hover:text-gray-700"
          >
            {projectName}
          </Link>
          <span>/</span>
          <Link
            href={`/projects/${projectId}/spaces/${spaceId}`}
            className="hover:text-gray-700"
          >
            {spaceName}
          </Link>
          <span>/</span>
          <span className="text-gray-900">API仕様</span>
        </nav>

        {/* 戻るリンク */}
        <Link
          href={`/projects/${projectId}/spaces/${spaceId}/review/new`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>レビュー実行に戻る</span>
        </Link>

        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            外部APIレビュー仕様
          </h1>
          <p className="mt-2 text-gray-600">
            AIKATAの外部APIレビュー機能で使用するAPIの仕様を説明します。
            この仕様に準拠したAPIエンドポイントを用意することで、独自のレビューロジックを実装できます。
          </p>
        </div>

        {/* 概要カード */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              API概要
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">HTTPメソッド</h4>
                <code className="text-blue-600">POST</code>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Content-Type</h4>
                <code className="text-blue-600">application/json</code>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* リクエスト/レスポンスタブ */}
        <Tabs defaultValue="request" className="mb-8">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="request" className="flex items-center gap-2">
              <FileJson className="h-4 w-4" />
              リクエスト
            </TabsTrigger>
            <TabsTrigger value="response" className="flex items-center gap-2">
              <FileJson className="h-4 w-4" />
              レスポンス
            </TabsTrigger>
          </TabsList>

          <TabsContent value="request">
            <Card>
              <CardHeader>
                <CardTitle>リクエストスキーマ</CardTitle>
                <CardDescription>
                  APIに送信するリクエストボディの構造
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* スキーマ説明 */}
                <div className="space-y-4">
                  <SchemaField
                    name="documents"
                    type="Document[]"
                    required
                    description="レビュー対象のドキュメント配列"
                  >
                    <SchemaField
                      name="name"
                      type="string"
                      required
                      description="ドキュメント名（ファイル名）"
                    />
                    <SchemaField
                      name="type"
                      type='"text" | "image"'
                      required
                      description="ドキュメント種別（テキストまたは画像）"
                    />
                    <SchemaField
                      name="content"
                      type="string"
                      required
                      description="コンテンツ本体。テキストの場合は抽出されたテキスト、画像の場合はBase64エンコードされたデータ"
                    />
                  </SchemaField>

                  <SchemaField
                    name="checkListItems"
                    type="CheckListItem[]"
                    required
                    description="レビュー観点となるチェックリスト項目の配列"
                  >
                    <SchemaField
                      name="id"
                      type="string"
                      required
                      description="チェック項目の一意識別子（レスポンスで使用）"
                    />
                    <SchemaField
                      name="content"
                      type="string"
                      required
                      description="チェック項目の内容"
                    />
                  </SchemaField>

                  <SchemaField
                    name="reviewSettings"
                    type="ReviewSettings"
                    description="レビュー設定（オプション）"
                  >
                    <SchemaField
                      name="additionalInstructions"
                      type="string | null"
                      description="追加指示（AIへの追加プロンプトとして使用）"
                    />
                    <SchemaField
                      name="commentFormat"
                      type="string | null"
                      description="レビューコメントのフォーマット指定"
                    />
                    <SchemaField
                      name="evaluationCriteria"
                      type="EvaluationCriterion[]"
                      description="評価基準の配列"
                    >
                      <SchemaField
                        name="label"
                        type="string"
                        required
                        description="評価ラベル（例: A, B, C）"
                      />
                      <SchemaField
                        name="description"
                        type="string"
                        required
                        description="評価の説明"
                      />
                    </SchemaField>
                  </SchemaField>
                </div>

                {/* サンプルJSON */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">
                    リクエスト例
                  </h4>
                  <CodeBlock code={REQUEST_SCHEMA_SAMPLE} language="json" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="response">
            <Card>
              <CardHeader>
                <CardTitle>レスポンススキーマ</CardTitle>
                <CardDescription>
                  APIから返却されるレスポンスボディの構造
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* スキーマ説明 */}
                <div className="space-y-4">
                  <SchemaField
                    name="results"
                    type="ReviewResultItem[]"
                    required
                    description="レビュー結果の配列（リクエストのcheckListItemsと同数）"
                  >
                    <SchemaField
                      name="checkListItemId"
                      type="string"
                      required
                      description="チェック項目ID（リクエストで送信したIDと対応）"
                    />
                    <SchemaField
                      name="evaluation"
                      type="string"
                      required
                      description="評価結果（evaluationCriteriaのlabelのいずれか）"
                    />
                    <SchemaField
                      name="comment"
                      type="string"
                      required
                      description="レビューコメント"
                    />
                    <SchemaField
                      name="error"
                      type="string"
                      description="エラーメッセージ（オプション）。チェック項目の処理中にエラーが発生した場合に設定します。errorが設定されている場合、evaluationとcommentは空文字列でも構いません。"
                    />
                  </SchemaField>
                </div>

                {/* サンプルJSON */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">
                    レスポンス例
                  </h4>
                  <CodeBlock code={RESPONSE_SCHEMA_SAMPLE} language="json" />
                </div>

                {/* 注意事項 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 mb-2">重要な注意点</h4>
                  <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                    <li>
                      resultsの各要素のcheckListItemIdは、リクエストで送信したcheckListItemsのidと一致させてください
                    </li>
                    <li>
                      evaluationには、evaluationCriteriaで指定したlabelのいずれかを返却してください
                    </li>
                    <li>
                      commentはcommentFormatが指定されている場合、そのフォーマットに従って記述することを推奨します
                    </li>
                    <li>
                      チェック項目の処理中にエラーが発生した場合は、errorフィールドにエラーメッセージを設定してください。
                      errorが設定されている項目はレビュー結果画面でエラーとして表示されます
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
