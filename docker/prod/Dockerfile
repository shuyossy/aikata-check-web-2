# ============================================
# Stage 1: Dependencies (本番用依存関係のインストール)
# ============================================
FROM node:20-alpine AS deps

WORKDIR /app

# package.jsonとpackage-lock.jsonのみをコピー
COPY next-server/package.json next-server/package-lock.json ./

# 本番用依存関係のみインストール
RUN npm ci --omit=dev

# ============================================
# Stage 2: Dependencies for Build (ビルド用依存関係)
# ============================================
FROM node:20-alpine AS deps-dev

WORKDIR /app

COPY next-server/package.json next-server/package-lock.json ./

# devDependencies含む全依存関係をインストール
RUN npm ci

# ============================================
# Stage 3: Builder (アプリケーションのビルド)
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# devDependencies含む依存関係をコピー
COPY --from=deps-dev /app/node_modules ./node_modules

# ソースコードをコピー
COPY next-server/ ./

# テレメトリ無効化
ENV NEXT_TELEMETRY_DISABLED=1

# アプリケーションをビルド
RUN npm run build

# ============================================
# Stage 4: Runner (本番実行環境)
# ============================================
FROM node:20-alpine AS runner

WORKDIR /app

# セキュリティ: 非rootユーザーで実行
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 環境変数の設定
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# ランタイムに必要なディレクトリを作成
RUN mkdir -p /app/app_cache/review_cache /app/queue_files && \
    chown -R nextjs:nodejs /app

# 本番用依存関係をコピー
COPY --from=deps /app/node_modules ./node_modules

# ビルド成果物をコピー
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json

# Drizzleマイグレーション用ファイルをコピー
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# 所有者を変更
RUN chown -R nextjs:nodejs /app

# 非rootユーザーに切り替え
USER nextjs

# ポートを公開
EXPOSE 3000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# アプリケーションを起動
CMD ["npm", "run", "start"]
