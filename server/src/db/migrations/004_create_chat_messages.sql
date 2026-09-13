-- Conversation history for the chat interface.
--
-- tool_calls stores what the model asked for and what the tool returned, so a
-- reloaded conversation can re-render its inline result cards ("Logged 2 rotis
-- — 240 cal") instead of losing them on refresh.

CREATE TABLE IF NOT EXISTS chat_messages (
  id         serial PRIMARY KEY,
  user_id    int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       text NOT NULL,
  content    text,
  tool_calls jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chat_messages_role_valid CHECK (role IN ('user', 'assistant')),
  -- A message carries text, tool calls, or both — but never neither.
  CONSTRAINT chat_messages_has_payload CHECK (content IS NOT NULL OR tool_calls IS NOT NULL)
);

-- Chat history is paginated newest-first, like every other list endpoint.
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created_at
  ON chat_messages (user_id, created_at DESC);
