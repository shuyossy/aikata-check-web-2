-- Migration: review_result_snapshot
-- Description: checkListItemIdを削除し、checkListItemContentを追加してスナップショット保存方式に変更

-- 1. 古いユニークインデックスを削除
DROP INDEX IF EXISTS "idx_review_results_target_item";

-- 2. 外部キー制約を削除
ALTER TABLE "review_results" DROP CONSTRAINT IF EXISTS "review_results_check_list_item_id_check_list_items_id_fk";

-- 3. checkListItemIdカラムを削除
ALTER TABLE "review_results" DROP COLUMN IF EXISTS "check_list_item_id";

-- 4. checkListItemContentカラムを追加
ALTER TABLE "review_results" ADD COLUMN "check_list_item_content" text NOT NULL DEFAULT '';

-- 5. デフォルト値を削除（既存データは移行不要なので空文字列がセットされるが問題なし）
ALTER TABLE "review_results" ALTER COLUMN "check_list_item_content" DROP DEFAULT;

-- 6. 新しいユニークインデックスを作成
CREATE UNIQUE INDEX "idx_review_results_target_content" ON "review_results" USING btree ("review_target_id","check_list_item_content");
