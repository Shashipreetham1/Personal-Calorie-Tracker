import * as chatService from './chat.service.js';

/**
 * POST /api/chat → 200 with the assistant's reply and what the tools did.
 *
 * `toolCalls` carries a short `summary` per call so the UI can render an inline
 * card ("Logged 2 rotis — 240 cal") instead of raw JSON.
 */
export async function sendMessage(req, res) {
  const { reply, toolCalls, assistantMessage } = await chatService.sendMessage(
    req.user.id,
    req.validated.body.message,
  );

  res.status(200).json({
    messageId: assistantMessage.id,
    reply,
    toolCalls,
    createdAt: assistantMessage.createdAt,
  });
}

/**
 * GET /api/chat/history?page&limit → 200, paginated newest first.
 */
export async function getHistory(req, res) {
  const page = await chatService.getHistory(req.user.id, req.validated.query);
  res.status(200).json(page);
}
