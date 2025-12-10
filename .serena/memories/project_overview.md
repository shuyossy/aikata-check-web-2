# プロジェクト概要

## 目的
デスクトップアプリ「AIKATA」をWebアプリに移行するプロジェクト。AIレビュー機能に特化したレビュープラットフォーム。

## 技術スタック
- Next.js（App Router）
- React
- TypeScript
- Zod
- Drizzle（PostgreSQL）
- NextAuth（v4）
- Mastra（AIワークフロー）
- Tailwind CSS
- shadcn/ui
- Vitest（テスト）
- Pino（ロギング）

## アーキテクチャ
クリーンアーキテクチャを採用：
- Domain層: エンティティ、値オブジェクト、Specificationパターン
- Application層: サービス、DTO、ビジネスルール
- Infrastructure層: DBリポジトリ（Drizzle）、外部サービスアダプター
- Presentation層: next-safe-actions、Server Components

## 主要ディレクトリ構成
```
next-server/
  app/           # Next.js App Router
  components/    # 共通コンポーネント
  domain/        # ドメイン層
  application/   # アプリケーション層
  infrastructure/# インフラ層
  lib/           # 共通ユーティリティ
  drizzle/       # DBスキーマ・マイグレーション
```
