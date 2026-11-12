-- Registration links an admin issues to a clinic after it pays.
CREATE TABLE "clinic_signup_links" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "clinic_name" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "payment_reference" TEXT,
    "token_hash" TEXT NOT NULL,
    "created_by_id" UUID,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "used_clinic_id" UUID,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_signup_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "clinic_signup_links_token_hash_key" ON "clinic_signup_links"("token_hash");
CREATE INDEX "clinic_signup_links_created_at_idx" ON "clinic_signup_links"("created_at");
ALTER TABLE "clinic_signup_links" ADD CONSTRAINT "clinic_signup_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
