CREATE TABLE "idempotency_results" (
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "scope" VARCHAR(128) NOT NULL,
  "key_hash" CHAR(64) NOT NULL,
  "fingerprint" CHAR(64) NOT NULL,
  "response" JSONB NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  PRIMARY KEY ("user_id", "scope", "key_hash")
);
CREATE INDEX "idempotency_results_expires_at_idx" ON "idempotency_results"("expires_at");
