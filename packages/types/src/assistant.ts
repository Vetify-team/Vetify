import { z } from "zod";
import { multilineTextSchema } from "./common.js";

/** Messages of a conversation the client may send in one request. */
export const ASSISTANT_MAX_MESSAGES = 20;
/** Characters per message. */
export const ASSISTANT_MAX_MESSAGE_CHARS = 2000;

/**
 * How the assistant talks: plain language for the owner, technical for the
 * veterinarian. Derived from the authenticated role, never sent by the client.
 */
export const assistantModeSchema = z.enum(["owner", "clinic"]);
export type AssistantMode = z.infer<typeof assistantModeSchema>;

export const assistantMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: multilineTextSchema(ASSISTANT_MAX_MESSAGE_CHARS).min(1, {
    error: "Message is required",
  }),
});
export type AssistantMessage = z.infer<typeof assistantMessageSchema>;

/**
 * The whole conversation so far, oldest first. The server keeps no history:
 * the client sends it again with each question, which must come last.
 */
export const assistantRequestSchema = z.object({
  messages: z
    .array(assistantMessageSchema)
    .min(1)
    .max(ASSISTANT_MAX_MESSAGES)
    .refine((messages) => messages.at(-1)?.role === "user", {
      error: "The last message must be the user's",
    }),
});
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;

export const assistantUsageSchema = z.object({
  /** Messages answered this calendar month (Costa Rica time). */
  used: z.number().int().min(0),
  /** Monthly allowance; null when unlimited. */
  limit: z.number().int().min(0).nullable(),
});
export type AssistantUsage = z.infer<typeof assistantUsageSchema>;

export const assistantReplySchema = z.object({
  reply: z.string(),
  /** The question mentions an emergency sign: show it prominently. */
  urgent: z.boolean(),
  usage: assistantUsageSchema,
});
export type AssistantReply = z.infer<typeof assistantReplySchema>;
