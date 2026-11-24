import React from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  HelpCircle,
  Minus,
  RotateCcw,
} from 'lucide-react';
import { useStudy } from '../context/StudyContext';
import {
  calculateMasteryPercentage,
  calculateOverallMastery,
  classifyMastery,
  getClassificationTheme,
  MIN_QUESTIONS_FOR_MASTERY,
} from '../utils/mastery';
import { MasteryRing } from './NeomorphicCharts';

export function LearningGapDetectorView() {
  const { masteryRecords, navigateToQuiz, navigateToSimplifier } = useStudy();

  const overallMastery = calculateOverallMastery(masteryRecords);
  const overallClassification = classifyMastery(
    overallMastery,
    masteryRecords.reduce((sum, r) => sum + r.attemptedQuestions, 0)
  );
  const overallTheme = getClassificationTheme(overallClassification);

  const testedRecords = masteryRecords.filter(
    (r) => r.attemptedQuestions >= MIN_QUESTIONS_FOR_MASTERY
  );
  const untestedRecords = masteryRecords.filter(
    (r) => r.attemptedQuestions < MIN_QUESTIONS_FOR_MASTERY
  );

  const strongTopics = testedRecords.filter((r) => {
    const score = calculateMasteryPercentage(r.correctAnswers, r.attemptedQuestions);
    return score !== null && score >= 70;
  });

  const weakTopics = testedRecords.filter((r) => {
    const score = calculateMasteryPercentage(r.correctAnswers, r.attemptedQuestions);
    return score !== null && score < 70;
  });

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-2xl font-semibold text-[#1e2436]">
          Learning Gap Detector
        </h1>
        <p className="mt-1 text-sm text-[#5a6378]">
          Computed directly from your Quiz Arena accuracy (correct answers ÷ attempted questions × 100).
        </p>
      </header>

      {/* Top Mastery Summary + Classification Rubric */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="neu-raised flex flex-col items-center gap-6 p-6 sm:flex-row xl:col-span-6">
          <MasteryRing
            percentage={overallMastery}
            size={148}
            label="Overall Score"
            accentColor={overallTheme.barColor}
          />
          <div className="space-y-2 text-center sm:text-left">
            <p className="text-xs font-semibold text-[#5a6378]">
              Aggregate Mastery Tier
            </p>
            <h2 className={`text-xl font-semibold ${overallTheme.textColor}`}>
              {overallClassification}
            </h2>
            <p className="text-xs leading-relaxed text-[#5a6378]">
              Based on{' '}
              <span className="font-mono-tabular font-semibold text-[#1e2436]">
                {testedRecords.reduce((s, r) => s + r.correctAnswers, 0)}
              </span>{' '}
              correct answers across{' '}
              <span className="font-mono-tabular font-semibold text-[#1e2436]">
                {testedRecords.reduce((s, r) => s + r.attemptedQuestions, 0)}
              </span>{' '}
              attempted questions in {testedRecords.length} tested topics.
            </p>
          </div>
        </div>

        {/* Mastery Classification Scale & Bucket Counts */}
        <div className="neu-raised p-6 xl:col-span-6">
          <h2 className="text-sm font-semibold text-[#1e2436]">
            Mastery Classification Rubric
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="neu-inset-sm p-3">
              <span className="font-mono-tabular text-xs font-semibold text-[#b91c1c]">
                0–49%
              </span>
              <p className="mt-1 text-xs text-[#3d4558]">Needs Improvement</p>
            </div>
            <div className="neu-inset-sm p-3">
              <span className="font-mono-tabular text-xs font-semibold text-[#b45309]">
                50–69%
              </span>
              <p className="mt-1 text-xs text-[#3d4558]">Developing</p>
            </div>
            <div className="neu-inset-sm p-3">
              <span className="font-mono-tabular text-xs font-semibold text-[#4338ca]">
                70–84%
              </span>
              <p className="mt-1 text-xs text-[#3d4558]">Good Understanding</p>
            </div>
            <div className="neu-inset-sm p-3">
              <span className="font-mono-tabular text-xs font-semibold text-[#047857]">
                85–100%
              </span>
              <p className="mt-1 text-xs text-[#3d4558]">Strong Understanding</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[#5a6378] tabular-nums">
            <span>
              Strong / Good:{' '}
              <strong className="font-semibold text-[#047857]">
                {strongTopics.length}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Needs Focus / Developing:{' '}
              <strong className="font-semibold text-[#b91c1c]">
                {weakTopics.length}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Insufficient Data / Untested:{' '}
              <strong className="font-semibold text-[#3d4558]">
                {untestedRecords.length}
              </strong>
            </span>
          </div>
        </div>
      </section>

      {/* Topic-Wise Mastery Bars & Attempt Comparison */}
      <section className="neu-raised p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-[#1e2436]">
            Topic-Wise Mastery & Attempt Progress
          </h2>
          <span className="text-xs text-[#5a6378]">
            Comparing previous vs. latest quiz scores
          </span>
        </div>

        <div className="mt-5 space-y-4">
          {masteryRecords.map((record) => {
            const pct = calculateMasteryPercentage(
              record.correctAnswers,
              record.attemptedQuestions
            );
            const cls = classifyMastery(pct, record.attemptedQuestions);
            const theme = getClassificationTheme(cls);
            const prev = record.previousScorePercent;
            const delta = pct !== null && prev !== null ? pct - prev : null;

            return (
              <div key={record.topic} className="neu-inset p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h3 className="text-base font-semibold text-[#1e2436]">
                        {record.topic}
                      </h3>
                      <span className="text-xs text-[#5a6378]">
                        {record.subject}
                      </span>
                      <span aria-hidden="true" className="text-xs text-[#5a6378]">
                        ·
                      </span>
                      <span className={`text-xs font-semibold ${theme.textColor}`}>
                        {cls}
                      </span>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="mt-3 flex items-center gap-4">
                      <div className="h-3 flex-1 overflow-hidden rounded-xl bg-[#dfe2ea] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08)]">
                        <div
                          className="h-full rounded-xl transition-all duration-300"
                          style={{
                            width: `${pct ?? 0}%`,
                            backgroundColor: theme.barColor,
                          }}
                        />
                      </div>
                      <span className="font-mono-tabular w-14 text-right text-sm font-semibold text-[#1e2436]">
                        {pct !== null ? `${pct}%` : '—'}
                      </span>
                    </div>

                    {/* Attempt Fraction & Previous vs Latest Comparison */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5a6378] tabular-nums">
                      <span>
                        {record.attemptedQuestions >= MIN_QUESTIONS_FOR_MASTERY
                          ? `${record.correctAnswers} / ${record.attemptedQuestions} correct`
                          : record.attemptedQuestions === 0
                          ? 'Not yet tested (0 questions attempted)'
                          : `Insufficient data (${record.attemptedQuestions} question attempted)`}
                      </span>

                      {prev !== null && pct !== null && (
                        <span className="inline-flex items-center gap-1 font-mono-tabular text-[#3d4558]">
                          <span>Prev: {prev}%</span>
                          <span aria-hidden="true">→</span>
                          <span>Latest: {pct}%</span>
                          {delta !== null && delta > 0 && (
                            <span className="inline-flex items-center font-semibold text-[#047857]">
                              <ArrowUpRight className="h-3.5 w-3.5" />+{delta}%
                            </span>
                          )}
                          {delta !== null && delta < 0 && (
                            <span className="inline-flex items-center font-semibold text-[#b91c1c]">
                              <ArrowDownRight className="h-3.5 w-3.5" />
                              {delta}%
                            </span>
                          )}
                          {delta === 0 && (
                            <span className="inline-flex items-center text-[#5a6378]">
                              <Minus className="h-3 w-3 mr-0.5" />
                              0%
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => navigateToSimplifier(record.topic)}
                      className="neu-btn flex min-h-[40px] items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#3d4558] whitespace-nowrap"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-[#6366f1]" />
                      <span>Review Lesson</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateToQuiz(record.topic)}
                      className="neu-btn flex min-h-[40px] items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#6366f1] whitespace-nowrap"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>
                        {record.attemptedQuestions >= MIN_QUESTIONS_FOR_MASTERY
                          ? 'Retake Quiz'
                          : 'Take Quiz'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Personalized Revision Recommendation */}
                <p className="mt-3 border-t border-[#d5d9e3] pt-3 text-xs leading-relaxed text-[#3d4558]">
                  <strong className="font-semibold text-[#1e2436]">
                    Revision Guidance:
                  </strong>{' '}
                  {record.revisionAdvice}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Strong Concepts, Weak Concepts, and Untested Topics Breakdown */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Strong Concepts */}
        <div className="neu-raised p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#047857]">
            <CheckCircle2 className="h-4 w-4" />
            <span>Strong Concepts</span>
          </div>
          <p className="mt-1 text-xs text-[#5a6378]">
            Areas where your accuracy is consistently reliable
          </p>
          <div className="mt-4 space-y-2.5">
            {testedRecords.flatMap((r) =>
              r.strongConcepts.map((concept, i) => (
                <div key={`${r.topic}-s-${i}`} className="neu-inset-sm p-3">
                  <p className="text-xs font-semibold text-[#1e2436]">{concept}</p>
                  <p className="mt-0.5 text-[11px] text-[#5a6378]">{r.topic}</p>
                </div>
              ))
            ).length > 0 ? (
              testedRecords.flatMap((r) =>
                r.strongConcepts.map((concept, i) => (
                  <div key={`${r.topic}-s-${i}`} className="neu-inset-sm p-3">
                    <p className="text-xs font-semibold text-[#1e2436]">{concept}</p>
                    <p className="mt-0.5 text-[11px] text-[#5a6378]">{r.topic}</p>
                  </div>
                ))
              )
            ) : (
              <p className="text-xs text-[#5a6378]">
                Complete quizzes in Quiz Arena to identify your strongest concepts.
              </p>
            )}
          </div>
        </div>

        {/* Weak Concepts */}
        <div className="neu-raised p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#b91c1c]">
            <AlertTriangle className="h-4 w-4" />
            <span>Weak Concepts</span>
          </div>
          <p className="mt-1 text-xs text-[#5a6378]">
            Missed concepts recommended for targeted revision
          </p>
          <div className="mt-4 space-y-2.5">
            {testedRecords.flatMap((r) =>
              r.weakConcepts.map((concept, i) => (
                <div
                  key={`${r.topic}-w-${i}`}
                  className="neu-inset-sm flex items-center justify-between gap-2 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#1e2436]">{concept}</p>
                    <p className="mt-0.5 text-[11px] text-[#5a6378]">{r.topic}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToQuiz(r.topic)}
                    className="neu-btn px-2.5 py-1.5 text-[11px] font-semibold text-[#6366f1] whitespace-nowrap shrink-0"
                  >
                    Drill
                  </button>
                </div>
              ))
            ).length > 0 ? (
              testedRecords.flatMap((r) =>
                r.weakConcepts.map((concept, i) => (
                  <div
                    key={`${r.topic}-w-${i}`}
                    className="neu-inset-sm flex items-center justify-between gap-2 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#1e2436]">{concept}</p>
                      <p className="mt-0.5 text-[11px] text-[#5a6378]">{r.topic}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateToQuiz(r.topic)}
                      className="neu-btn px-2.5 py-1.5 text-[11px] font-semibold text-[#6366f1] whitespace-nowrap shrink-0"
                    >
                      Drill
                    </button>
                  </div>
                ))
              )
            ) : (
              <p className="text-xs text-[#5a6378]">
                No weak concepts currently flagged across your tested topics.
              </p>
            )}
          </div>
        </div>

        {/* Untested / Insufficient Data Topics */}
        <div className="neu-raised p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#5a6378]">
            <HelpCircle className="h-4 w-4 text-[#6366f1]" />
            <span>Untested & Insufficient Data</span>
          </div>
          <p className="mt-1 text-xs text-[#5a6378]">
            Topics with fewer than {MIN_QUESTIONS_FOR_MASTERY} attempted questions
          </p>
          <div className="mt-4 space-y-2.5">
            {untestedRecords.length > 0 ? (
              untestedRecords.map((r) => (
                <div
                  key={r.topic}
                  className="neu-inset-sm flex items-center justify-between gap-3 p-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#1e2436]">
                      {r.topic}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#5a6378]">
                      {r.subject} · Insufficient data
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToQuiz(r.topic)}
                    className="neu-btn px-3 py-1.5 text-xs font-semibold text-[#7c3aed] whitespace-nowrap shrink-0"
                  >
                    Test Now
                  </button>
                </div>
              ))
            ) : (
              <div className="neu-inset-sm p-4 text-xs text-[#047857]">
                All tracked topics have enough quiz attempts for mastery scoring.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
