import { request } from './client.js';

/**
 * @typedef {object} ToolCall
 * @property {string} name  The tool the assistant ran, e.g. "log_meal".
 * @property {object} args
 * @property {boolean} ok
 * @property {string} summary  One line fit for display, e.g. "Logged 2 rotis — 240 cal".
 */

/**
 * @typedef {object} ChatMessage
 * @property {number} id
 * @property {'user'|'assistant'} role
 * @property {string | null} content
 * @property {ToolCall[] | null} toolCalls
 * @property {string} createdAt
 */

/**
 * Sends a message and waits for the assistant's reply.
 *
 * The request covers a full tool-calling loop on the server, so it can take
 * several seconds — the caller should show a pending state rather than assume
 * an instant response.
 *
 * @param {string} message
 * @returns {Promise<{ messageId: number, reply: string, toolCalls: ToolCall[], createdAt: string }>}
 * @throws {import('./client.js').ApiError} 503 when no AI key is configured,
 *   504 on timeout, 429 when rate limited — each with a usable message.
 */
export function sendMessage(message) {
  return request('/chat', { method: 'POST', body: { message } });
}

/**
 * Paginated conversation history, newest first.
 *
 * @param {{ page?: number, limit?: number }} [pagination]
 * @returns {Promise<{ data: ChatMessage[], pagination: { page: number, limit: number, total: number, hasNext: boolean } }>}
 */
export function getChatHistory(pagination = {}) {
  return request('/chat/history', { query: pagination });
}
