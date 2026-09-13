import { query } from '../../db/pool.js';

/** Columns every read returns, in one place so the shapes cannot drift apart. */
const MESSAGE_COLUMNS = 'id, user_id, role, content, tool_calls, created_at';

/**
 * Maps a chat_messages row to the API shape.
 *
 * @param {Record<string, unknown>} row
 * @returns {{ id: number, role: string, content: string | null, toolCalls: unknown[] | null, createdAt: Date }}
 */
function toMessage(row) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    toolCalls: row.tool_calls,
    createdAt: row.created_at,
  };
}

/**
 * Appends a message to a user's conversation.
 *
 * @param {number} userId
 * @param {{ role: 'user' | 'assistant', content?: string | null, toolCalls?: unknown[] | null }} message
 * @param {{ query: Function }} [client]  Optional transaction client.
 * @returns {Promise<ReturnType<typeof toMessage>>}
 */
export async function insertMessage(userId, { role, content, toolCalls }, client) {
  const { rows } = await query(
    `INSERT INTO chat_messages (user_id, role, content, tool_calls)
     VALUES ($1, $2, $3, $4)
     RETURNING ${MESSAGE_COLUMNS}`,
    [userId, role, content ?? null, toolCalls ? JSON.stringify(toolCalls) : null],
    client,
  );

  return toMessage(rows[0]);
}

/**
 * One page of a user's conversation, newest first.
 *
 * @param {number} userId
 * @param {{ limit: number, offset: number }} pagination
 * @returns {Promise<ReturnType<typeof toMessage>[]>}
 */
export async function listMessages(userId, { limit, offset }) {
  const { rows } = await query(
    `SELECT ${MESSAGE_COLUMNS}
       FROM chat_messages
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );

  return rows.map(toMessage);
}

/**
 * Total messages, for the pagination envelope.
 *
 * @param {number} userId
 * @returns {Promise<number>}
 */
export async function countMessages(userId) {
  const { rows } = await query('SELECT COUNT(*) AS total FROM chat_messages WHERE user_id = $1', [
    userId,
  ]);

  return rows[0].total;
}

/**
 * The most recent messages in chronological order, for rebuilding conversation
 * context before a model call.
 *
 * Fetched newest-first with a LIMIT (so the index does the work and old
 * conversations are not read at all), then reversed — the model needs them
 * oldest-first.
 *
 * @param {number} userId
 * @param {number} limit
 * @returns {Promise<ReturnType<typeof toMessage>[]>}
 */
export async function listRecentForContext(userId, limit) {
  const { rows } = await query(
    `SELECT ${MESSAGE_COLUMNS}
       FROM chat_messages
      WHERE user_id = $1
        AND content IS NOT NULL
      ORDER BY created_at DESC, id DESC
      LIMIT $2`,
    [userId, limit],
  );

  return rows.map(toMessage).reverse();
}
