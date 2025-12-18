-- 大量レビュー時の個別ドキュメントレビュー結果をキャッシュするテーブル
-- Q&A機能で個別結果を参照するために使用

CREATE TABLE IF NOT EXISTS "large_document_result_caches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_document_cache_id" uuid NOT NULL,
	"review_result_id" uuid NOT NULL,
	"comment" text NOT NULL,
	"total_chunks" integer DEFAULT 1 NOT NULL,
	"chunk_index" integer DEFAULT 0 NOT NULL,
	"individual_file_name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "large_document_result_caches" ADD CONSTRAINT "large_document_result_caches_review_document_cache_id_review_document_caches_id_fk" FOREIGN KEY ("review_document_cache_id") REFERENCES "public"."review_document_caches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "large_document_result_caches" ADD CONSTRAINT "large_document_result_caches_review_result_id_review_results_id_fk" FOREIGN KEY ("review_result_id") REFERENCES "public"."review_results"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_large_doc_result_cache_doc" ON "large_document_result_caches" USING btree ("review_document_cache_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_large_doc_result_cache_result" ON "large_document_result_caches" USING btree ("review_result_id");
