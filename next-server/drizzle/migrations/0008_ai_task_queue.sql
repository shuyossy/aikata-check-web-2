-- ai_tasks: AI処理タスクのキューテーブル
CREATE TABLE IF NOT EXISTS "ai_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_type" varchar(50) NOT NULL,
	"status" varchar(20) NOT NULL,
	"api_key_hash" text NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"payload" jsonb NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
-- ai_task_file_metadata: AIタスクに関連するファイルメタデータテーブル
CREATE TABLE IF NOT EXISTS "ai_task_file_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" text,
	"file_size" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- インデックス作成
CREATE INDEX IF NOT EXISTS "idx_ai_tasks_queue" ON "ai_tasks" ("status","api_key_hash","priority");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ai_tasks_status" ON "ai_tasks" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ai_task_file_metadata_task_id" ON "ai_task_file_metadata" ("task_id");
--> statement-breakpoint
-- 外部キー制約
DO $$ BEGIN
 ALTER TABLE "ai_task_file_metadata" ADD CONSTRAINT "ai_task_file_metadata_task_id_ai_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."ai_tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
