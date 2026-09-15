import { createPartFromFunctionResponse } from '@google/genai';
import * as chatRepository from './chat.repository.js';
import { buildToolDeclarations, executeTool } from './chat.tools.js';
import { generateWithTools } from '../ai/gemini.client.js';
import { paginate, paginatedResponse } from '../../utils/pagination.js';
import { todayISODate } from '../../utils/dates.js';
import { logger } from '../../utils/logger.js';

/**
 * Maximum tool round-trips in a single turn.
 *
 * Without a cap, a model that keeps calling tools — because one keeps failing,
 * or because it is looping between two — would run until the request times out,
 * spending tokens the whole way. Five is comfortably more than any legitimate
 * turn needs: "log my lunch and tell me how I am doing" is two.
 */
const MAX_TOOL_ITERATIONS = 5;

/** How many past messages to replay as context. */
const CONTEXT_MESSAGE_LIMIT = 20;

/**
 * @returns {string} The system instruction, with today's date baked in.
 */
function buildSystemInstruction() {
  return `
You are the assistant inside a personal calorie tracker. The user talks to you
instead of using forms, so you must actually perform actions with the tools
available — never claim to have logged something you did not log.

Today is ${todayISODate()}. Resolve relative dates ("yesterday", "last Tuesday")
against it before calling a tool.

Guidelines:
- When the user mentions eating something, call log_meal. If they do not give
  nutrition values, estimate them from typical portions and say that you did.
- Do not send consumedAt to log_meal unless the user said when they ate. "I had
  lunch" means now; it is not a request to date the entry to midday. If a
  log_meal call is rejected as being in the future, retry with consumedAt
  omitted — never move the meal to an earlier day.
- Prefer one tool call with complete arguments over several partial ones.
- If a tool returns an error, tell the user plainly what went wrong and what
  would fix it. Do not retry the identical call.
- Answer in plain language, briefly. Never show raw JSON or mention tool names.
- Write plain sentences. No markdown: no **bold**, no bullet characters, no headings.
- You cannot see the user's data unless you fetch it with a tool. Do not guess
  at totals or goals.
`.trim();
}

/**
 * Rebuilds conversation context for the model.
 *
 * Only the text of past turns is replayed, not past tool calls and results.
 * Re-feeding yesterday's tool output would let the model answer today's "how am
 * I doing?" from stale numbers; with only the dialogue in context it calls the
 * tool again and gets current data. The stored tool calls are for rendering the
 * conversation in the UI, not for reasoning.
 *
 * @param {{ role: string, content: string | null }[]} messages
 * @returns {object[]}
 */
function toModelContents(messages) {
  return messages
    .filter((message) => message.content)
    .map((message) => ({
      // Gemini's role for its own turns is "model"; ours is stored as "assistant".
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));
}

/**
 * Handles one user message: the full tool-calling loop, then persistence.
 *
 * The loop is the whole feature: send the conversation plus tool declarations →
 * if the reply contains function calls, run them and append the results → send
 * again → repeat until the model answers with text.
 *
 * @param {number} userId
 * @param {string} message
 * @returns {Promise<{ reply: string, toolCalls: object[], userMessage: object, assistantMessage: object }>}
 */
export async function sendMessage(userId, message) {
  const history = await chatRepository.listRecentForContext(userId, CONTEXT_MESSAGE_LIMIT);
  const contents = [...toModelContents(history), { role: 'user', parts: [{ text: message }] }];
  const tools = buildToolDeclarations();

  /** Everything the tools did this turn, for the UI and the audit trail. */
  const performedCalls = [];
  let reply = '';

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const response = await generateWithTools({
      contents,
      systemInstruction: buildSystemInstruction(),
      tools,
    });

    const functionCalls = response.functionCalls ?? [];

    if (functionCalls.length === 0) {
      reply = response.text?.trim() ?? '';
      break;
    }

    // Append the model's turn EXACTLY as it came back, rather than rebuilding
    // it from `functionCalls`.
    //
    // Gemini 3 attaches a `thoughtSignature` to each functionCall part, and
    // requires it echoed back verbatim in the conversation history — a
    // reconstructed part drops it and the next request fails with "Function
    // call is missing a thought_signature". Reusing the original content also
    // preserves any text the model emitted alongside the calls.
    const modelTurn = response.candidates?.[0]?.content;
    contents.push(
      modelTurn ?? { role: 'model', parts: functionCalls.map((call) => ({ functionCall: call })) },
    );

    const resultParts = [];

    for (const call of functionCalls) {
      const outcome = await executeTool(userId, { name: call.name, args: call.args });

      performedCalls.push({
        name: call.name,
        args: call.args ?? {},
        ok: outcome.ok,
        summary: outcome.ok ? outcome.summary : outcome.error.message,
        error: outcome.ok ? undefined : outcome.error,
      });

      logger.info(`Chat tool ${call.name} ${outcome.ok ? 'succeeded' : 'failed'}`, {
        userId,
        tool: call.name,
      });

      resultParts.push(
        createPartFromFunctionResponse(
          call.id ?? call.name,
          call.name,
          // A failure is data, not an exception: the model reads it and
          // explains the problem instead of the turn collapsing.
          outcome.ok ? { result: outcome.result } : { error: outcome.error },
        ),
      );
    }

    // Tool results go back as a user turn — that is how the Gemini API models
    // "here is what your function returned".
    contents.push({ role: 'user', parts: resultParts });
  }

  if (!reply) {
    // The cap was reached with the model still asking for tools. The work it
    // did is already done and recorded, so report that rather than pretending
    // nothing happened.
    reply = performedCalls.length
      ? `I did that, but could not finish explaining it. Here is what I completed: ${performedCalls
          .map((call) => call.summary)
          .join('; ')}.`
      : 'Sorry — I could not work out how to answer that. Could you rephrase it?';

    logger.warn('Chat turn hit the tool iteration cap', { userId, calls: performedCalls.length });
  }

  const userMessage = await chatRepository.insertMessage(userId, { role: 'user', content: message });
  const assistantMessage = await chatRepository.insertMessage(userId, {
    role: 'assistant',
    content: reply,
    toolCalls: performedCalls.length ? performedCalls : null,
  });

  return { reply, toolCalls: performedCalls, userMessage, assistantMessage };
}

/**
 * Paginated conversation history, newest first — the same envelope as every
 * other list endpoint.
 *
 * @param {number} userId
 * @param {{ page?: number, limit?: number }} queryParams
 * @returns {Promise<{ data: unknown[], pagination: object }>}
 */
export async function getHistory(userId, queryParams) {
  const { page, limit, offset } = paginate(queryParams);

  const [data, total] = await Promise.all([
    chatRepository.listMessages(userId, { limit, offset }),
    chatRepository.countMessages(userId),
  ]);

  return paginatedResponse(data, { page, limit, total });
}
