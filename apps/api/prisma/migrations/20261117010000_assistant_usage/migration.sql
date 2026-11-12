-- Answered assistant messages: who, which pet, when and how many tokens.
-- Additive. The conversation itself is never stored.
CREATE TABLE "assistant_usage" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "assistant_usage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assistant_usage_user_id_created_at_idx" ON "assistant_usage"("user_id", "created_at");

CREATE INDEX "assistant_usage_pet_id_idx" ON "assistant_usage"("pet_id");

ALTER TABLE "assistant_usage" ADD CONSTRAINT "assistant_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_usage" ADD CONSTRAINT "assistant_usage_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
