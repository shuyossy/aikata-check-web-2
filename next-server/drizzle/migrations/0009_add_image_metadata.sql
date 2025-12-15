-- ai_task_file_metadataテーブルに画像処理用カラムを追加
ALTER TABLE "ai_task_file_metadata" ADD COLUMN "process_mode" varchar(10) NOT NULL DEFAULT 'text';
ALTER TABLE "ai_task_file_metadata" ADD COLUMN "converted_image_count" integer NOT NULL DEFAULT 0;
