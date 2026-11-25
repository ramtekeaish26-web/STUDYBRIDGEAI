import {
  INITIAL_FOCUS_SESSIONS,
  INITIAL_LESSONS,
  INITIAL_QUIZ_ATTEMPTS,
  INITIAL_QUIZ_BANKS,
  INITIAL_SETTINGS,
  INITIAL_SOLUTIONS,
  INITIAL_SOLUTION_CONTRIBUTIONS,
  INITIAL_TOPIC_MASTERY,
  INITIAL_TUTOR_THREADS,
  INITIAL_WEEKLY_ACTIVITY,
  SAMPLE_EXPERIMENTS,
} from '../data/sampleData';
import {
  ExperimentScenario,
  FocusSession,
  QuizAttempt,
  QuizBank,
  SimplifiedLesson,
  SolutionContribution,
  SolutionProject,
  StudentSettings,
  TopicMasteryRecord,
  TutorMessage,
  TutorModelId,
  TutorRoleId,
  TutorThread,
  WeeklyStudyDay,
} from '../types/study';
import { calculateMasteryPercentage, classifyMastery } from './mastery';

export const STORAGE_KEY = 'studybridge_state_v3';

export interface PersistedState {
  lessons: SimplifiedLesson[];
  quizBanks: Record<string, QuizBank>;
  masteryRecords: TopicMasteryRecord[];
  quizAttempts: QuizAttempt[];
  experiments: ExperimentScenario[];
  weeklyActivity: WeeklyStudyDay[];
  focusSessions: FocusSession[];
  tutorThreads: TutorThread[];
  solutions: SolutionProject[];
  solutionContributions: Record<string, SolutionContribution[]>;
  settings: StudentSettings;
}

export interface QuizSubmissionInput {
  topic: string;
  subject: string;
  correctCount: number;
  totalQuestions: number;
  strongConcepts: string[];
  weakConcepts: string[];
}

let idCounter = 0;

export function createUniqueId(prefix = 'id'): string {
  idCounter = (idCounter + 1) % 100000;
  const randomPart =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : `${Date.now().toString(36)}-${idCounter}`;
  return `${prefix}-${Date.now()}-${randomPart}`;
}

export function generateRoomCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const prefix =
    letters[Math.floor(Math.random() * letters.length)] +
    letters[Math.floor(Math.random() * letters.length)] +
    letters[Math.floor(Math.random() * letters.length)];
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `${prefix}${digits}`;
}

export function createInitialSampleState(): PersistedState {
  return {
    lessons: INITIAL_LESSONS,
    quizBanks: INITIAL_QUIZ_BANKS,
    masteryRecords: INITIAL_TOPIC_MASTERY,
    quizAttempts: INITIAL_QUIZ_ATTEMPTS,
    experiments: SAMPLE_EXPERIMENTS,
    weeklyActivity: INITIAL_WEEKLY_ACTIVITY,
    focusSessions: INITIAL_FOCUS_SESSIONS,
    tutorThreads: INITIAL_TUTOR_THREADS,
    solutions: INITIAL_SOLUTIONS,
    solutionContributions: INITIAL_SOLUTION_CONTRIBUTIONS,
    settings: INITIAL_SETTINGS,
  };
}

export function loadPersistedState(storage?: Pick<Storage, 'getItem'>): PersistedState {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
  if (store) {
    try {
      const raw =
        store.getItem(STORAGE_KEY) ||
        store.getItem('studybridge_state_v2') ||
        store.getItem('studybridge_state_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedState>;
        if (parsed.lessons && parsed.masteryRecords && parsed.settings) {
          return {
            lessons: parsed.lessons,
            quizBanks: parsed.quizBanks ?? INITIAL_QUIZ_BANKS,
            masteryRecords: parsed.masteryRecords,
            quizAttempts: parsed.quizAttempts ?? INITIAL_QUIZ_ATTEMPTS,
            experiments: parsed.experiments ?? SAMPLE_EXPERIMENTS,
            weeklyActivity: parsed.weeklyActivity ?? INITIAL_WEEKLY_ACTIVITY,
            focusSessions: parsed.focusSessions ?? INITIAL_FOCUS_SESSIONS,
            tutorThreads: parsed.tutorThreads ?? INITIAL_TUTOR_THREADS,
            solutions:
              parsed.solutions && parsed.solutions.length > 0
                ? parsed.solutions
                : INITIAL_SOLUTIONS,
            solutionContributions:
              parsed.solutionContributions ?? INITIAL_SOLUTION_CONTRIBUTIONS,
            settings: { ...INITIAL_SETTINGS, ...parsed.settings },
          };
        }
      }
    } catch {
      // Fall back to sample seed data
    }
  }
  return createInitialSampleState();
}

