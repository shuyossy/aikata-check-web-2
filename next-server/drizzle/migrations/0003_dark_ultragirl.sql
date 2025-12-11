CREATE TABLE "check_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_space_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "check_list_items" ADD CONSTRAINT "check_list_items_review_space_id_review_spaces_id_fk" FOREIGN KEY ("review_space_id") REFERENCES "public"."review_spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_check_list_items_review_space_id" ON "check_list_items" USING btree ("review_space_id");