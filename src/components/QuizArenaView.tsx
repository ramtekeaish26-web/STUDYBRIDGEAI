import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Loader2,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useStudy } from '../context/StudyContext';
import { LearningLevel, QuizAttempt, QuizBank, QuizQuestion } from '../types/study';
import {
  calculateMasteryPercentage,
  classifyMastery,
  getClassificationTheme,
} from '../utils/mastery';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export function QuizArenaView() {
  const {
    quizBanks,
    activeQuizTopic,
    setActiveQuizTopic,
    masteryRecords,
    settings,
    saveQuizBank,
    recordQuizCompletion,
    setActiveScreen,
  } = useStudy();

  const availableTopics = Object.keys(quizBanks);
  const [customTopic, setCustomTopic] = useState<string>('');
  const [difficulty, setDifficulty] = useState<LearningLevel>(settings.defaultLevel);
  const [questionCount, setQuestionCount] = useState<number>(5);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({});
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<number, boolean>>({});
  const [quizCompleted, setQuizCompleted] = useState<boolean>(false);
  const [latestAttempt, setLatestAttempt] = useState<QuizAttempt | null>(null);

  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const currentBank: QuizBank | undefined = quizBanks[activeQuizTopic];
  const questions: QuizQuestion[] = currentBank?.questions ?? [];
  const currentQuestion = questions[currentIndex];

  const resetRunner = () => {
    setCurrentIndex(0);
    setSelectedOptions({});
    setSubmittedAnswers({});
    setQuizCompleted(false);
    setLatestAttempt(null);
    setError(null);
  };

  useEffect(() => {
    resetRunner();
  }, [activeQuizTopic]);

  const handleSelectTopic = (topicName: string) => {
    setActiveQuizTopic(topicName);
  };

  const handleGenerateAiQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetTopic = customTopic.trim() || activeQuizTopic;
    if (!targetTopic) {
      setError('Enter a topic name to generate a quiz.');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: targetTopic,
          level: difficulty,
          count: questionCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate quiz.');
      }

      const generatedQuestions: QuizQuestion[] = (data.questions || []).map(
        (
          q: {
            prompt: string;
            options: string[];
            correctIndex: number;
            explanation: string;
          },
          idx: number
        ) => ({
          id: `ai-q-${Date.now()}-${idx}`,
          prompt: q.prompt,
          options: q.options.slice(0, 4),
          correctIndex: Math.min(Math.max(Number(q.correctIndex) || 0, 0), 3),
          explanation: q.explanation,
        })
      );

      if (generatedQuestions.length === 0) {
        throw new Error('The AI service returned zero questions. Please try again.');
      }

      const newBank: QuizBank = {
        topic: targetTopic,
        subject: data.subject || 'AI Generated',
        level: difficulty,
        questions: generatedQuestions,
        isAiGenerated: true,
      };

      saveQuizBank(newBank);
      setActiveQuizTopic(targetTopic);
      setCustomTopic('');
      resetRunner();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate quiz right now.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectOption = (optionIdx: number) => {
    if (submittedAnswers[currentIndex]) return;
    setSelectedOptions((prev) => ({ ...prev, [currentIndex]: optionIdx }));
  };

  const handleSubmitCurrentAnswer = () => {
    if (selectedOptions[currentIndex] === undefined) return;
    setSubmittedAnswers((prev) => ({ ...prev, [currentIndex]: true }));
  };

  const handleFinishQuiz = () => {
    if (!currentBank || questions.length === 0) return;

    let correctCount = 0;
    const strongConcepts: string[] = [];
    const weakConcepts: string[] = [];

    questions.forEach((q, idx) => {
      const chosen = selectedOptions[idx];
      const shortConcept =
        q.prompt.length > 56 ? `${q.prompt.slice(0, 56).trim()}...` : q.prompt;
      if (chosen === q.correctIndex) {
        correctCount += 1;
        strongConcepts.push(shortConcept);
      } else {
        weakConcepts.push(shortConcept);
      }
    });

    const attempt = recordQuizCompletion({
      topic: currentBank.topic,
      subject: currentBank.subject,
      correctCount,
      totalQuestions: questions.length,
      strongConcepts,
      weakConcepts,
    });

    setLatestAttempt(attempt);
    setQuizCompleted(true);
  };

  const answeredCount = Object.keys(submittedAnswers).length;
  const runningCorrectCount = questions.reduce((acc, q, idx) => {
    if (submittedAnswers[idx] && selectedOptions[idx] === q.correctIndex) {
      return acc + 1;
    }
    return acc;
  }, 0);

  const topicRecord = masteryRecords.find(
    (m) => m.topic.toLowerCase() === activeQuizTopic.toLowerCase()
  );

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1e2436]">Quiz Arena</h1>
          <p className="mt-1 text-sm text-[#5a6378]">
            Test your understanding with instant feedback and sync scores directly to your Learning Gap Detector.
          </p>
        </div>
        {currentBank && (
          <div className="neu-inset-sm px-4 py-2 text-xs text-[#3d4558] tabular-nums">
            Active Topic: <span className="font-semibold text-[#6366f1]">{currentBank.topic}</span>
            <span aria-hidden="true"> · </span>
            <span>{questions.length} questions</span>
          </div>
        )}
      </header>

      {/* Topic Picker + AI Quiz Generator */}
      <section className="neu-raised p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <span className="block text-xs font-semibold text-[#3d4558]">
              Select Study Topic Bank
            </span>
            <div className="mt-2.5 flex flex-wrap gap-2.5">
              {availableTopics.map((topicName) => {
                const isActive = topicName === activeQuizTopic;
                return (
                  <button
                    key={topicName}
                    type="button"
                    onClick={() => handleSelectTopic(topicName)}
                    className={`min-h-[40px] px-3.5 py-2 text-xs whitespace-nowrap ${
                      isActive
                        ? 'neu-btn-active font-semibold text-[#6366f1]'
                        : 'neu-btn font-medium text-[#3d4558]'
                    }`}
                  >
                    {topicName}
                  </button>
                );
              })}
            </div>
          </div>

          <form
            onSubmit={handleGenerateAiQuiz}
            className="flex flex-col gap-3 border-t border-[#d4d8e2] pt-5 lg:col-span-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6"
          >
            <span className="text-xs font-semibold text-[#3d4558]">
              Generate Fresh AI Quiz on Any Topic
            </span>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder={`Topic (defaults to ${activeQuizTopic})`}
                className="neu-input flex-1 px-4 py-2.5 text-sm"
              />
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as LearningLevel)}
                aria-label="Quiz difficulty"
                className="neu-input px-3 py-2.5 text-xs font-medium"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                aria-label="Question count"
                className="neu-input px-3 py-2.5 text-xs font-medium tabular-nums"
              >
                <option value={4}>4 Qs</option>
                <option value={5}>5 Qs</option>
                <option value={6}>6 Qs</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={generating}
              className="neu-btn flex min-h-[42px] items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-[#7c3aed] whitespace-nowrap disabled:opacity-60"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generating AI Quiz...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Generate New AI Quiz</span>
                </>
              )}
            </button>
          </form>
        </div>

        {error && (
          <div
            role="alert"
            className="neu-inset-sm mt-4 flex items-start gap-2.5 p-3.5 text-xs text-[#b91c1c]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {/* Main Quiz Stage or Final Summary */}
      {generating ? (
        <section className="neu-raised p-8 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#6366f1]" />
          <p className="mt-3 text-sm font-semibold text-[#1e2436]">
            Crafting fresh multiple-choice questions...
          </p>
        </section>
      ) : !currentBank || questions.length === 0 ? (
        <section className="neu-raised p-10 text-center">
          <HelpCircle className="mx-auto h-8 w-8 text-[#6366f1]" />
          <h2 className="mt-3 text-lg font-semibold text-[#1e2436]">
            No Quiz Loaded for This Topic
          </h2>
          <p className="mt-1 text-sm text-[#5a6378]">
            Select one of the study topic banks above or generate a new AI quiz.
          </p>
        </section>
      ) : quizCompleted && latestAttempt ? (
        /* Final Quiz Summary */
        <section className="neu-raised p-6 sm:p-8 space-y-6">
          {(() => {
            const masteryScore = calculateMasteryPercentage(
              latestAttempt.correctCount,
              latestAttempt.totalQuestions
            );
            const classification = classifyMastery(
              masteryScore,
              latestAttempt.totalQuestions
            );
            const theme = getClassificationTheme(classification);
            const prevScore = topicRecord?.previousScorePercent;
            const delta =
              prevScore !== null && prevScore !== undefined && masteryScore !== null
                ? masteryScore - prevScore
                : null;

            return (
              <>
                <div className="flex flex-col gap-5 border-b border-[#d4d8e2] pb-6 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#6366f1]">
                      Quiz Summary · {currentBank.topic}
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold text-[#1e2436]">
                      You scored {latestAttempt.correctCount} out of{' '}
                      {latestAttempt.totalQuestions} ({latestAttempt.scorePercent}%)
                    </h2>
                    <p className="mt-1.5 text-sm text-[#5a6378]">
                      Updated Mastery Classification:{' '}
                      <span className={`font-semibold ${theme.textColor}`}>
                        {classification}
                      </span>
                      {delta !== null && (
                        <span className="ml-2 font-mono-tabular text-xs text-[#3d4558]">
                          ({delta >= 0 ? `+${delta}%` : `${delta}%`} vs. previous attempt)
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={resetRunner}
                      className="neu-btn flex min-h-[42px] items-center gap-2 px-4 py-2 text-xs font-semibold text-[#3d4558] whitespace-nowrap"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Retake Quiz</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveScreen('gaps')}
                      className="neu-btn flex min-h-[42px] items-center gap-2 px-4 py-2 text-xs font-semibold text-[#6366f1] whitespace-nowrap"
                    >
                      <Activity className="h-3.5 w-3.5" />
                      <span>Open Learning Gap Detector</span>
                    </button>
                  </div>
                </div>

                {/* Question-by-Question Review */}
                <div className="space-y-3.5">
                  <h3 className="text-sm font-semibold text-[#1e2436]">
                    Answer Breakdown & Explanations
                  </h3>
                  {questions.map((q, idx) => {
                    const userChoice = selectedOptions[idx];
                    const isCorrect = userChoice === q.correctIndex;
                    return (
                      <div key={q.id} className="neu-inset p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-[#1e2436]">
                            {idx + 1}. {q.prompt}
                          </p>
                          <span
                            className={`flex shrink-0 items-center gap-1 text-xs font-semibold ${
                              isCorrect ? 'text-[#047857]' : 'text-[#b91c1c]'
                            }`}
                          >
                            {isCorrect ? (
                              <>
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Correct</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4" />
                                <span>Incorrect</span>
                              </>
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-[#3d4558]">
                          Your answer:{' '}
                          <span className="font-semibold">
                            {userChoice !== undefined ? q.options[userChoice] : 'Not answered'}
                          </span>
                          {!isCorrect && (
                            <>
                              {' '}
                              · Correct answer:{' '}
                              <span className="font-semibold text-[#047857]">
                                {q.options[q.correctIndex]}
                              </span>
                            </>
                          )}
                        </p>
                        <p className="text-xs leading-relaxed text-[#5a6378]">
                          {q.explanation}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </section>
      ) : (
        /* Interactive Question Runner */
        <section className="neu-raised p-6 sm:p-7 space-y-6">
          {/* Progress & Question Navigation */}
          <div className="flex flex-col gap-4 border-b border-[#d4d8e2] pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isSubmitted = submittedAnswers[idx];
                const isRight = isSubmitted && selectedOptions[idx] === q.correctIndex;
                const isWrong = isSubmitted && selectedOptions[idx] !== q.correctIndex;

                let tone = 'text-[#3d4558]';
                if (isCurrent) tone = 'text-[#6366f1] font-semibold';
                if (isRight) tone = 'text-[#047857] font-semibold';
                if (isWrong) tone = 'text-[#b91c1c] font-semibold';

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    aria-label={`Question ${idx + 1}`}
                    className={`font-mono-tabular flex h-10 w-10 items-center justify-center text-xs ${
                      isCurrent ? 'neu-btn-active' : 'neu-btn'
                    } ${tone}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="text-xs text-[#5a6378] tabular-nums">
              Question {currentIndex + 1} of {questions.length} · Score so far:{' '}
              <span className="font-mono-tabular font-semibold text-[#1e2436]">
                {runningCorrectCount}/{answeredCount}
              </span>
            </div>
          </div>

          {/* Linear Progress Bar */}
          <div className="h-2.5 w-full overflow-hidden rounded-xl bg-[#dfe2ea] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08)]">
            <div
              className="h-full rounded-xl bg-[#6366f1] transition-all duration-300"
              style={{
                width: `${Math.round(((currentIndex + 1) / questions.length) * 100)}%`,
              }}
            />
          </div>

          {/* Active Question */}
          {currentQuestion && (
            <div className="space-y-5">
              <h2 className="text-lg sm:text-xl font-semibold leading-snug text-[#1e2436]">
                {currentQuestion.prompt}
              </h2>

              <div className="grid grid-cols-1 gap-3.5">
                {currentQuestion.options.map((opt, optIdx) => {
                  const isSelected = selectedOptions[currentIndex] === optIdx;
                  const isSubmitted = Boolean(submittedAnswers[currentIndex]);
                  const isCorrectOpt = currentQuestion.correctIndex === optIdx;

                  let stateClass = isSelected ? 'neu-btn-active' : 'neu-btn';
                  let labelTone = 'text-[#1e2436]';
                  let badgeText: string | null = null;

                  if (isSubmitted) {
                    if (isCorrectOpt) {
                      labelTone = 'text-[#047857]';
                      badgeText = 'Correct';
                    } else if (isSelected && !isCorrectOpt) {
                      labelTone = 'text-[#b91c1c]';
                      badgeText = 'Selected';
                    } else {
                      labelTone = 'text-[#5a6378]';
                    }
                  } else if (isSelected) {
                    labelTone = 'text-[#6366f1]';
                  }

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      disabled={isSubmitted}
                      onClick={() => handleSelectOption(optIdx)}
                      className={`${stateClass} flex min-h-[54px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left`}
                    >
                      <div className="flex items-center gap-3.5">
                        <span
                          className={`font-mono-tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-semibold ${
                            isSelected ? 'neu-raised-sm text-[#6366f1]' : 'neu-inset-sm text-[#5a6378]'
                          }`}
                        >
                          {OPTION_LETTERS[optIdx]}
                        </span>
                        <span className={`text-sm font-medium ${labelTone}`}>{opt}</span>
                      </div>
                      {badgeText && (
                        <span className={`text-xs font-semibold shrink-0 ${labelTone}`}>
                          {badgeText}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Feedback & Explanation */}
              {submittedAnswers[currentIndex] && settings.showInstantFeedback && (
                <div className="neu-inset p-4 sm:p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    {selectedOptions[currentIndex] === currentQuestion.correctIndex ? (
                      <span className="flex items-center gap-1.5 text-[#047857]">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Correct Answer</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[#b91c1c]">
                        <XCircle className="h-4 w-4" />
                        <span>
                          Incorrect · Correct choice is{' '}
                          {OPTION_LETTERS[currentQuestion.correctIndex]}
                        </span>
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[#3d4558]">
                    {currentQuestion.explanation}
                  </p>
                </div>
              )}

              {/* Runner Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  className="neu-btn flex min-h-[42px] items-center gap-2 px-4 py-2 text-xs font-semibold text-[#3d4558] disabled:opacity-45"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </button>

                <div className="flex flex-wrap items-center gap-3">
                  {!submittedAnswers[currentIndex] ? (
                    <button
                      type="button"
                      disabled={selectedOptions[currentIndex] === undefined}
                      onClick={handleSubmitCurrentAnswer}
                      className="neu-btn flex min-h-[44px] items-center gap-2 px-6 py-2.5 text-sm font-semibold text-[#6366f1] disabled:opacity-45"
                    >
                      <span>Submit Answer</span>
                    </button>
                  ) : currentIndex < questions.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentIndex((i) => i + 1)}
                      className="neu-btn flex min-h-[44px] items-center gap-2 px-6 py-2.5 text-sm font-semibold text-[#6366f1]"
                    >
                      <span>Next Question</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={answeredCount < questions.length}
                      onClick={handleFinishQuiz}
                      className="neu-btn flex min-h-[44px] items-center gap-2 px-6 py-2.5 text-sm font-semibold text-[#047857] disabled:opacity-45"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>
                        {answeredCount < questions.length
                          ? `Answer All Questions (${answeredCount}/${questions.length})`
                          : 'Finish & Save Score'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
