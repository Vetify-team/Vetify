---
sidebar_position: 9
title: Assistant
---

# Assistant

A conversational assistant that answers questions about **one pet** using its real record. It
talks to a language model provider through an OpenAI-compatible chat completions API with
function calling, and reads the record only through read-only tools that run with the
caller's own permissions.

## Endpoint

```http
POST /api/v1/pets/{petId}/assistant/messages
Authorization: Bearer <access token>
Content-Type: application/json
```

```json
{
  "messages": [
    { "role": "user", "content": "¿Cuándo le toca la próxima vacuna?" },
    { "role": "assistant", "content": "La antirrábica vence el 2027-01-10…" },
    { "role": "user", "content": "¿Y la desparasitación?" }
  ]
}
```

`assistantRequestSchema` in `@vetify/types`:

- 1 to **20** messages, oldest first; each with `role` `user` or `assistant` and 1 to **2,000**
  characters of text.
- The **last** message must be `user`: it is the question being asked.
- The server **stores no conversation**. The client keeps it and sends it again with every
  question.

Response (`assistantReplySchema`), `200`:

```json
{
  "reply": "La última desparasitación interna fue el 2026-09-01 y la próxima es el 2026-12-01…",
  "urgent": false,
  "usage": { "used": 4, "limit": 30 }
}
```

- `urgent`: the question mentions an emergency sign (see below). Show it prominently.
- `usage.used`: messages answered this calendar month (Costa Rica time) by this user.
- `usage.limit`: the monthly allowance, or `null` when unlimited.

## Modes

The mode comes from the **role of the authenticated user**; the client cannot choose it.

| Role     | Mode     | How it answers                                                                                                                                                                                                                                                                                                                   |
| -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `owner`  | `owner`  | Plain language. Does not diagnose, never gives medication doses and never recommends human medication. Suggests seeing the clinic when it matters. It adds no "guidance, not a veterinary consultation" notice: the interface shows it as a fixed footer under every conversation.                                               |
| `clinic` | `clinic` | Technical and concise; may discuss differential diagnoses and protocols, and leaves the clinical decision to the veterinarian. Knows how to write a **pre-consultation summary** (history, overdue or upcoming vaccines, active treatments, weight trend, points to check) and **instructions for the owner** in plain language. |

In both modes the assistant only talks about pet health, care, nutrition, behavior and this
pet's record, and politely declines anything else. It takes record data **only from the
tools**: if something is not there it says it is not recorded, it never invents dates or
entries, and it cites the date of every record fact it uses. Requests to change these rules
or reveal the instructions are ignored. The prompts live in `apps/api/src/assistant/prompts.ts`.

## Authorization and access log

- `PermissionsService.authorize(user, petId, 'read')` runs **before anything else**, even
  before checking whether the assistant is enabled. Another owner gets `404`; a clinic
  without an active full permission (or whose clinic is suspended) gets the usual `403`.
- Clinic mode is for **any active member of the clinic team**, `admin` or `veterinarian`:
  the same membership the record checks. The clinic must also be in good standing: a clinic
  that is not verified answers `403 CLINIC_NOT_VERIFIED` and a suspended one
  `403 CLINIC_SUSPENDED` (the errors linking uses), without calling the model or counting a
  message. A suspension also revokes the members' sessions, so their tokens answer `401`.
- Every tool calls the existing services (`PetsService`, `RecordsService`,
  `VaccinationStatusService`) with the same user, so each one is authorized again. A
  permission revoked mid-conversation stops the next tool call. The assistant never queries
  the database for record data.
- Tools take **no pet id**: they always read the pet of the URL, so the model cannot ask for
  another pet.
- Each use writes `use_assistant` to the pet's access log (deduplicated like other reads), so
  the owner sees when a clinic used the assistant on their pet.

## Record summary

