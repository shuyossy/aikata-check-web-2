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
	"check_list_item_id" uuid NOT NULL,
	"evaluation" varchar(20),
	"comment" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_space_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"review_settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_document_caches" ADD CONSTRAINT "review_document_caches_review_target_id_review_targets_id_fk" FOREIGN KEY ("review_target_id") REFERENCES "public"."review_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_results" ADD CONSTRAINT "review_results_review_target_id_review_targets_id_fk" FOREIGN KEY ("review_target_id") REFERENCES "public"."review_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_results" ADD CONSTRAINT "review_results_check_list_item_id_check_list_items_id_fk" FOREIGN KEY ("check_list_item_id") REFERENCES "public"."check_list_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_targets" ADD CONSTRAINT "review_targets_review_space_id_review_spaces_id_fk" FOREIGN KEY ("review_space_id") REFERENCES "public"."review_spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_review_document_caches_review_target_id" ON "review_document_caches" USING btree ("review_target_id");--> statement-breakpoint
CREATE INDEX "idx_review_results_review_target_id" ON "review_results" USING btree ("review_target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_review_results_target_item" ON "review_results" USING btree ("review_target_id","check_list_item_id");--> statement-breakpoint
CREATE INDEX "idx_review_targets_review_space_id" ON "review_targets" USING btree ("review_space_id");--> statement-breakpoint
CREATE INDEX "idx_review_targets_status" ON "review_targets" USING btree ("status");