import React from 'react';
import {
  Activity,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  FlaskConical,
  Hammer,
  HelpCircle,
  MessageSquare,
  Target,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { useStudy } from '../context/StudyContext';
import {
  calculateOverallMastery,
  classifyMastery,
  getClassificationTheme,
} from '../utils/mastery';
import { MasteryRing, WeeklyActivityChart } from './NeomorphicCharts';

export function DashboardView() {
  const {
    settings,
    lessons,
    masteryRecords,
    quizAttempts,
    weeklyActivity,
    focusSessions,
    solutions,
    setActiveScreen,
    navigateToQuiz,
    navigateToSimplifier,
  } = useStudy();

  const overallMastery = calculateOverallMastery(masteryRecords);
  const totalMinutesThisWeek = weeklyActivity.reduce((acc, d) => acc + d.minutes, 0);
  const masteredCount = masteryRecords.filter(
    (r) =>
      classifyMastery(r.latestScorePercent, r.attemptedQuestions) === 'Strong Understanding' ||
      classifyMastery(r.latestScorePercent, r.attemptedQuestions) === 'Good Understanding'
  ).length;

  // Pick highest-priority topic to continue (weakest tested topic or most recent lesson)
  const priorityGap = masteryRecords.find((r) => {
    const cls = classifyMastery(r.latestScorePercent, r.attemptedQuestions);
    return cls === 'Needs Improvement' || cls === 'Developing';
  });
  const continueLesson =
    lessons.find((l) => l.topic === priorityGap?.topic) ?? lessons[0];

  // Dynamic recommendations derived from current mastery state
  const recommendations = masteryRecords
    .filter((r) => {
      const cls = classifyMastery(r.latestScorePercent, r.attemptedQuestions);
      return cls !== 'Strong Understanding';
    })
    .slice(0, 3)
    .map((r) => {
      const cls = classifyMastery(r.latestScorePercent, r.attemptedQuestions);
      if (cls === 'Insufficient Data') {
        return {
          topic: r.topic,
          actionLabel: 'Take Baseline Quiz',
          reason: `${r.subject} · Not yet tested`,
          onAction: () => navigateToQuiz(r.topic),
        };
      }
      if (cls === 'Needs Improvement') {
        return {
          topic: r.topic,
          actionLabel: 'Simplify & Review',
          reason: `${r.subject} · ${r.latestScorePercent}% (${cls})`,
          onAction: () => navigateToSimplifier(r.topic),
        };
      }
      return {
        topic: r.topic,
        actionLabel: 'Retake Quiz',
        reason: `${r.subject} · ${r.latestScorePercent}% (${cls})`,
        onAction: () => navigateToQuiz(r.topic),
      };
    });

  return (
    <div className="space-y-7">
      {/* Personalized Welcome Header */}
      <section className="neu-raised p-6 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium text-[#6366f1]">
              {settings.academicFocus} · {settings.defaultLevel} Track
            </p>
            <h1 className="mt-1 text-2xl sm:text-[28px] font-semibold text-[#1e2436]">
              Welcome back, {settings.studentName}
            </h1>
            <p className="mt-1.5 max-w-2xl text-[15px] text-[#5a6378]">
              {priorityGap
                ? `Your Learning Gap Detector flagged ${priorityGap.topic} (${priorityGap.latestScorePercent}%) for focused review today.`
                : 'Your concepts are trending strongly. Explore a new simulation or challenge yourself with a fresh quiz.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveScreen('simplifier')}
              className="neu-btn flex min-h-[44px] items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[#6366f1] whitespace-nowrap"
            >
              <BookOpen className="h-4 w-4" />
              <span>Simplify a Concept</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveScreen('quiz')}
              className="neu-btn flex min-h-[44px] items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[#7c3aed] whitespace-nowrap"
            >
              <HelpCircle className="h-4 w-4" />
              <span>Start Quiz</span>
            </button>
          </div>
        </div>
      </section>

      {/* Learning Statistics */}
      <section aria-label="Learning statistics" className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="neu-raised p-5">
          <div className="flex items-center justify-between text-[#5a6378]">
            <span className="text-xs font-medium">Overall Mastery</span>
            <Target className="h-4 w-4 text-[#6366f1]" />
          </div>
          <p className="mt-3 font-mono-tabular text-2xl font-semibold text-[#1e2436]">
            {overallMastery !== null ? `${overallMastery}%` : '—'}
          </p>
          <p className="mt-1 text-xs text-[#5a6378]">
            Across {masteryRecords.filter((m) => m.attemptedQuestions >= 2).length} tested topics
          </p>
        </div>

        <div className="neu-raised p-5">
          <div className="flex items-center justify-between text-[#5a6378]">
            <span className="text-xs font-medium">Topics Mastered</span>
            <Award className="h-4 w-4 text-[#059669]" />
          </div>
          <p className="mt-3 font-mono-tabular text-2xl font-semibold text-[#1e2436]">
            {masteredCount} / {masteryRecords.length}
          </p>
          <p className="mt-1 text-xs text-[#5a6378]">70%+ Good or Strong score</p>
        </div>

        <div className="neu-raised p-5">
          <div className="flex items-center justify-between text-[#5a6378]">
            <span className="text-xs font-medium">Quizzes Completed</span>
            <CheckCircle2 className="h-4 w-4 text-[#7c3aed]" />
          </div>
          <p className="mt-3 font-mono-tabular text-2xl font-semibold text-[#1e2436]">
            {quizAttempts.length}
          </p>
          <p className="mt-1 text-xs text-[#5a6378]">
            Weekly goal: {Math.min(quizAttempts.length, settings.weeklyQuizGoal)} / {settings.weeklyQuizGoal}
          </p>
        </div>

        <div className="neu-raised p-5">
          <div className="flex items-center justify-between text-[#5a6378]">
            <span className="text-xs font-medium">Weekly Study Time</span>
            <Timer className="h-4 w-4 text-[#6366f1]" />
          </div>
          <p className="mt-3 font-mono-tabular text-2xl font-semibold text-[#1e2436]">
            {totalMinutesThisWeek} min
          </p>
          <p className="mt-1 text-xs text-[#5a6378] tabular-nums">
            {focusSessions.length} focus sprints logged
          </p>
        </div>
      </section>

      {/* Overall Learning Progress + Continue Learning */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="neu-raised p-6 xl:col-span-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#1e2436]">
                Overall Learning Progress
              </h2>
              <p className="text-xs text-[#5a6378]">
                Daily study minutes · Highlighted bars include completed quizzes
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveScreen('gaps')}
              className="neu-btn self-start px-3.5 py-2 text-xs font-semibold text-[#6366f1] whitespace-nowrap"
            >
              Inspect Learning Gaps
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 items-center gap-6 md:grid-cols-12">
            <div className="flex flex-col items-center justify-center md:col-span-4">
              <MasteryRing
                percentage={overallMastery}
                label="Mastery Score"
                accentColor="#6366f1"
              />
            </div>
            <div className="md:col-span-8">
              <WeeklyActivityChart days={weeklyActivity} />
            </div>
          </div>
        </div>

        {/* Continue Learning */}
        <div className="neu-raised flex flex-col justify-between p-6 xl:col-span-5">
          <div>
            <div className="flex items-center justify-between text-xs text-[#5a6378]">
              <span>Continue Learning</span>
              <TrendingUp className="h-4 w-4 text-[#6366f1]" />
            </div>
            {continueLesson ? (
              <>
                <h2 className="mt-3 text-xl font-semibold text-[#1e2436]">
                  {continueLesson.topic}
                </h2>
                <p className="mt-1 text-xs text-[#5a6378]">
                  {continueLesson.subject} · {continueLesson.level} · {continueLesson.readMinutes} min read
                </p>
                <p className="mt-3 text-sm leading-relaxed text-[#3d4558]">
                  {continueLesson.summary}
                </p>
                {priorityGap && priorityGap.topic === continueLesson.topic && (
                  <div className="mt-4 neu-inset-sm p-3.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#5a6378]">Current Mastery</span>
                      <span className="font-mono-tabular font-semibold text-[#b91c1c]">
                        {priorityGap.latestScorePercent}% · Needs Improvement
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-4 text-sm text-[#5a6378]">
                Simplify your first topic to start a structured lesson path.
              </p>
            )}
          </div>

          {continueLesson && (
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigateToSimplifier(continueLesson.topic)}
                className="neu-btn flex min-h-[42px] flex-1 items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-[#6366f1] whitespace-nowrap"
              >
                <span>Resume Lesson</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => navigateToQuiz(continueLesson.topic)}
                className="neu-btn flex min-h-[42px] flex-1 items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-[#3d4558] whitespace-nowrap"
              >
                <span>Practice Quiz</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Recent Topics + Recommended Learning Activities */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="neu-raised p-6 lg:col-span-7">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#1e2436]">Recent Topics</h2>
            <span className="text-xs text-[#5a6378] tabular-nums">
              {lessons.length} saved lessons
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {lessons.slice(0, 4).map((lesson) => {
              const mastery = masteryRecords.find(
                (m) => m.topic.toLowerCase() === lesson.topic.toLowerCase()
              );
              const cls = classifyMastery(
                mastery?.latestScorePercent ?? null,
                mastery?.attemptedQuestions ?? 0
              );
              const theme = getClassificationTheme(cls);

              return (
                <div
                  key={lesson.id}
                  className="neu-inset-sm flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold text-[#1e2436]">
                      {lesson.topic}
                    </h3>
                    <p className="mt-1 text-xs text-[#5a6378]">
                      <span>{lesson.subject}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{lesson.level}</span>
                      <span aria-hidden="true"> · </span>
                      <span className={`font-medium ${theme.textColor}`}>
                        {mastery?.latestScorePercent !== null &&
                        mastery?.latestScorePercent !== undefined
                          ? `${mastery.latestScorePercent}% (${cls})`
                          : cls}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => navigateToSimplifier(lesson.topic)}
                      className="neu-btn px-3.5 py-2 text-xs font-semibold text-[#6366f1] whitespace-nowrap"
                    >
                      Open Lesson
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateToQuiz(lesson.topic)}
                      className="neu-btn px-3.5 py-2 text-xs font-medium text-[#3d4558] whitespace-nowrap"
                    >
                      Quiz
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recommended Learning Activities */}
        <div className="neu-raised p-6 lg:col-span-5">
          <h2 className="text-lg font-semibold text-[#1e2436]">
            Recommended Activities
          </h2>
          <p className="mt-1 text-xs text-[#5a6378]">
            Prioritized from your quiz accuracy and untested topics
          </p>

          <div className="mt-4 space-y-3">
            {recommendations.length > 0 ? (
              recommendations.map((rec) => (
                <div
                  key={rec.topic}
                  className="neu-inset-sm flex items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#1e2436]">
                      {rec.topic}
                    </p>
                    <p className="mt-0.5 text-xs text-[#5a6378]">{rec.reason}</p>
                  </div>
                  <button
                    type="button"
                    onClick={rec.onAction}
                    className="neu-btn px-3.5 py-2 text-xs font-semibold text-[#7c3aed] whitespace-nowrap shrink-0"
                  >
                    {rec.actionLabel}
                  </button>
                </div>
              ))
            ) : (
              <div className="neu-inset-sm p-4 text-sm text-[#5a6378]">
                All tracked topics are at Strong Understanding. Try generating a new topic in Concept Simplifier or Experiment Lab!
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Quick Access to All Major Features */}
      <section aria-label="Quick access to features">
        <h2 className="mb-4 text-lg font-semibold text-[#1e2436]">Quick Access</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => setActiveScreen('simplifier')}
            className="neu-btn flex flex-col items-start p-5 text-left"
          >
            <BookOpen className="h-5 w-5 text-[#6366f1]" />
            <span className="mt-3 text-[15px] font-semibold text-[#1e2436]">
              Concept Simplifier
            </span>
            <span className="mt-1 text-xs leading-relaxed text-[#5a6378]">
              Break down topics or uploaded PDFs into examples and analogies.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveScreen('quiz')}
            className="neu-btn flex flex-col items-start p-5 text-left"
          >
            <HelpCircle className="h-5 w-5 text-[#7c3aed]" />
            <span className="mt-3 text-[15px] font-semibold text-[#1e2436]">
              Quiz Arena
            </span>
            <span className="mt-1 text-xs leading-relaxed text-[#5a6378]">
              Test recall with 4-option questions and instant explanations.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveScreen('gaps')}
            className="neu-btn flex flex-col items-start p-5 text-left"
          >
            <Activity className="h-5 w-5 text-[#059669]" />
            <span className="mt-3 text-[15px] font-semibold text-[#1e2436]">
              Learning Gap Detector
            </span>
            <span className="mt-1 text-xs leading-relaxed text-[#5a6378]">
              Track topic mastery, weak areas, and attempt-over-attempt progress.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveScreen('experiment')}
            className="neu-btn flex flex-col items-start p-5 text-left"
          >
            <FlaskConical className="h-5 w-5 text-[#6366f1]" />
            <span className="mt-3 text-[15px] font-semibold text-[#1e2436]">
              Experiment Lab
            </span>
            <span className="mt-1 text-xs leading-relaxed text-[#5a6378]">
              Explore what-if questions with adjustable assumption sliders.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveScreen('solutions')}
            className="neu-btn flex flex-col items-start p-5 text-left"
          >
            <Hammer className="h-5 w-5 text-[#059669]" />
            <span className="mt-3 text-[15px] font-semibold text-[#1e2436]">
              Solution Studio ({solutions.length})
            </span>
            <span className="mt-1 text-xs leading-relaxed text-[#5a6378]">
              Co-design real-world prototypes with AI and collaborate in Study Rooms.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveScreen('tutor')}
            className="neu-btn flex flex-col items-start p-5 text-left"
          >
            <MessageSquare className="h-5 w-5 text-[#7c3aed]" />
            <span className="mt-3 text-[15px] font-semibold text-[#1e2436]">
              Study Tutor
            </span>
            <span className="mt-1 text-xs leading-relaxed text-[#5a6378]">
              Multi-turn coaching with reasoning tiers and live Google Search.
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
