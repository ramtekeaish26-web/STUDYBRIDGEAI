import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Lightbulb,
  Loader2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { useStudy } from '../context/StudyContext';
import { LearningLevel, SimplifiedLesson } from '../types/study';
import { postJson } from '../utils/apiClient';
import { extractTextFromFile } from '../utils/fileExtract';
import { downloadLessonAsPdf } from '../utils/pdfExport';
import { createUniqueId } from '../utils/studyState';
import { sanitizeCitations } from '../utils/urlSafety';

const LEVELS: LearningLevel[] = ['Beginner', 'Intermediate', 'Advanced'];
const LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Hindi',
  'Japanese',
  'Portuguese',
];

const SUGGESTED_TOPICS = [
  'CRISPR Gene Editing',
  'Fourier Transform Intuition',
  'Federal Reserve Monetary Policy',
  'Thermodynamics Entropy',
];

export function ConceptSimplifierView() {
  const {
    lessons,
    activeLessonId,
    setActiveLessonId,
    ephemeralLesson,
    simplifierDraftTopic,
    setSimplifierDraftTopic,
    settings,
    addLesson,
    navigateToQuiz,
  } = useStudy();

  const [topic, setTopic] = useState<string>(simplifierDraftTopic || '');
  const [level, setLevel] = useState<LearningLevel>(settings.defaultLevel);
  const [language, setLanguage] = useState<string>(settings.defaultLanguage);
  const [notes, setNotes] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [useSearchGrounding, setUseSearchGrounding] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [downloadedPdf, setDownloadedPdf] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setLevel(settings.defaultLevel);
  }, [settings.defaultLevel]);

  useEffect(() => {
    setLanguage(settings.defaultLanguage);
  }, [settings.defaultLanguage]);

  useEffect(() => {
    if (simplifierDraftTopic) {
      setTopic(simplifierDraftTopic);
    }
  }, [simplifierDraftTopic]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const currentLesson =
    (ephemeralLesson && ephemeralLesson.id === activeLessonId ? ephemeralLesson : null) ??
    lessons.find((l) => l.id === activeLessonId) ??
    lessons[0] ??
    null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const result = await extractTextFromFile(file);
    if (result.error) {
      setError(result.error);
      setUploadedFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadedFileName(file.name);
    setNotes(result.text);
    if (!topic.trim()) {
      setTopic(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() && !notes.trim()) {
      setError('Enter a concept topic or attach study notes before generating.');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const data = await postJson<{ lesson: Partial<SimplifiedLesson> }>(
        '/api/simplify',
        {
          topic: topic.trim(),
          level,
          language,
          notes: notes.trim(),
          useSearchGrounding,
        },
        { signal: controller.signal }
      );

      const payload = data.lesson || {};
      const newLesson: SimplifiedLesson = {
        id: createUniqueId('lesson'),
        topic: topic.trim() || payload.title || 'Structured Lesson',
        title: payload.title || topic.trim() || 'Structured Lesson',
        subject: payload.subject || 'General Study',
        level,
        language,
        readMinutes: Number(payload.readMinutes) || 5,
        summary: payload.summary || '',
        definition: payload.definition || '',
        coreMechanism: Array.isArray(payload.coreMechanism) ? payload.coreMechanism : [],
        examples: Array.isArray(payload.examples) ? payload.examples : [],
        analogies: Array.isArray(payload.analogies) ? payload.analogies : [],
        keyTakeaways: Array.isArray(payload.keyTakeaways) ? payload.keyTakeaways : [],
        groundedSources: sanitizeCitations(payload.groundedSources),
        sourceNoteName: uploadedFileName || undefined,
        createdAt: new Date().toISOString(),
        isAiGenerated: true,
      };

      addLesson(newLesson);
      setSimplifierDraftTopic('');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unable to generate lesson right now.');
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-2xl font-semibold text-[#1e2436]">Concept Simplifier</h1>
        <p className="mt-1 text-sm text-[#5a6378]">
          Transform complex topics, PDFs, or lecture notes into structured lessons tailored to your level.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left Control Deck */}
        <section className="neu-raised p-6 xl:col-span-5">
          <form onSubmit={handleGenerate} className="space-y-5">
            <div>
              <label
                htmlFor="concept-topic"
                className="block text-xs font-semibold text-[#3d4558]"
              >
                Concept or Topic
              </label>
              <input
                id="concept-topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Quantum Tunneling, Keynesian Multiplier..."
                className="neu-input mt-2 w-full px-4 py-3 text-sm"
              />
              <div className="mt-2.5 flex flex-wrap gap-2">
                {SUGGESTED_TOPICS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTopic(item)}
                    className="neu-btn px-3 py-1.5 text-xs text-[#3d4558] whitespace-nowrap"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* PDF & Notes Upload */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#3d4558]">
                  PDF or Study Notes (Optional)
                </span>
                {uploadedFileName && (
                  <button
                    type="button"
                    onClick={() => {
                      setUploadedFileName('');
                      setNotes('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="flex items-center gap-1 text-xs text-[#b91c1c] hover:underline"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Clear file</span>
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="notes-file-upload"
              />

              <label
                htmlFor="notes-file-upload"
                className="neu-btn mt-2 flex cursor-pointer items-center justify-between px-4 py-3 text-sm text-[#3d4558]"
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Upload className="h-4 w-4 shrink-0 text-[#6366f1]" />
                  <span className="truncate">
                    {uploadedFileName || 'Upload PDF, Markdown, or TXT notes'}
                  </span>
                </span>
                <span className="text-xs font-semibold text-[#6366f1] whitespace-nowrap">
                  Browse
                </span>
              </label>

              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Or paste lecture notes / textbook excerpts here to simplify..."
                className="neu-input mt-3 w-full resize-y px-4 py-3 text-sm"
              />
            </div>

            {/* Learning Level Segmented Selector */}
            <div>
              <span className="block text-xs font-semibold text-[#3d4558]">
                Learning Level
              </span>
              <div className="mt-2 grid grid-cols-3 gap-2.5">
                {LEVELS.map((lvl) => {
                  const active = level === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setLevel(lvl)}
                      className={`min-h-[42px] px-3 py-2 text-xs font-semibold whitespace-nowrap ${
                        active
                          ? 'neu-btn-active text-[#6366f1]'
                          : 'neu-btn text-[#3d4558]'
                      }`}
                    >
                      {lvl}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Language Selector */}
            <div>
              <label
                htmlFor="simplifier-language"
                className="block text-xs font-semibold text-[#3d4558]"
              >
                Explanation Language
              </label>
              <select
                id="simplifier-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="neu-input mt-2 w-full px-4 py-3 text-sm"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>

            <label className="neu-inset-sm flex cursor-pointer items-center justify-between gap-3 p-3.5">
              <div>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#1e2436]">
                  <Globe className="h-3.5 w-3.5 text-[#6366f1]" />
                  <span>Include Live Google Search Data</span>
                </span>
                <span className="mt-0.5 block text-[11px] text-[#5a6378]">
                  Enriches lesson with current web facts and citations.
                </span>
              </div>
              <input
                type="checkbox"
                checked={useSearchGrounding}
                onChange={(e) => setUseSearchGrounding(e.target.checked)}
                className="h-5 w-5 shrink-0 accent-[#6366f1]"
              />
            </label>

            {error && (
              <div
                role="alert"
                className="neu-inset-sm flex items-start gap-2.5 p-3.5 text-xs text-[#b91c1c]"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="neu-btn flex min-h-[46px] w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-[#6366f1] disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generating Structured Lesson...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Generate Explanation</span>
                </>
              )}
            </button>
          </form>

          {/* Saved Lesson Library Switcher */}
          <div className="mt-7 border-t border-[#d4d8e2] pt-5">
            <h2 className="text-xs font-semibold text-[#5a6378]">
              Saved & Sample Lessons ({lessons.length})
            </h2>
            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
              {lessons.map((item) => {
                const selected = currentLesson?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveLessonId(item.id)}
                    className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs ${
                      selected
                        ? 'neu-btn-active font-semibold text-[#6366f1]'
                        : 'neu-btn text-[#3d4558]'
                    }`}
                  >
                    <span className="truncate">{item.topic}</span>
                    <span className="shrink-0 text-[11px] text-[#5a6378]">
                      {item.level}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right Structured Lesson Stage */}
        <section className="neu-raised p-6 sm:p-7 xl:col-span-7">
          {loading ? (
            <div className="space-y-5 animate-pulse" aria-busy="true">
              <div className="h-5 w-40 rounded-lg bg-[#d8dce6]" />
              <div className="h-8 w-3/4 rounded-lg bg-[#d8dce6]" />
              <div className="h-24 w-full rounded-xl bg-[#d8dce6]" />
              <div className="h-36 w-full rounded-xl bg-[#d8dce6]" />
            </div>
          ) : currentLesson ? (
            <article className="space-y-6">
              <div className="flex flex-col gap-4 border-b border-[#d4d8e2] pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs text-[#5a6378]">
                    <span>{currentLesson.subject}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{currentLesson.level}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{currentLesson.language}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{currentLesson.readMinutes} min read</span>
                    {currentLesson.sourceNoteName && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span>Source: {currentLesson.sourceNoteName}</span>
                      </>
                    )}
                  </p>
                  <h2 className="mt-1.5 text-xl sm:text-2xl font-semibold text-[#1e2436]">
                    {currentLesson.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[#3d4558]">
                    {currentLesson.summary}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      downloadLessonAsPdf(currentLesson);
                      setDownloadedPdf(true);
                      window.setTimeout(() => setDownloadedPdf(false), 2200);
                    }}
                    className="neu-btn flex min-h-[42px] items-center gap-2 px-4 py-2 text-xs font-semibold text-[#6366f1] whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{downloadedPdf ? 'PDF Saved' : 'Download as PDF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateToQuiz(currentLesson.topic)}
                    className="neu-btn flex min-h-[42px] items-center gap-2 px-4 py-2 text-xs font-semibold text-[#7c3aed] whitespace-nowrap"
                  >
                    <span>Quiz This Topic</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Definition */}
              <div className="neu-inset p-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#6366f1]">
                  <BookOpen className="h-4 w-4" />
                  <span>Clear Definition</span>
                </div>
                <p className="mt-2 text-[15px] leading-relaxed text-[#1e2436]">
                  {currentLesson.definition}
                </p>
              </div>

              {/* Core Mechanism */}
              <div>
                <h3 className="text-sm font-semibold text-[#1e2436]">
                  How It Works Step by Step
                </h3>
                <ol className="mt-3 space-y-2.5">
                  {currentLesson.coreMechanism.map((step, index) => (
                    <li
                      key={index}
                      className="neu-inset-sm flex items-start gap-3 p-3.5 text-sm leading-relaxed text-[#3d4558]"
                    >
                      <span className="font-mono-tabular mt-0.5 text-xs font-semibold text-[#6366f1]">
                        0{index + 1}.
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Examples & Analogies */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="neu-inset p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#6366f1]">
                    <FileText className="h-4 w-4" />
                    <span>Real-World Examples</span>
                  </div>
                  <div className="mt-3 space-y-3.5">
                    {currentLesson.examples.map((ex, idx) => (
                      <div key={idx}>
                        <p className="text-sm font-semibold text-[#1e2436]">
                          {ex.title}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-[#5a6378]">
                          {ex.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="neu-inset p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#7c3aed]">
                    <Lightbulb className="h-4 w-4" />
                    <span>Intuitive Analogies</span>
                  </div>
                  <div className="mt-3 space-y-3.5">
                    {currentLesson.analogies.map((an, idx) => (
                      <div key={idx}>
                        <p className="text-sm font-semibold text-[#1e2436]">
                          {an.concept}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-[#5a6378]">
                          {an.comparison}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Key Takeaways */}
              <div className="neu-inset p-5">
                <h3 className="text-xs font-semibold text-[#047857]">
                  Key Takeaways to Remember
                </h3>
                <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {currentLesson.keyTakeaways.map((takeaway, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-xs leading-relaxed text-[#3d4558]"
                    >
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#059669]" />
                      <span>{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {(() => {
                const safeSources = sanitizeCitations(currentLesson.groundedSources);
                if (safeSources.length === 0) return null;
                return (
                  <div className="neu-inset p-5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#6366f1]">
                      <Globe className="h-4 w-4" />
                      <span>Grounded Web Sources</span>
                    </div>
                    <ul className="mt-3 space-y-1.5">
                      {safeSources.map((src, idx) => (
                        <li key={`${src.uri}-${idx}`}>
                          <a
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6366f1] hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            <span>{src.title}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            </article>
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
              <BookOpen className="h-8 w-8 text-[#6366f1]" />
              <h2 className="mt-3 text-lg font-semibold text-[#1e2436]">
                No Lesson Selected
              </h2>
              <p className="mt-1 max-w-sm text-sm text-[#5a6378]">
                Enter any topic or upload study notes on the left to generate a structured explanation.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
