-- チェックリスト生成エラーメッセージカラムを追加
ALTER TABLE "review_spaces" ADD COLUMN "checklist_generation_error" text;
