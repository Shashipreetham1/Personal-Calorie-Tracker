import { useEffect, useRef, useState } from 'react';
import { sendMessage, getChatHistory } from '../api/chat.js';
import { EmptyState, ErrorState } from '../components/States.jsx';
import { Alert } from '../components/Alert.jsx';
import { AlertIcon, CheckIcon } from '../components/icons.jsx';
import { formatTime, toPlainText } from '../lib/format.js';

const PAGE_SIZE = 30;

/**
 * Openers that show what the assistant can actually do, rather than a blank box.
 *
 * Three, one per capability — log, report, set a goal. A longer list reads as a
 * menu and stops feeling like conversation.
 */
const SUGGESTIONS = [
  'I had 2 rotis and a bowl of dal for lunch',
  'How am I doing against my goal today?',
  'Set my daily goal to 2000 calories with 150g protein',
];

/**
 * One tool call, as a small card.
 *
 * The assistant's actions are shown as plain sentences the server already
 * produced — "Logged 1 bowl Poha — 270 cal" — never as raw JSON. A user reading
 * their food diary should not have to parse an object to see what was saved.
 */
function ToolCallCard({ call }) {
  return (
    <div className={call.ok ? 'tool-call' : 'tool-call tool-call-failed'}>
      <span className="tool-call-icon">{call.ok ? <CheckIcon size={13} /> : <AlertIcon size={13} />}</span>
      <span className="tool-call-text">{withMonoNumbers(call.summary)}</span>
    </div>
  );
}

/**
 * Sets the numbers in a receipt in the monospace face.
 *
 * "Logged 1 bowl Poha — 270 cal" is a sentence with data in it; the figures
 * should read as figures, and tabular numerals keep a column of receipts aligned.
 */
function withMonoNumbers(summary) {
  return String(summary ?? '')
    .split(/(\d[\d.,]*)/)
    .map((part, index) =>
      /^\d/.test(part) ? (
        <span className="tool-figure" key={index}>
          {part}
        </span>
      ) : (
        part
      ),
    );
}

/** One turn in the conversation. */
function Message({ message }) {
  const mine = message.role === 'user';

  return (
    <li className={mine ? 'message message-user' : 'message message-assistant'}>
      <div className="message-bubble">
        {message.content && <p className="message-text">{toPlainText(message.content)}</p>}

        {message.toolCalls?.length > 0 && (
          <div className="tool-calls">
            {message.toolCalls.map((call, index) => (
              <ToolCallCard key={`${call.name}-${index}`} call={call} />
            ))}
          </div>
        )}
      </div>
      <time className="message-time muted" dateTime={message.createdAt}>
        {formatTime(message.createdAt)}
      </time>
    </li>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  const listRef = useRef(null);
  const inputRef = useRef(null);

  /**
   * Loads a page of history.
   *
   * The API returns newest first (consistent with every other list endpoint),
   * but a conversation reads oldest first, so each page is reversed and
   * prepended.
   */
  async function loadHistory(page = 1) {
    try {
      const result = await getChatHistory({ page, limit: PAGE_SIZE });
      const ordered = [...result.data].reverse();

      setMessages((current) => (page === 1 ? ordered : [...ordered, ...current]));
      setPagination(result.pagination);
      setHistoryError(null);
    } catch (error) {
      setHistoryError(error);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    loadHistory(1);
  }, []);

  // Follow the conversation as it grows, but only for new turns — not when
  // older messages are prepended, which would yank the reader away from what
  // they just asked to see.
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length && messages.at(-1)?.id, sending]);

  async function handleSubmit(event) {
    event.preventDefault();

    const text = draft.trim();
    if (!text || sending) return;

    setSendError(null);
    setSending(true);
    setDraft('');

    // Show the user's own message immediately. Waiting for the round trip to
    // echo it back makes the app feel broken for the seconds the tool loop runs.
    const pendingId = `pending-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id: pendingId, role: 'user', content: text, toolCalls: null, createdAt: new Date().toISOString() },
    ]);

    try {
      const reply = await sendMessage(text);

      setMessages((current) => [
        ...current,
        {
          id: reply.messageId,
          role: 'assistant',
          content: reply.reply,
          toolCalls: reply.toolCalls,
          createdAt: reply.createdAt,
        },
      ]);
    } catch (error) {
      // The message never reached the assistant, so take it back off the
      // transcript and put the text back in the box for another try.
      setMessages((current) => current.filter((message) => message.id !== pendingId));
      setDraft(text);
      setSendError(error.message);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function useSuggestion(suggestion) {
    setDraft(suggestion);
    inputRef.current?.focus();
  }

  return (
    <section className="page">
      <div className="page-head">
        <h1 className="page-title">Chat</h1>
        <p className="section-note">
          Log meals, check progress and set goals in plain language.
        </p>
      </div>

      <div className="card chat-card">
        <div className="chat-messages" ref={listRef}>
          {loadingHistory && (
            <div aria-busy="true" aria-label="Loading your conversation">
              {Array.from({ length: 3 }, (_, index) => (
                <div className="skeleton skeleton-row" key={index} style={{ height: 44 }} />
              ))}
            </div>
          )}

          {!loadingHistory && historyError && (
            <ErrorState error={historyError} onRetry={() => loadHistory(1)} />
          )}

          {!loadingHistory && !historyError && messages.length === 0 && (
            <EmptyState
              title="Nothing here yet"
              description="Ask a question or tell the assistant what you ate. Try one of these:"
              action={
                <div className="suggestions">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="button button-secondary suggestion"
                      onClick={() => useSuggestion(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              }
            />
          )}

          {messages.length > 0 && (
            <>
              {pagination?.hasNext && (
                <button
                  type="button"
                  className="button button-ghost load-earlier"
                  onClick={() => loadHistory(pagination.page + 1)}
                >
                  Load earlier messages
                </button>
              )}

              <ul className="message-list">
                {messages.map((message) => (
                  <Message key={message.id} message={message} />
                ))}

                {sending && (
                  <li className="message message-assistant">
                    <div className="message-bubble message-pending" role="status">
                      <span className="typing" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                      <span className="visually-hidden">Thinking…</span>
                    </div>
                  </li>
                )}
              </ul>
            </>
          )}
        </div>

        <form className="chat-composer" onSubmit={handleSubmit}>
          <label className="visually-hidden" htmlFor="chat-input">
            Message
          </label>
          <input
            id="chat-input"
            ref={inputRef}
            className="input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Tell me what you ate, or ask about your day…"
            maxLength={2000}
            autoComplete="off"
            disabled={sending}
          />
          <button type="submit" className="button button-primary" disabled={!draft.trim() || sending}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>

        {sendError && (
          <div className="chat-error">
            <Alert tone="error">{sendError}</Alert>
          </div>
        )}
      </div>
    </section>
  );
}
