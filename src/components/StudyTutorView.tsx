import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ExternalLink,
  Globe,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
} from 'lucide-react';
import { useStudy } from '../context/StudyContext';
import { TUTOR_MODELS, TUTOR_ROLES } from '../data/sampleData';
import { TutorMessage, TutorModelId, TutorRoleId } from '../types/study';
import { postJson } from '../utils/apiClient';
import { createUniqueId } from '../utils/studyState';
import { sanitizeCitations } from '../utils/urlSafety';

const STARTER_PROMPTS = [
  'Walk me through why ATP yield differs between aerobic and anaerobic respiration.',
  'Search recent Nobel Prize discoveries in physics or chemistry and explain one simply.',
  'Quiz me step-by-step on supply curve shifts vs. movement along demand.',
  'Derive the relationship between projectile peak height and surface gravity.',
];

export function StudyTutorView() {
  const {
    tutorThreads,
    activeTutorThreadId,
    setActiveTutorThreadId,
    createTutorThread,
    updateTutorThreadConfig,
    appendTutorTurn,
    masteryRecords,
  } = useStudy();

  const activeThread =
    tutorThreads.find((t) => t.id === activeTutorThreadId) ?? tutorThreads[0];

  const [input, setInput] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages.length, sending]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const handleRoleChange = (roleId: TutorRoleId) => {
    if (!activeThread) return;
    const roleMeta = TUTOR_ROLES.find((r) => r.id === roleId);
    updateTutorThreadConfig(activeThread.id, {
      roleId,
      modelId: activeThread.useSearchGrounding
        ? 'gemini-4-hydrogen'
        : roleMeta?.defaultModel ?? activeThread.modelId,
    });
  };

  const handleModelChange = (modelId: TutorModelId) => {
    if (!activeThread) return;
    updateTutorThreadConfig(activeThread.id, {
      modelId,
      useSearchGrounding:
        modelId === 'gemini-4-hydrogen' ? activeThread.useSearchGrounding : false,
    });
  };

  const handleToggleSearchGrounding = (enabled: boolean) => {
    if (!activeThread) return;
    updateTutorThreadConfig(activeThread.id, {
      useSearchGrounding: enabled,
      modelId: enabled ? 'gemini-4-hydrogen' : activeThread.modelId,
    });
  };

  const sendMessage = async (textOverride?: string) => {
    if (!activeThread || sending) return;
    const promptText = (textOverride ?? input).trim();
    if (!promptText) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSending(true);
    setError(null);
    if (!textOverride) setInput('');

    const userMsg: TutorMessage = {
      id: createUniqueId('tm-u'),
      role: 'user',
      text: promptText,
      createdAt: new Date().toISOString(),
    };

    const historyForApi = [...activeThread.messages, userMsg].map((m) => ({
      role: m.role,
      text: m.text,
    }));

    const weakTopicsSummary = masteryRecords
      .filter((m) => m.latestScorePercent !== null && m.latestScorePercent < 70)
      .map((m) => `${m.topic} (${m.latestScorePercent}%)`)
      .join(', ');

    try {
      const data = await postJson<{
        reply: string;
        modelUsed?: TutorModelId;
        citations?: unknown;
      }>(
        '/api/tutor',
        {
          messages: historyForApi,
          roleId: activeThread.roleId,
          modelId: activeThread.modelId,
          useSearchGrounding: activeThread.useSearchGrounding,
          learnerContext: weakTopicsSummary
            ? `Student needs extra clarity on: ${weakTopicsSummary}.`
            : undefined,
        },
        { signal: controller.signal }
      );

      const assistantMsg: TutorMessage = {
        id: createUniqueId('tm-m'),
        role: 'model',
        text: data.reply,
        modelId: data.modelUsed,
        citations: sanitizeCitations(data.citations),
        createdAt: new Date().toISOString(),
      };

      appendTutorTurn(activeThread.id, userMsg, assistantMsg);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Study Tutor request failed.');
      if (!textOverride) setInput(promptText);
    } finally {
      if (abortRef.current === controller) {
        setSending(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const currentRole = TUTOR_ROLES.find((r) => r.id === activeThread?.roleId) ?? TUTOR_ROLES[0];
  const currentModel = TUTOR_MODELS.find((m) => m.id === activeThread?.modelId) ?? TUTOR_MODELS[0];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1e2436]">Study Tutor</h1>
          <p className="mt-1 text-sm text-[#5a6378]">
            Multi-turn Gemini coaching with specialized roles, reasoning tiers, and live Google Search grounding.
          </p>
        </div>
        <button
          type="button"
          onClick={() => createTutorThread(activeThread?.roleId, activeThread?.modelId)}
          className="neu-btn flex min-h-[42px] items-center gap-2 px-4 py-2 text-xs font-semibold text-[#6366f1] whitespace-nowrap self-start sm:self-auto"
        >
          <MessageSquarePlus className="h-4 w-4" />
          <span>New Conversation</span>
        </button>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left Controls: Tutor Role, Model Tier, Search Grounding, Thread History */}
        <aside className="neu-raised p-5 space-y-5 xl:col-span-4">
          {/* Tutor Role Selector */}
          <div>
            <span className="block text-xs font-semibold text-[#3d4558]">
              Tutor Persona & Instruction
            </span>
            <div className="mt-2.5 grid grid-cols-1 gap-2">
              {TUTOR_ROLES.map((role) => {
                const selected = activeThread?.roleId === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => handleRoleChange(role.id)}
                    className={`p-3 text-left ${
                      selected ? 'neu-btn-active' : 'neu-btn'
                    }`}
                  >
                    <p
                      className={`text-xs font-semibold ${
                        selected ? 'text-[#6366f1]' : 'text-[#1e2436]'
                      }`}
                    >
                      {role.label}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-[#5a6378]">
                      {role.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model Tier Selector */}
          <div>
            <label
              htmlFor="tutor-model-select"
              className="block text-xs font-semibold text-[#3d4558]"
            >
              Gemini Reasoning Model
            </label>
            <select
              id="tutor-model-select"
              value={activeThread?.modelId || 'gemini-4-hydrogen'}
              onChange={(e) => handleModelChange(e.target.value as TutorModelId)}
              className="neu-input mt-2 w-full px-3.5 py-2.5 text-xs font-semibold text-[#1e2436]"
            >
              {TUTOR_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.badge}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] text-[#5a6378]">
              {currentModel.description}
            </p>
          </div>

          {/* Google Search Grounding Toggle */}
          <label className="neu-inset-sm flex cursor-pointer items-center justify-between gap-3 p-3.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1e2436]">
                <Globe className="h-3.5 w-3.5 text-[#6366f1]" />
                <span>Use Google Search Data</span>
              </div>
              <p className="mt-0.5 text-[11px] text-[#5a6378]">
                Grounds answers via gemini-4-hydrogen with live web citations.
              </p>
            </div>
            <input
              type="checkbox"
              checked={Boolean(activeThread?.useSearchGrounding)}
              onChange={(e) => handleToggleSearchGrounding(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-[#6366f1]"
            />
          </label>

          {/* Saved Conversation History */}
          <div className="border-t border-[#d4d8e2] pt-4">
            <h2 className="text-xs font-semibold text-[#5a6378]">
              Conversation History ({tutorThreads.length})
            </h2>
            <div className="mt-2.5 max-h-48 space-y-2 overflow-y-auto pr-1">
              {tutorThreads.map((thread) => {
                const isSelected = thread.id === activeThread?.id;
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setActiveTutorThreadId(thread.id)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs ${
                      isSelected
                        ? 'neu-btn-active font-semibold text-[#6366f1]'
                        : 'neu-btn text-[#3d4558]'
                    }`}
                  >
                    <span className="truncate">{thread.title}</span>
                    <span className="font-mono-tabular shrink-0 text-[11px] text-[#5a6378]">
                      {thread.messages.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Right Scrollable Multi-Turn Conversation Area */}
        <section className="neu-raised flex h-[680px] flex-col p-5 sm:p-6 xl:col-span-8">
          {/* Active Session Metadata Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d4d8e2] pb-3.5 text-xs text-[#5a6378]">
            <span>
              Role: <strong className="font-semibold text-[#1e2436]">{currentRole.label}</strong>
              <span aria-hidden="true"> · </span>
              Model:{' '}
              <strong className="font-mono-tabular font-semibold text-[#6366f1]">
                {activeThread?.useSearchGrounding ? 'gemini-4-hydrogen' : currentModel.id}
              </strong>
            </span>
            <span>
              {activeThread?.useSearchGrounding
                ? 'Google Search Grounding Active'
                : 'Standard Knowledge Mode'}
            </span>
          </div>

          {/* Scrollable Message Thread */}
          <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-2">
            {activeThread && activeThread.messages.length > 0 ? (
              activeThread.messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[88%] p-4 text-sm leading-relaxed ${
                        isUser
                          ? 'neu-inset text-[#1e2436]'
                          : 'neu-raised-sm text-[#1e2436]'
                      }`}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-4 text-[11px] text-[#5a6378]">
                        <span className="font-semibold text-[#6366f1]">
                          {isUser ? 'You' : currentRole.label}
                        </span>
                        {!isUser && msg.modelId && (
                          <span className="font-mono-tabular">{msg.modelId}</span>
                        )}
                      </div>
                      <div className="whitespace-pre-wrap">{msg.text}</div>

                      {(() => {
                        const safeCites = sanitizeCitations(msg.citations);
                        if (safeCites.length === 0) return null;
                        return (
                          <div className="mt-3 border-t border-[#d5d9e3] pt-2.5">
                            <p className="text-[11px] font-semibold text-[#5a6378]">
                              Grounded Web Sources
                            </p>
                            <ul className="mt-1.5 space-y-1">
                              {safeCites.map((cite, idx) => (
                                <li key={`${cite.uri}-${idx}`}>
                                  <a
                                    href={cite.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs font-medium text-[#6366f1] hover:underline"
                                  >
                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                    <span className="truncate max-w-[360px]">
                                      {cite.title}
                                    </span>
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center px-4">
                <Sparkles className="h-8 w-8 text-[#6366f1]" />
                <h2 className="mt-3 text-lg font-semibold text-[#1e2436]">
                  Start a Guided Study Conversation
                </h2>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-[#5a6378]">
                  Ask a question, test an idea, or toggle Google Search data for current facts and references.
                </p>
                <div className="mt-5 grid w-full max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="neu-btn p-3 text-left text-xs leading-relaxed text-[#3d4558]"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sending && (
              <div role="status" aria-live="polite" className="flex justify-start">
                <div className="neu-raised-sm flex items-center gap-2.5 px-4 py-3 text-xs text-[#5a6378]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#6366f1]" />
                  <span>Thinking with {activeThread?.useSearchGrounding ? 'Google Search + Gemini 4 Hydrogen' : currentModel.label}...</span>
                </div>
              </div>
            )}
            <div ref={threadEndRef} />
          </div>

          {error && (
            <div
              role="alert"
              className="neu-inset-sm mt-3 flex items-start gap-2 p-3 text-xs text-[#b91c1c]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Composer */}
          <form onSubmit={handleSubmit} className="mt-4 flex items-end gap-3">
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask your Study Tutor a question... (Enter to send, Shift+Enter for new line)"
              className="neu-input flex-1 resize-none px-4 py-3 text-sm"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
              className="neu-btn flex h-[48px] items-center gap-2 px-5 text-sm font-semibold text-[#6366f1] whitespace-nowrap disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span>Send</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
