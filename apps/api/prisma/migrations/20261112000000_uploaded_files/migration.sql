-- Uploaded pet photos and exam files (Cloudinary public ids).
ALTER TABLE "pets" ADD COLUMN "photo_id" TEXT;
CREATE UNIQUE INDEX "pets_photo_id_key" ON "pets"("photo_id");

ALTER TABLE "exams" ADD COLUMN "file_id" TEXT,
ADD COLUMN "file_format" TEXT,
ADD COLUMN "recorded_by_owner" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "exams_file_id_key" ON "exams"("file_id");
