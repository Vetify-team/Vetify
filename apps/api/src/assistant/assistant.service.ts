import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AssistantMode,
  AssistantReply,
  AssistantRequest,
  AssistantUsage,
  TokenPayload,
} from '@vetify/types';
import { assertCanLink } from '../clinics/link-codes.service.js';
import { capsAssistant } from '../billing/billing.logic.js';
import { BillingService } from '../billing/billing.service.js';
import {
  startOfMonthInCostaRica,
  toIsoDate,
  todayInCostaRica,
} from '../common/dates.js';
import { AppException } from '../common/errors.js';
import type { Env } from '../config.js';
import { PermissionsService } from '../permissions/permissions.service.js';
import { PetsService } from '../pets/pets.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RecordsService } from '../records/records.service.js';
import { VaccinationStatusService } from '../records/vaccination-status.service.js';
import {
  assistantDisabled,
  LlmClient,
  type LlmMessage,
  type LlmProvider,
} from './llm.client.js';
import { FALLBACK_REPLY, systemPrompt } from './prompts.js';
import { detectEmergency, EMERGENCY_REPLY } from './safety.js';
import { ASSISTANT_TOOLS, AssistantTools } from './tools.js';

/** Model calls per question; the last one may not call tools. */
export const MAX_ROUNDS = 5;
/** Tool calls run per round; extra ones are answered as skipped. */
export const MAX_TOOL_CALLS_PER_ROUND = 8;

const overLimit = (limit: number) =>
  new AppException(
    HttpStatus.TOO_MANY_REQUESTS,
    'RATE_LIMITED',
    `The free plan includes ${limit} assistant messages per month`,
    { reason: 'ASSISTANT_LIMIT' },
  );

/**
 * Pet assistant: answers about one pet with its real record, read through
 * tools that call the record services as the authenticated user. Nothing of
 * the conversation is stored; `assistant_usage` keeps only who, which pet,
 * when and the tokens, for the monthly allowance.
 */
@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly billing: BillingService,
    private readonly llm: LlmClient,
    private readonly pets: PetsService,
    private readonly records: RecordsService,
    private readonly vaccinationStatus: VaccinationStatusService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async reply(
    user: TokenPayload,
    petId: string,
    request: AssistantRequest,
  ): Promise<AssistantReply> {
    // Before anything else: another owner gets 404, a clinic without an
    // active permission (or a suspended one) the usual 403, whatever the
    // assistant's state. Any member of the clinic's team, admin or
    // veterinarian, passes here.
    const { clinicId } = await this.permissions.authorize(user, petId, 'read');
    if (clinicId) {
      // Reading the record only needs the permission; the assistant also
      // needs the clinic in good standing: verified and not suspended, with
      // the errors linking already uses (403 CLINIC_SUSPENDED or
      // CLINIC_NOT_VERIFIED).
      assertCanLink(
        await this.prisma.clinic.findUniqueOrThrow({ where: { id: clinicId } }),
      );
    }
    if (!this.llm.enabled) throw assistantDisabled();

    const mode: AssistantMode = user.role === 'clinic' ? 'clinic' : 'owner';
    const question = request.messages.at(-1)!.content;
    const urgent = detectEmergency(question);
    const usage = await this.usage(user);

    // An owner's emergency gets the fixed answer even over the monthly limit:
    // it costs nothing and must never wait on the model.
    if (urgent && mode === 'owner') {
      return { reply: EMERGENCY_REPLY, urgent, usage };
    }
    if (usage.limit !== null && usage.used >= usage.limit) {
      throw overLimit(usage.limit);
    }

    const { reply, promptTokens, completionTokens } = await this.converse(
      user,
      petId,
      mode,
      request,
    );
    await this.prisma.assistantUsage.create({
      data: { userId: user.sub, petId, promptTokens, completionTokens },
    });
    return {
      reply,
      urgent,
      usage: { used: usage.used + 1, limit: usage.limit },
    };
  }

  /**
   * Messages answered this month and the allowance: capped only for owners on
   * the free plan while payments are on (the same rule as the pet limit).
   * Two requests racing at the limit may both pass; the per-user rate limit
   * keeps that to a message or two.
   */
  async usage(user: TokenPayload): Promise<AssistantUsage> {
    const used = await this.prisma.assistantUsage.count({
      where: {
        userId: user.sub,
        createdAt: { gte: startOfMonthInCostaRica() },
      },
    });
    if (user.role !== 'owner') return { used, limit: null };
    const { plan } = await this.billing.currentPlan(user);
    return {
      used,
      limit: capsAssistant(this.billing.enabled, plan)
        ? this.config.get('ASSISTANT_FREE_MONTHLY_MESSAGES', { infer: true })
        : null,
    };
  }

  /** The tool loop: at most MAX_ROUNDS model calls. */
  private async converse(
    user: TokenPayload,
    petId: string,
    mode: AssistantMode,
    request: AssistantRequest,
  ): Promise<{
    reply: string;
    promptTokens: number;
    completionTokens: number;
  }> {
    const today = todayInCostaRica();
    const tools = new AssistantTools(
      {
        pets: this.pets,
        records: this.records,
        vaccinationStatus: this.vaccinationStatus,
      },
      user,
      petId,
      today,
    );
    // Preloaded so most questions need a single model call; the tools stay
    // available for anything deeper.
    const summary = await tools.summary();
    const messages: LlmMessage[] = [
      {
        role: 'system',
        content: systemPrompt(mode, today, summary),
      },
      ...request.messages,
    ];
    let promptTokens = 0;
    let completionTokens = 0;
    // Once the fallback answers a round, the rest of the question stays there.
    let provider: LlmProvider | undefined;

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const last = round === MAX_ROUNDS;
      const response = await this.llm.complete({
        messages,
        // The last round has no tools, so the model has to answer.
        tools: last ? undefined : ASSISTANT_TOOLS,
        provider,
      });
      provider = response.provider;
      promptTokens += response.usage.promptTokens;
      completionTokens += response.usage.completionTokens;

      if (!response.toolCalls.length || last) {
        const reply = response.content?.trim();
        return {
          reply: reply || FALLBACK_REPLY,
          promptTokens,
          completionTokens,
        };
      }

      messages.push({
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls,
      });
      for (const [index, call] of response.toolCalls.entries()) {
        messages.push({
          role: 'tool',
          toolCallId: call.id,
          content:
            index < MAX_TOOL_CALLS_PER_ROUND
              ? await tools.run(call.name)
              : JSON.stringify({ error: 'Too many tool calls in one round' }),
        });
      }
    }
    // Unreachable: the last round always returns.
    return { reply: FALLBACK_REPLY, promptTokens, completionTokens };
  }
}
