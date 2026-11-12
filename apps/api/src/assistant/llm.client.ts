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
  /**
   * Fields the provider added to the call beyond the standard ones, sent back
   * unchanged with it in the next round. Gemini 3 puts its thought signature
   * here (`extra_content`) and rejects a follow-up without it.
   */
  providerData?: Record<string, unknown>;
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

/** Which configured provider answered: the main one or the fallback. */
export type LlmProvider = 'primary' | 'fallback';

export interface LlmRequest {
  messages: LlmMessage[];
  /** Omitted or empty: the model must answer in text. */
  tools?: LlmTool[];
  /**
   * Start with this provider. The service passes the one that answered the
   * previous round, so a conversation that moved to the fallback stays there:
   * no second wait for a failing main provider, and no tool call fields of
   * one model sent to another.
   */
  provider?: LlmProvider;
}

export interface LlmResponse {
  content: string | null;
  toolCalls: LlmToolCall[];
  usage: { promptTokens: number; completionTokens: number };
  provider: LlmProvider;
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

/** Defaults of LLM_TIMEOUT_MS and LLM_FALLBACK_TIMEOUT_MS. */
export const LLM_TIMEOUT_MS = 15_000;
export const LLM_FALLBACK_TIMEOUT_MS = 30_000;
/**
 * Bounds the answer (and the cost). Thinking models count their reasoning
 * here too, so it leaves room for that and a pre-consultation summary.
 */
export const LLM_MAX_TOKENS = 2_500;
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
              // Loose: unknown fields are kept and echoed back (providerData).
              z.looseObject({
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
                ...call.providerData,
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

interface ProviderSettings {
  name: LlmProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

/** A failure worth one more try with the fallback: 429, 5xx or a timeout. */
const RETRY = Symbol('retry');

/**
 * Any provider with an OpenAI-compatible `POST {LLM_BASE_URL}/chat/completions`
 * and function calling: switching provider is only LLM_BASE_URL, LLM_MODEL and
 * LLM_API_KEY. Every failure (no answer in LLM_TIMEOUT_MS, 401, 402 without credit, 429,
 * 5xx, a malformed body) becomes 503 ASSISTANT_UNAVAILABLE. With
 * LLM_FALLBACK_MODEL, a 429, 5xx or timeout of the main provider is retried
 * once, for the same round, with the fallback. Only the status and which
 * provider answered are logged: neither the conversation nor the provider's
 * body, which may echo it.
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

  /** Main provider, then the fallback if one is configured. */
  private providers(): ProviderSettings[] {
    const get = <K extends keyof Env>(key: K) =>
      this.config.get(key, { infer: true }) as Env[K];
    const primary: ProviderSettings = {
      name: 'primary',
      baseUrl: get('LLM_BASE_URL'),
      apiKey: get('LLM_API_KEY'),
      model: get('LLM_MODEL'),
      timeoutMs: get('LLM_TIMEOUT_MS') ?? LLM_TIMEOUT_MS,
    };
    const fallbackModel = get('LLM_FALLBACK_MODEL');
    if (!fallbackModel) return [primary];
    return [
      primary,
      {
        name: 'fallback',
        baseUrl: get('LLM_FALLBACK_BASE_URL') || primary.baseUrl,
        apiKey: get('LLM_FALLBACK_API_KEY') || primary.apiKey,
        model: fallbackModel,
        timeoutMs: get('LLM_FALLBACK_TIMEOUT_MS') ?? LLM_FALLBACK_TIMEOUT_MS,
      },
    ];
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    if (!this.enabled) throw assistantDisabled();
    const providers = this.providers();
    const startAt =
      request.provider === 'fallback' && providers.length > 1 ? 1 : 0;
    for (const provider of providers.slice(startAt)) {
      const outcome = await this.attempt(provider, request);
      if (outcome !== RETRY) {
        this.logger.log(`LLM answer from the ${provider.name} provider`);
        return outcome;
      }
    }
    throw assistantUnavailable();
  }

  /**
   * One call to one provider. Returns RETRY for a failure the fallback may
   * fix (429, 5xx, timeout); throws 503 for any other.
   */
  private async attempt(
    provider: ProviderSettings,
    request: LlmRequest,
  ): Promise<LlmResponse | typeof RETRY> {
    const reasoningEffort = this.config.get('LLM_REASONING_EFFORT', {
      infer: true,
    });
    const body = {
      model: provider.model,
      messages: request.messages.map(toWire),
      temperature: LLM_TEMPERATURE,
      max_tokens: LLM_MAX_TOKENS,
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
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
      res = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(provider.timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      this.logger.warn(
        timedOut
          ? `LLM ${provider.name} provider did not answer in time`
          : `LLM ${provider.name} provider could not be reached`,
      );
      if (timedOut) return RETRY;
      throw assistantUnavailable();
    }

    if (!res.ok) {
      this.logger.warn(`LLM ${provider.name} provider answered ${res.status}`);
      // Drain the body so the connection is released; its content is ignored.
      await res.body?.cancel().catch(() => undefined);
      if (res.status === 429 || res.status >= 500) return RETRY;
      throw assistantUnavailable();
    }

    const parsed = completionSchema.safeParse(
      await res.json().catch(() => null),
    );
    if (!parsed.success) {
      this.logger.warn(
        `LLM ${provider.name} provider returned an unexpected response`,
      );
      throw assistantUnavailable();
    }
    const { message } = parsed.data.choices[0]!;
    return {
      content: message.content ?? null,
      toolCalls: (message.tool_calls ?? []).map(
        ({ id, type: _type, function: fn, ...providerData }) => ({
          id,
          name: fn.name,
          arguments: fn.arguments ?? '',
          ...(Object.keys(providerData).length ? { providerData } : {}),
        }),
      ),
      usage: {
        promptTokens: parsed.data.usage?.prompt_tokens ?? 0,
        completionTokens: parsed.data.usage?.completion_tokens ?? 0,
      },
      provider: provider.name,
    };
  }
}