Before the first model call the API reads a compact summary of the pet and puts it in the
system message, between `<expediente>` tags and marked as data, not instructions: the profile,
the schedule status, the vaccination history, active treatments (started and not ended), the
last 5 weights (oldest first) and the last consultation. It is read through the same services
and built with the same DTOs as the tools, so the same minimization applies. Most questions
are then answered in a single model call; the tools stay available for anything deeper (exams,
dewormings, feeding, older consultations or weights). Nothing is read for an owner's emergency
or a question over the monthly limit.

## Tools

`get_pet_profile`, `get_vaccination_status`, `list_vaccinations`, `list_consultations`, `list_treatments`,
`list_dewormings`, `list_exams`, `get_weight_series` and `list_feeding`. Each listing sends
at most the **20** newest entries of its section. The model gets at most **5** rounds per
question (the last one without tools, so it has to answer) and up to 8 tool calls per round.

`get_vaccination_status` is the schedule of Costa Rica: only the vaccines it defines.
`list_vaccinations` is the real history: every dose with the vaccine name as recorded (also
vaccines off the schedule), application and expiry dates, its computed status, whether a later
dose of the same vaccine replaced it, and who signed it (clinic and veterinarian, by name) when
the record says.

Dates are worked out by the API, not the model. The system message states today in Costa Rica
time, in words and as a date ("jueves, 12 de noviembre de 2026 (2026-11-12)"). Vaccine and
deworming statuses come already computed, with the same rule as the card and the reminders, in
words: `vigente`, `por vencer` (30 days or less), `vencida`, `pendiente` or
`aún no corresponde`, with the days left until expiry or the next dose. The prompt tells the
model to use them as they are.

## What is sent to the provider

Only compact DTOs built field by field (`apps/api/src/assistant/tools.ts`):

| Sent                                                                     | Never sent                              |
| ------------------------------------------------------------------------ | --------------------------------------- |
| Species, breed, sex, neutered, age in years and months                   | Pet name, birth date, microchip, photo  |
| Each record's id and date                                                | Owner name, email, phone                |
| Clinical fields: reason, diagnosis, notes, vaccine and status, product,  | User, clinic and veterinarian ids       |
| treatment description, exam kind and result, weight, feeding notes       | Vaccine batch, exam file links          |
| Who signed a vaccine (clinic and veterinarian name), in its history only | Clinic and veterinarian names elsewhere |

The conversation the user typed is sent as is: whatever the user writes in it reaches the
provider. `tools.spec.ts` checks every tool's output against owner data, the microchip and
internal ids.

## Emergency signs

Before calling the model, the last user message is checked against Spanish emergency signs
(seizures, not breathing or breathing with difficulty, poisoning or eating poison, chocolate or
rat poison, heavy bleeding, hit by a vehicle, swollen belly with retching, not urinating, loss
of consciousness, heat stroke), ignoring accents and case (`safety.ts`).

- **Owner**: the API answers a fixed message telling them to go to an emergency veterinary
  clinic now, with `urgent: true`, **without calling the model** and without counting the
  message. It answers this even over the monthly limit.
- **Clinic**: `urgent: true` and the question goes to the model as usual.

## Limits

- **Rate**: 10 questions per minute per account, on top of the general per-IP limit. Over it:
  `429 RATE_LIMITED`.
- **Monthly allowance**: owners on the free plan get `ASSISTANT_FREE_MONTHLY_MESSAGES`
  (default 30) answered messages per calendar month in Costa Rica time. As with the pet
  limit, it applies **only while payments are on**. Premium owners and clinics are unlimited
  (`limit: null`). Over it: `429` with `code: RATE_LIMITED` and `reason: ASSISTANT_LIMIT`,
  without calling the model.
- Each answered message writes one row to `assistant_usage` (user, pet, time, prompt and
  completion tokens). No message content is stored. Two requests racing at the limit may both
  be answered.

## Errors

