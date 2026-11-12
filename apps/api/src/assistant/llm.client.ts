import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { AppException } from '../common/errors.js';
import type { Env } from '../config.js';

/** A tool call the model asked for; `arguments` is the model's raw JSON text. */
export interface LlmToolCall {
  id: string;
  name: string;
  arguments: string;
}

export type LlmMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; toolCalls?: LlmToolCall[] }
  | { role: 'tool'; toolCallId: string; content: string };

/** A function the model may call, described with a JSON Schema. */
export interface LlmTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmRequest {
  messages: LlmMessage[];
  /** Omitted or empty: the model must answer in text. */
  tools?: LlmTool[];
}

export interface LlmResponse {
  content: string | null;
  toolCalls: LlmToolCall[];
  usage: { promptTokens: number; completionTokens: number };
}

/**
 * A chat model with function calling. The service depends on this abstract
 * class (also the injection token), so tests replace the provider.
 */
export abstract class LlmClient {
  /** False when no provider is configured: the assistant is off. */
  abstract readonly enabled: boolean;
  abstract complete(request: LlmRequest): Promise<LlmResponse>;
}

/** 503 ASSISTANT_UNAVAILABLE. Never carries the provider's answer or key. */
export const assistantUnavailable = () =>
  new AppException(
    HttpStatus.SERVICE_UNAVAILABLE,
    'ASSISTANT_UNAVAILABLE',
    'The assistant is not available right now',
    { reason: 'ASSISTANT_UNAVAILABLE' },
  );

/** 503 ASSISTANT_DISABLED: no LLM_API_KEY. */
export const assistantDisabled = () =>
  new AppException(
    HttpStatus.SERVICE_UNAVAILABLE,
    'ASSISTANT_UNAVAILABLE',
    'The assistant is not enabled on this server',
    { reason: 'ASSISTANT_DISABLED' },
  );

export const LLM_TIMEOUT_MS = 30_000;
/** Bounds the answer (and the cost); enough for a pre-consultation summary. */
export const LLM_MAX_TOKENS = 1_200;
/** Low: answers grounded in the record, not creative. */
export const LLM_TEMPERATURE = 0.2;

/** The part of a chat completions response this client reads. */
const completionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullish(),
          tool_calls: z
            .array(
              z.object({
                id: z.string(),
                type: z.string().optional(),
                function: z.object({
                  name: z.string(),
                  arguments: z.string().nullish(),
                }),
              }),
            )
            .nullish(),
        }),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative().optional(),
      completion_tokens: z.number().int().nonnegative().optional(),
    })
    .nullish(),
});

const toWire = (message: LlmMessage) => {
  switch (message.role) {
    case 'tool':
      return {
        role: 'tool',
        tool_call_id: message.toolCallId,
        content: message.content,
      };
    case 'assistant':
      return {
        role: 'assistant',
        content: message.content,
        ...(message.toolCalls?.length
          ? {
              tool_calls: message.toolCalls.map((call) => ({
                id: call.id,
                type: 'function',
                function: { name: call.name, arguments: call.arguments },
              })),
            }
          : {}),
      };
    default:
      return message;
  }
};

/**
 * Any provider with an OpenAI-compatible `POST {LLM_BASE_URL}/chat/completions`
 * and function calling: switching provider is only LLM_BASE_URL, LLM_MODEL and
 * LLM_API_KEY. Every failure (no answer in 30 s, 401, 402 without credit, 429,
 * 5xx, a malformed body) becomes 503 ASSISTANT_UNAVAILABLE. Only the status is
 * logged: neither the conversation nor the provider's body, which may echo it.
 */
@Injectable()
export class OpenAiCompatibleLlmClient extends LlmClient {
  private readonly logger = new Logger('LlmClient');

  constructor(private readonly config: ConfigService<Env, true>) {
    super();
  }

  get enabled(): boolean {
    return Boolean(this.config.get('LLM_API_KEY', { infer: true }));
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    if (!this.enabled) throw assistantDisabled();
    const body = {
      model: this.config.get('LLM_MODEL', { infer: true }),
      messages: request.messages.map(toWire),
      temperature: LLM_TEMPERATURE,
      max_tokens: LLM_MAX_TOKENS,
      ...(request.tools?.length
        ? {
            tools: request.tools.map((tool) => ({
              type: 'function',
              function: tool,
            })),
            tool_choice: 'auto',
          }
        : {}),
    };

    let res: Response;
    try {
      res = await fetch(
        `${this.config.get('LLM_BASE_URL', { infer: true })}/chat/completions`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.get('LLM_API_KEY', { infer: true })}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
        },
      );
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      this.logger.warn(
        timedOut
          ? 'LLM provider did not answer in time'
          : 'LLM provider could not be reached',
      );
      throw assistantUnavailable();
    }

    if (!res.ok) {
      this.logger.warn(`LLM provider answered ${res.status}`);
      // Drain the body so the connection is released; its content is ignored.
      await res.body?.cancel().catch(() => undefined);
      throw assistantUnavailable();
    }

    const parsed = completionSchema.safeParse(
      await res.json().catch(() => null),
    );
    if (!parsed.success) {
      this.logger.warn('LLM provider returned an unexpected response');
      throw assistantUnavailable();
    }
    const { message } = parsed.data.choices[0]!;
    return {
      content: message.content ?? null,
      toolCalls: (message.tool_calls ?? []).map((call) => ({
        id: call.id,
        name: call.function.name,
        arguments: call.function.arguments ?? '',
      })),
      usage: {
        promptTokens: parsed.data.usage?.prompt_tokens ?? 0,
        completionTokens: parsed.data.usage?.completion_tokens ?? 0,
      },
    };
  }
}
