CREATE TABLE "ai_task_file_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" text,
	"file_size" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"process_mode" varchar(10) DEFAULT 'text' NOT NULL,
	"converted_image_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_tasks" (
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
CREATE TABLE "check_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_space_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "large_document_result_caches" (
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
CREATE TABLE "project_members" (
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_members_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"encrypted_api_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_histories" (
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
--> statement-breakpoint
CREATE TABLE "review_document_caches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_target_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"process_mode" varchar(10) NOT NULL,
	"cache_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_target_id" uuid NOT NULL,
	"check_list_item_content" text NOT NULL,
	"evaluation" varchar(20),
	"comment" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"default_review_settings" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checklist_generation_error" text
);
--> statement-breakpoint
CREATE TABLE "review_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_space_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"review_settings" jsonb,
	"review_type" varchar(10),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"encrypted_api_key" text,
	"api_url" text,
	"api_model" varchar(255),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_employee_id_unique" UNIQUE("employee_id")
);
--> statement-breakpoint
ALTER TABLE "ai_task_file_metadata" ADD CONSTRAINT "ai_task_file_metadata_task_id_ai_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."ai_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_list_items" ADD CONSTRAINT "check_list_items_review_space_id_review_spaces_id_fk" FOREIGN KEY ("review_space_id") REFERENCES "public"."review_spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "large_document_result_caches" ADD CONSTRAINT "large_document_result_caches_review_document_cache_id_review_document_caches_id_fk" FOREIGN KEY ("review_document_cache_id") REFERENCES "public"."review_document_caches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "large_document_result_caches" ADD CONSTRAINT "large_document_result_caches_review_result_id_review_results_id_fk" FOREIGN KEY ("review_result_id") REFERENCES "public"."review_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_histories" ADD CONSTRAINT "qa_histories_review_target_id_review_targets_id_fk" FOREIGN KEY ("review_target_id") REFERENCES "public"."review_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_histories" ADD CONSTRAINT "qa_histories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_document_caches" ADD CONSTRAINT "review_document_caches_review_target_id_review_targets_id_fk" FOREIGN KEY ("review_target_id") REFERENCES "public"."review_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_results" ADD CONSTRAINT "review_results_review_target_id_review_targets_id_fk" FOREIGN KEY ("review_target_id") REFERENCES "public"."review_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_spaces" ADD CONSTRAINT "review_spaces_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_targets" ADD CONSTRAINT "review_targets_review_space_id_review_spaces_id_fk" FOREIGN KEY ("review_space_id") REFERENCES "public"."review_spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ai_task_file_metadata_task_id" ON "ai_task_file_metadata" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_ai_tasks_queue" ON "ai_tasks" USING btree ("status","api_key_hash","priority");--> statement-breakpoint
CREATE INDEX "idx_ai_tasks_status" ON "ai_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_check_list_items_review_space_id" ON "check_list_items" USING btree ("review_space_id");--> statement-breakpoint
CREATE INDEX "idx_large_doc_result_cache_doc" ON "large_document_result_caches" USING btree ("review_document_cache_id");--> statement-breakpoint
CREATE INDEX "idx_large_doc_result_cache_result" ON "large_document_result_caches" USING btree ("review_result_id");--> statement-breakpoint
CREATE INDEX "idx_project_members_user_id" ON "project_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_qa_histories_review_target_id" ON "qa_histories" USING btree ("review_target_id");--> statement-breakpoint
CREATE INDEX "idx_qa_histories_user_id" ON "qa_histories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_qa_histories_created_at" ON "qa_histories" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_review_document_caches_review_target_id" ON "review_document_caches" USING btree ("review_target_id");--> statement-breakpoint
CREATE INDEX "idx_review_results_review_target_id" ON "review_results" USING btree ("review_target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_review_results_target_content" ON "review_results" USING btree ("review_target_id","check_list_item_content");--> statement-breakpoint
CREATE INDEX "idx_review_spaces_project_id" ON "review_spaces" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_review_targets_review_space_id" ON "review_targets" USING btree ("review_space_id");--> statement-breakpoint
CREATE INDEX "idx_review_targets_status" ON "review_targets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_system_notifications_display_order" ON "system_notifications" USING btree ("display_order");