| Status | `code` / `reason`                                 | When                                                                                                                   |
| ------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 400    | `VALIDATION_FAILED`                               | The body breaks the limits above.                                                                                      |
| 404    | `NOT_FOUND`                                       | Not your pet (owner).                                                                                                  |
| 403    | `FORBIDDEN`                                       | Clinic without an active permission.                                                                                   |
| 403    | `CLINIC_NOT_VERIFIED`                             | The clinic has not been verified (or was un-verified) by Vetify.                                                       |
| 403    | `CLINIC_SUSPENDED`                                | The clinic is suspended by Vetify.                                                                                     |
| 429    | `RATE_LIMITED`                                    | Too many questions in a minute.                                                                                        |
| 429    | `RATE_LIMITED` / `ASSISTANT_LIMIT`                | The free plan used up its monthly messages.                                                                            |
| 503    | `ASSISTANT_UNAVAILABLE` / `ASSISTANT_DISABLED`    | No `LLM_API_KEY` configured.                                                                                           |
| 503    | `ASSISTANT_UNAVAILABLE` / `ASSISTANT_UNAVAILABLE` | The provider answered 401, 402 (no credit), 429 or 5xx, timed out (`LLM_TIMEOUT_MS`) or returned something unreadable. |

Provider errors are never forwarded: the client gets the generic `503`, and the API logs only
the HTTP status, never the provider's body, the key or the conversation.

## Configuration

| Variable                          | Default                    | Purpose                                                                                |
| --------------------------------- | -------------------------- | -------------------------------------------------------------------------------------- |
| `LLM_API_KEY`                     | empty (assistant off)      | Provider key. Only the API holds it.                                                   |
| `LLM_BASE_URL`                    | `https://api.deepseek.com` | Base URL; the client posts to `/chat/completions`.                                     |
| `LLM_MODEL`                       | `deepseek-chat`            | Model name at that provider.                                                           |
| `LLM_REASONING_EFFORT`            | `low`                      | Sent as `reasoning_effort` to thinking models; empty sends nothing.                    |
| `LLM_FALLBACK_MODEL`              | empty (no fallback)        | Model tried once for the same round when the main one answers 429 or 5xx or times out. |
| `LLM_TIMEOUT_MS`                  | `15000`                    | Main provider's time per call, in ms (1,000–120,000).                                  |
| `LLM_FALLBACK_TIMEOUT_MS`         | `30000`                    | Fallback's time per call, in ms (1,000–120,000).                                       |
| `LLM_FALLBACK_BASE_URL`           | the main base URL          | Fallback provider's base URL.                                                          |
| `LLM_FALLBACK_API_KEY`            | the main key               | Fallback provider's key.                                                               |
| `ASSISTANT_FREE_MONTHLY_MESSAGES` | `30`                       | Free plan allowance per month.                                                         |

Switching provider is only these variables. For Gemini's OpenAI-compatible endpoint, for
example: `LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/` and a Gemini
model name. Requests use a low temperature and `max_tokens` 2,500, which also covers the reasoning
tokens of thinking models such as Gemini 2.5. If a provider rejects `reasoning_effort`,
set `LLM_REASONING_EFFORT` empty.

### Fallback provider

With `LLM_FALLBACK_MODEL` set, a round whose main call answers 429 or 5xx or takes longer than
`LLM_TIMEOUT_MS` (15 s by default) is sent once more, with the same messages and tools, to the fallback (another model of the
same provider when the fallback base URL and key are empty). Other failures (401, 402, 400, an
unreachable host, an unreadable body) are not retried: the fallback would not fix them. If the
fallback fails too, the answer is the usual `503 ASSISTANT_UNAVAILABLE`, so a question can wait
up to about 45 s with the default timeouts (15 s for the main provider, 30 s for the fallback). Once the fallback answers a round, the following rounds of that question go
straight to it. The API logs which provider answered (`LLM answer from the primary provider` or
`… fallback provider`) and the status of a failure, never the conversation.
