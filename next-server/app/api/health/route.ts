import { NextResponse } from "next/server";

/**
 * ヘルスチェックエンドポイント
 * Dockerコンテナのヘルスチェックで使用
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
