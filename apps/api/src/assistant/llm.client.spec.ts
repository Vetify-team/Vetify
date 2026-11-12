import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppException } from '../common/errors.js';
import type { Env } from '../config.js';
import {
  LLM_MAX_TOKENS,
  LLM_TIMEOUT_MS,
  OpenAiCompatibleLlmClient,
  type LlmRequest,
} from './llm.client.js';

const KEY = 'sk-test-secret-key-123';
const SECRET_QUESTION = '¿Qué tiene Canela en la pata?';

const clientWith = (settings: Partial<Env>) =>
  new OpenAiCompatibleLlmClient({
    get: (key: keyof Env) => settings[key],
  } as unknown as ConfigService<Env, true>);

const request: LlmRequest = {
  messages: [
    { role: 'system', content: 'Sos el asistente' },
    { role: 'user', content: SECRET_QUESTION },
    {
      role: 'assistant',
      content: null,
      toolCalls: [{ id: 'c1', name: 'list_exams', arguments: '{}' }],
    },
    { role: 'tool', toolCallId: 'c1', content: '{"exams":[]}' },
  ],
  tools: [
    {
      name: 'list_exams',
      description: 'Exámenes',
      parameters: { type: 'object', properties: {} },
    },
  ],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const failure = async (promise: Promise<unknown>) => {
  const error = await promise.catch((e: unknown) => e);
  if (!(error instanceof AppException)) throw new Error('Expected an error');
  return { status: error.getStatus(), body: error.getResponse() };
};

describe('OpenAiCompatibleLlmClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let warn: ReturnType<typeof vi.spyOn>;
  const client = clientWith({
    LLM_API_KEY: KEY,
    LLM_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    LLM_MODEL: 'gemini-2.5-flash',
    LLM_REASONING_EFFORT: 'low',
  });

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('is off without a key and answers 503 ASSISTANT_DISABLED', async () => {
    const off = clientWith({ LLM_API_KEY: '' });
    expect(off.enabled).toBe(false);
    expect(await failure(off.complete(request))).toMatchObject({
      status: 503,
      body: { code: 'ASSISTANT_UNAVAILABLE', reason: 'ASSISTANT_DISABLED' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts an OpenAI-compatible chat completion with function calling', async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        choices: [{ message: { content: 'Hola', tool_calls: null } }],
        usage: { prompt_tokens: 120, completion_tokens: 8 },
      }),
    );

    expect(await client.complete(request)).toEqual({
      content: 'Hola',
      toolCalls: [],
      usage: { promptTokens: 120, completionTokens: 8 },
    });

    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${KEY}`,
    );
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      model: 'gemini-2.5-flash',
      max_tokens: LLM_MAX_TOKENS,
      reasoning_effort: 'low',
      tool_choice: 'auto',
      tools: [{ type: 'function', function: { name: 'list_exams' } }],
    });
    expect(body.temperature).toBeLessThanOrEqual(0.3);
    expect(body.messages[2]).toEqual({
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'c1',
          type: 'function',
          function: { name: 'list_exams', arguments: '{}' },
        },
      ],
    });
    expect(body.messages[3]).toEqual({
      role: 'tool',
      tool_call_id: 'c1',
      content: '{"exams":[]}',
    });
  });

  it('echoes provider fields of a tool call back, such as Gemini thought signatures', async () => {
    const extra = { google: { thought_signature: 'c2lnbmF0dXJl' } };
    fetchMock.mockResolvedValueOnce(
      json({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'list_exams', arguments: '{}' },
                  extra_content: extra,
                },
              ],
            },
          },
        ],
      }),
    );
    const first = await client.complete(request);
    expect(first.toolCalls).toEqual([
      {
        id: 'call_1',
        name: 'list_exams',
        arguments: '{}',
        providerData: { extra_content: extra },
      },
    ]);

    fetchMock.mockResolvedValueOnce(
      json({ choices: [{ message: { content: 'Listo' } }] }),
    );
    await client.complete({
      messages: [
        ...request.messages.slice(0, 2),
        { role: 'assistant', content: null, toolCalls: first.toolCalls },
        { role: 'tool', toolCallId: 'call_1', content: '{}' },
      ],
    });
    const body = JSON.parse(
      (fetchMock.mock.calls[1]![1] as RequestInit).body as string,
    );
    expect(body.messages[2].tool_calls).toEqual([
      {
        extra_content: extra,
        id: 'call_1',
        type: 'function',
        function: { name: 'list_exams', arguments: '{}' },
      },
    ]);
  });

  it('sends no reasoning_effort when it is empty', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ choices: [{ message: { content: 'Hola' } }] }),
    );
    await clientWith({
      LLM_API_KEY: KEY,
      LLM_BASE_URL: 'https://api.deepseek.com',
      LLM_MODEL: 'deepseek-chat',
      LLM_REASONING_EFFORT: '',
    }).complete(request);
    const body = JSON.parse(
      (fetchMock.mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(body).not.toHaveProperty('reasoning_effort');
  });

  it('sends no tools when none are given', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ choices: [{ message: { content: 'Hola' } }] }),
    );
    const result = await client.complete({
      messages: request.messages.slice(0, 2),
    });
    const body = JSON.parse(
      (fetchMock.mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
    expect(result.usage).toEqual({ promptTokens: 0, completionTokens: 0 });
  });

  it('reads the tool calls the model asks for', async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call_9',
                  type: 'function',
                  function: { name: 'get_weight_series', arguments: '{}' },
                },
              ],
            },
          },
        ],
      }),
    );
    expect((await client.complete(request)).toolCalls).toEqual([
      { id: 'call_9', name: 'get_weight_series', arguments: '{}' },
    ]);
  });

  it.each([401, 402, 429, 500, 503])(
    'answers %i from the provider with 503, without its body or the key',
    async (status) => {
      fetchMock.mockResolvedValueOnce(
        json(
          {
            error: {
              message: `Insufficient balance for key ${KEY}: ${SECRET_QUESTION}`,
            },
          },
          status,
        ),
      );
      const { status: answered, body } = await failure(
        client.complete(request),
      );
      expect(answered).toBe(503);
      expect(body).toEqual({
        code: 'ASSISTANT_UNAVAILABLE',
        message: 'The assistant is not available right now',
        reason: 'ASSISTANT_UNAVAILABLE',
      });
      const logged = JSON.stringify(warn.mock.calls);
      expect(logged).toContain(String(status));
      expect(logged).not.toContain(KEY);
      expect(logged).not.toContain(SECRET_QUESTION);
    },
  );

  it('answers a timeout with 503', async () => {
    fetchMock.mockRejectedValueOnce(
      new DOMException('The operation timed out', 'TimeoutError'),
    );
    expect((await failure(client.complete(request))).status).toBe(503);
    expect(JSON.stringify(warn.mock.calls)).toMatch(/did not answer in time/);
    expect(LLM_TIMEOUT_MS).toBe(30_000);
  });

  it('answers a network failure with 503', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect((await failure(client.complete(request))).status).toBe(503);
  });

  it('answers a malformed body with 503', async () => {
    fetchMock.mockResolvedValueOnce(json({ choices: [] }));
    expect((await failure(client.complete(request))).status).toBe(503);
    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 200 }));
    expect((await failure(client.complete(request))).status).toBe(503);
  });
});
