-- Q&A履歴テーブルの作成
CREATE TABLE IF NOT EXISTS "qa_histories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_target_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"question" text NOT NULL,
	"check_list_item_content" text NOT NULL,
	"answer" text,
	"research_summary" jsonb,
	"status" varchar(20) DEFAULT 'processing' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 外部キー制約の追加
DO $$ BEGIN
 ALTER TABLE "qa_histories" ADD CONSTRAINT "qa_histories_review_target_id_review_targets_id_fk" FOREIGN KEY ("review_target_id") REFERENCES "public"."review_targets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "qa_histories" ADD CONSTRAINT "qa_histories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- インデックスの作成
CREATE INDEX IF NOT EXISTS "idx_qa_histories_review_target_id" ON "qa_histories" USING btree ("review_target_id");
CREATE INDEX IF NOT EXISTS "idx_qa_histories_user_id" ON "qa_histories" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_qa_histories_created_at" ON "qa_histories" USING btree ("created_at");