export function addLessonToState(
  state: PersistedState,
  lesson: SimplifiedLesson
): { nextState: PersistedState; createdMastery: TopicMasteryRecord | null; saved: boolean } {
  if (!state.settings.autoSaveLessons) {
    return { nextState: state, createdMastery: null, saved: false };
  }

  const hasMastery = state.masteryRecords.some(
    (m) => m.topic.toLowerCase() === lesson.topic.toLowerCase()
  );

  const createdMastery: TopicMasteryRecord | null = hasMastery
    ? null
    : {
        topic: lesson.topic,
        subject: lesson.subject,
        correctAnswers: 0,
        attemptedQuestions: 0,
        previousScorePercent: null,
        latestScorePercent: null,
        lastPracticedAt: null,
        strongConcepts: [],
        weakConcepts: [],
        revisionAdvice:
          'Newly simplified topic. Take a quick quiz in Quiz Arena to measure your understanding.',
      };

  const nextLessons = [lesson, ...state.lessons.filter((l) => l.id !== lesson.id)];
  const nextMastery = createdMastery
    ? [createdMastery, ...state.masteryRecords]
    : state.masteryRecords;

  return {
    nextState: {
      ...state,
      lessons: nextLessons,
      masteryRecords: nextMastery,
    },
    createdMastery,
    saved: true,
  };
}

export function applyQuizCompletionToState(
  state: PersistedState,
  input: QuizSubmissionInput
): {
  nextState: PersistedState;
  attempt: QuizAttempt;
  updatedMasteryRecord: TopicMasteryRecord;
} {
  const safeTotal = Math.max(1, Math.round(input.totalQuestions));
  const safeCorrect = Math.max(0, Math.min(safeTotal, Math.round(input.correctCount)));
  const scorePercent =
    calculateMasteryPercentage(safeCorrect, safeTotal) ??
    Math.round((safeCorrect / safeTotal) * 100);

  const attempt: QuizAttempt = {
    id: createUniqueId('att'),
    topic: input.topic,
    correctCount: safeCorrect,
    totalQuestions: safeTotal,
    scorePercent,
    timestamp: new Date().toISOString(),
  };

  const classification = classifyMastery(scorePercent, safeTotal);

  let revisionAdvice =
    'Great momentum! Explore advanced questions or test assumptions in Experiment Lab.';
  if (classification === 'Needs Improvement') {
    revisionAdvice = `Priority focus needed (${scorePercent}%). Revisit ${input.topic} in Concept Simplifier before retaking.`;
  } else if (classification === 'Developing') {
    revisionAdvice = `Solid start (${scorePercent}%). Review missed concepts and retake the quiz to reach 70%+ Good Understanding.`;
  } else if (classification === 'Good Understanding') {
    revisionAdvice = `Good grasp (${scorePercent}%). Target remaining weak spots to push past 85% Strong Understanding.`;
  } else if (classification === 'Insufficient Data') {
    revisionAdvice = 'Complete at least 2 questions on this topic for a reliable mastery score.';
  }

  const existingIdx = state.masteryRecords.findIndex(
    (m) => m.topic.toLowerCase() === input.topic.toLowerCase()
  );
  const computedLatest = calculateMasteryPercentage(safeCorrect, safeTotal);

  const updatedMasteryRecord: TopicMasteryRecord =
    existingIdx >= 0
      ? {
          ...state.masteryRecords[existingIdx],
          subject: input.subject || state.masteryRecords[existingIdx].subject,
          correctAnswers: safeCorrect,
          attemptedQuestions: safeTotal,
          previousScorePercent: state.masteryRecords[existingIdx].latestScorePercent,
          latestScorePercent: computedLatest,
          lastPracticedAt: attempt.timestamp,
          strongConcepts: input.strongConcepts,
          weakConcepts: input.weakConcepts,
          revisionAdvice,
        }
      : {
          topic: input.topic,
          subject: input.subject,
          correctAnswers: safeCorrect,
          attemptedQuestions: safeTotal,
          previousScorePercent: null,
          latestScorePercent: computedLatest,
          lastPracticedAt: attempt.timestamp,
          strongConcepts: input.strongConcepts,
          weakConcepts: input.weakConcepts,
          revisionAdvice,
        };

  const nextMastery = [...state.masteryRecords];
  if (existingIdx >= 0) {
    nextMastery[existingIdx] = updatedMasteryRecord;
  } else {
    nextMastery.unshift(updatedMasteryRecord);
  }

  const nextWeekly = state.weeklyActivity.map((day, idx) =>
    idx === state.weeklyActivity.length - 1
      ? {
          ...day,
          minutes: day.minutes + Math.max(5, safeTotal * 2),
          quizzes: day.quizzes + 1,
        }
      : day
  );

  return {
    nextState: {
      ...state,
      quizAttempts: [attempt, ...state.quizAttempts],
      masteryRecords: nextMastery,
      weeklyActivity: nextWeekly,
    },
    attempt,
    updatedMasteryRecord,
  };
}

export function logFocusMinutesInState(
  state: PersistedState,
  minutes: number,
  focusTopic: string
): { nextState: PersistedState; session: FocusSession } {
  const cleanMinutes = Math.max(1, Math.min(240, Math.round(minutes)));
  const session: FocusSession = {
    id: createUniqueId('fs'),
    durationMinutes: cleanMinutes,
    focusTopic: focusTopic || 'General Study',
    createdAt: new Date().toISOString(),
  };

  return {
    nextState: {
      ...state,
      focusSessions: [session, ...state.focusSessions],
      weeklyActivity: state.weeklyActivity.map((day, idx) =>
        idx === state.weeklyActivity.length - 1
          ? { ...day, minutes: day.minutes + cleanMinutes }
          : day
      ),
    },
    session,
  };
}

export function computeTodayFocusMinutes(
  sessions: FocusSession[],
  referenceDate: Date = new Date()
): number {
  const targetDay = referenceDate.toDateString();
  return sessions.reduce((sum, s) => {
    const parsed = new Date(s.createdAt);
    if (!Number.isNaN(parsed.getTime()) && parsed.toDateString() === targetDay) {
      return sum + s.durationMinutes;
    }
    return sum;
  }, 0);
}

export function toggleSolutionTaskInState(
  state: PersistedState,
  solutionId: string,
  taskId: string,
  actorName: string
): { nextState: PersistedState; target?: SolutionProject; nextTasks?: SolutionProject['tasks'] } {
  const target = state.solutions.find((s) => s.id === solutionId);
  if (!target) return { nextState: state };

  const nextTasks = target.tasks.map((t) => {
    if (t.id !== taskId) return t;
    const nextCompleted = !t.completed;
    return {
      ...t,
      completed: nextCompleted,
      assigneeName: nextCompleted ? actorName : t.assigneeName,
    };
  });

  return {
    nextState: {
      ...state,
      solutions: state.solutions.map((s) =>
        s.id === solutionId
          ? { ...s, tasks: nextTasks, updatedAt: new Date().toISOString() }
          : s
      ),
    },
    target,
    nextTasks,
  };
}

export function endorseSolutionInState(
  state: PersistedState,
  solutionId: string,
  actorId: string
): { nextState: PersistedState; target?: SolutionProject; nextEndorse?: string[] } {
  const target = state.solutions.find((s) => s.id === solutionId);
  if (!target) return { nextState: state };

  const alreadyEndorsed = target.endorseUids.includes(actorId);
  const nextEndorse = alreadyEndorsed
    ? target.endorseUids.filter((id) => id !== actorId)
    : [...target.endorseUids, actorId].slice(0, 25);

  return {
    nextState: {
      ...state,
      solutions: state.solutions.map((s) =>
        s.id === solutionId
          ? { ...s, endorseUids: nextEndorse, updatedAt: new Date().toISOString() }
          : s
      ),
    },
    target,
    nextEndorse,
  };
}

export function appendTutorTurnInState(
  state: PersistedState,
  threadId: string,
  userMessage: TutorMessage,
  assistantMessage: TutorMessage
): { nextState: PersistedState; updatedThread: TutorThread | null } {
  const existing = state.tutorThreads.find((t) => t.id === threadId);
  if (!existing) {
    return { nextState: state, updatedThread: null };
  }

  const nextTitle =
    existing.messages.length === 0
      ? userMessage.text.slice(0, 48).trim() || existing.title
      : existing.title;

  const updatedThread: TutorThread = {
    ...existing,
    title: nextTitle,
    messages: [...existing.messages, userMessage, assistantMessage].slice(-60),
    updatedAt: new Date().toISOString(),
  };

  return {
    nextState: {
      ...state,
      tutorThreads: state.tutorThreads.map((t) => (t.id === threadId ? updatedThread : t)),
    },
    updatedThread,
  };
}

export function createTutorThreadRecord(
  roleId: TutorRoleId = 'socratic',
  modelId: TutorModelId = 'gemini-4-hydrogen'
): TutorThread {
  const now = new Date().toISOString();
  return {
    id: createUniqueId('thread'),
    title: 'New Study Session',
    roleId,
    modelId,
    useSearchGrounding: false,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}
