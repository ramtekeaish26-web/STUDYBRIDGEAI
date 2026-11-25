import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, googleProvider, testConnection } from '../firebase';
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
  NavScreen,
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
import { handleFirestoreError, OperationType, toSafeDocId } from '../utils/firestoreErrors';
import { calculateMasteryPercentage, classifyMastery } from '../utils/mastery';

const STORAGE_KEY = 'studybridge_state_v3';

interface PersistedState {
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

interface QuizSubmissionInput {
  topic: string;
  subject: string;
  correctCount: number;
  totalQuestions: number;
  strongConcepts: string[];
  weakConcepts: string[];
}

interface StudyContextValue extends PersistedState {
  activeScreen: NavScreen;
  setActiveScreen: (screen: NavScreen) => void;
  activeQuizTopic: string;
  setActiveQuizTopic: (topic: string) => void;
  activeLessonId: string;
  setActiveLessonId: (id: string) => void;
  simplifierDraftTopic: string;
  setSimplifierDraftTopic: (topic: string) => void;
  activeSolutionId: string;
  setActiveSolutionId: (id: string) => void;
  solutionDraftTopic: string;
  setSolutionDraftTopic: (topic: string) => void;
  navigateToQuiz: (topic: string) => void;
  navigateToSimplifier: (topic: string) => void;
  navigateToSolutionWithTopic: (topic: string) => void;
  addLesson: (lesson: SimplifiedLesson) => void;
  saveQuizBank: (bank: QuizBank) => void;
  recordQuizCompletion: (input: QuizSubmissionInput) => QuizAttempt;
  addExperiment: (experiment: ExperimentScenario) => void;
  updateSettings: (patch: Partial<StudentSettings>) => void;
  resetAllData: () => void;

  // Solution Studio & Collaborative Study Rooms
  cloudRooms: SolutionProject[];
  createSolution: (solution: SolutionProject, publishToCloud?: boolean) => Promise<void>;
  publishSolutionToRoom: (solutionId: string) => Promise<void>;
  joinStudyRoomByCode: (roomCode: string) => Promise<{ ok: boolean; message: string }>;
  toggleSolutionTask: (solutionId: string, taskId: string) => Promise<void>;
  endorseSolution: (solutionId: string) => Promise<void>;
  applySolutionIteration: (
    solutionId: string,
    patch: Partial<
      Pick<
        SolutionProject,
        | 'solutionSummary'
        | 'feasibilityScore'
        | 'aiIntegrationPlan'
        | 'buildPhases'
        | 'impactMetrics'
        | 'tasks'
        | 'risks'
      >
    >,
    iterationNote: string
  ) => Promise<void>;
  addSolutionContribution: (
    solutionId: string,
    kind: SolutionContribution['kind'],
    text: string
  ) => Promise<void>;

  // Global Focus Timer
  focusDurationMinutes: number;
  focusRemainingSeconds: number;
  focusRunning: boolean;
  focusTopic: string;
  lastCompletedFocusNotice: string | null;
  setFocusDuration: (minutes: number) => void;
  setFocusTopic: (topic: string) => void;
  toggleFocusTimer: () => void;
  resetFocusTimer: () => void;
  logFocusSessionEarly: () => void;
  dismissFocusNotice: () => void;

  // Multi-turn Study Tutor
  activeTutorThreadId: string;
  setActiveTutorThreadId: (id: string) => void;
  createTutorThread: (roleId?: TutorRoleId, modelId?: TutorModelId) => TutorThread;
  updateTutorThreadConfig: (
    threadId: string,
    patch: Partial<Pick<TutorThread, 'roleId' | 'modelId' | 'useSearchGrounding' | 'title'>>
  ) => void;
  appendTutorTurn: (
    threadId: string,
    userMessage: TutorMessage,
    assistantMessage: TutorMessage
  ) => void;

  // Firebase Auth & Sync
  authReady: boolean;
  user: User | null;
  syncStatus: 'guest' | 'syncing' | 'synced' | 'error';
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const StudyContext = createContext<StudyContextValue | null>(null);

function normalizeTimestamp(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val.length > 0) {
    return val;
  }
  return new Date().toISOString();
}

function loadInitialState(): PersistedState {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem('studybridge_state_v2') ||
      localStorage.getItem('studybridge_state_v1');
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

function mapRoomDoc(d: Record<string, unknown>): SolutionProject {
  return {
    id: String(d.id || ''),
    roomCode: String(d.roomCode || ''),
    ownerUid: String(d.ownerUid || ''),
    ownerName: String(d.ownerName || 'Learner'),
    title: String(d.title || 'Untitled Solution'),
    domain: String(d.domain || 'Interdisciplinary'),
    problemStatement: String(d.problemStatement || ''),
    targetCommunity: String(d.targetCommunity || ''),
    constraints: String(d.constraints || ''),
    linkedTopic: typeof d.linkedTopic === 'string' ? d.linkedTopic : undefined,
    solutionSummary: String(d.solutionSummary || ''),
    feasibilityScore: Number(d.feasibilityScore) || 75,
    aiIntegrationPlan: String(d.aiIntegrationPlan || ''),
    buildPhases: Array.isArray(d.buildPhases) ? d.buildPhases : [],
    impactMetrics: Array.isArray(d.impactMetrics) ? d.impactMetrics : [],
    tasks: Array.isArray(d.tasks) ? d.tasks : [],
    risks: Array.isArray(d.risks) ? d.risks : [],
    visibility: d.visibility === 'invite' ? 'invite' : 'open',
    memberUids: Array.isArray(d.memberUids) ? d.memberUids.map(String) : [],
    endorseUids: Array.isArray(d.endorseUids) ? d.endorseUids.map(String) : [],
    isPublished: true,
    isAiGenerated: Boolean(d.isAiGenerated),
    createdAt: normalizeTimestamp(d.createdAt),
    updatedAt: normalizeTimestamp(d.updatedAt),
  };
}

export function StudyProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedState>(() => loadInitialState());
  const [activeScreen, setActiveScreen] = useState<NavScreen>('dashboard');
  const [activeQuizTopic, setActiveQuizTopic] = useState<string>('Photosynthesis & Calvin Cycle');
  const [activeLessonId, setActiveLessonId] = useState<string>(
    () => state.lessons[0]?.id ?? INITIAL_LESSONS[0].id
  );
  const [simplifierDraftTopic, setSimplifierDraftTopic] = useState<string>('');
  const [activeSolutionId, setActiveSolutionId] = useState<string>(
    () => state.solutions[0]?.id ?? INITIAL_SOLUTIONS[0].id
  );
  const [solutionDraftTopic, setSolutionDraftTopic] = useState<string>('');
  const [cloudRooms, setCloudRooms] = useState<SolutionProject[]>([]);

  // Focus Timer State
  const [focusDurationMinutes, setFocusDurationMinutes] = useState<number>(25);
  const [focusRemainingSeconds, setFocusRemainingSeconds] = useState<number>(25 * 60);
  const [focusRunning, setFocusRunning] = useState<boolean>(false);
  const [focusTopic, setFocusTopic] = useState<string>('General Study');
  const [lastCompletedFocusNotice, setLastCompletedFocusNotice] = useState<string | null>(null);
  const timerTargetEndRef = useRef<number | null>(null);

  // Study Tutor State
  const [activeTutorThreadId, setActiveTutorThreadId] = useState<string>(
    () => state.tutorThreads[0]?.id ?? INITIAL_TUTOR_THREADS[0].id
  );

  // Firebase Auth & Sync State
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<'guest' | 'syncing' | 'synced' | 'error'>('guest');
  const [authError, setAuthError] = useState<string | null>(null);

  // Refs prevent React 19 batching / interval stale-closure bugs
  const stateRef = useRef<PersistedState>(state);
  stateRef.current = state;
  const userRef = useRef<User | null>(user);
  userRef.current = user;
  const focusTopicRef = useRef<string>(focusTopic);
  focusTopicRef.current = focusTopic;
  const focusDurationRef = useRef<number>(focusDurationMinutes);
  focusDurationRef.current = focusDurationMinutes;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  // Startup Firestore connection validation
  useEffect(() => {
    testConnection().catch(() => {});
  }, []);

  // Firestore Write Helpers (strictly respecting firestore.rules schemas)
  const syncLessonToCloud = async (uid: string, lesson: SimplifiedLesson) => {
    const lessonId = toSafeDocId(lesson.id, 'lesson');
    const path = `users/${uid}/lessons/${lessonId}`;
    const docRef = doc(db, 'users', uid, 'lessons', lessonId);
    try {
      const existingSnap = await getDoc(docRef);
      const basePayload = {
        topic: lesson.topic.slice(0, 160),
        title: lesson.title.slice(0, 220),
        subject: lesson.subject.slice(0, 80),
        level: lesson.level,
        language: lesson.language.slice(0, 40),
        readMinutes: Math.max(1, Math.min(120, Math.round(lesson.readMinutes || 5))),
        summary: lesson.summary.slice(0, 1500),
        definition: lesson.definition.slice(0, 2500),
        coreMechanism: lesson.coreMechanism.slice(0, 20),
        examples: lesson.examples.slice(0, 10),
        analogies: lesson.analogies.slice(0, 10),
        keyTakeaways: lesson.keyTakeaways.slice(0, 15),
        ...(lesson.groundedSources && lesson.groundedSources.length > 0
          ? { groundedSources: lesson.groundedSources.slice(0, 10) }
          : {}),
        ...(lesson.sourceNoteName
          ? { sourceNoteName: lesson.sourceNoteName.slice(0, 160) }
          : {}),
        ...(lesson.isAiGenerated !== undefined ? { isAiGenerated: lesson.isAiGenerated } : {}),
        updatedAt: serverTimestamp(),
      };

      if (existingSnap.exists()) {
        await updateDoc(docRef, basePayload);
      } else {
        await setDoc(docRef, {
          id: lessonId,
          uid,
          ...basePayload,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const syncMasteryToCloud = async (uid: string, record: TopicMasteryRecord) => {
    const topicId = toSafeDocId(`topic_${record.topic}`, 'topic');
    const path = `users/${uid}/mastery/${topicId}`;
    const docRef = doc(db, 'users', uid, 'mastery', topicId);
    try {
      const existingSnap = await getDoc(docRef);
      const payload = {
        topic: record.topic.slice(0, 160),
        subject: record.subject.slice(0, 80),
        correctAnswers: Math.max(0, Math.min(100, Math.round(record.correctAnswers))),
        attemptedQuestions: Math.max(0, Math.min(100, Math.round(record.attemptedQuestions))),
        previousScorePercent:
          record.previousScorePercent !== null ? Math.round(record.previousScorePercent) : null,
        latestScorePercent:
          record.latestScorePercent !== null ? Math.round(record.latestScorePercent) : null,
        strongConcepts: record.strongConcepts.slice(0, 25),
        weakConcepts: record.weakConcepts.slice(0, 25),
        revisionAdvice: record.revisionAdvice.slice(0, 600),
        lastPracticedAt: record.lastPracticedAt,
        updatedAt: serverTimestamp(),
      };

      if (existingSnap.exists()) {
        await updateDoc(docRef, payload);
      } else {
        await setDoc(docRef, {
          id: topicId,
          uid,
          ...payload,
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const syncQuizAttemptToCloud = async (uid: string, attempt: QuizAttempt) => {
    const attemptId = toSafeDocId(attempt.id, 'att');
    const path = `users/${uid}/quizAttempts/${attemptId}`;
    try {
      await setDoc(doc(db, 'users', uid, 'quizAttempts', attemptId), {
        id: attemptId,
        uid,
        topic: attempt.topic.slice(0, 160),
        correctCount: Math.max(0, Math.min(50, Math.round(attempt.correctCount))),
        totalQuestions: Math.max(1, Math.min(50, Math.round(attempt.totalQuestions))),
        scorePercent: Math.max(0, Math.min(100, Math.round(attempt.scorePercent))),
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const syncFocusSessionToCloud = async (uid: string, session: FocusSession) => {
    const sessionId = toSafeDocId(session.id, 'fs');
    const path = `users/${uid}/focusSessions/${sessionId}`;
    try {
      await setDoc(doc(db, 'users', uid, 'focusSessions', sessionId), {
        id: sessionId,
        uid,
        durationMinutes: Math.max(1, Math.min(240, Math.round(session.durationMinutes))),
        focusTopic: session.focusTopic.slice(0, 160),
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const syncTutorThreadToCloud = async (uid: string, thread: TutorThread) => {
    const threadId = toSafeDocId(thread.id, 'thread');
    const path = `users/${uid}/tutorThreads/${threadId}`;
    const docRef = doc(db, 'users', uid, 'tutorThreads', threadId);
    try {
      const existingSnap = await getDoc(docRef);
      const payload = {
        title: thread.title.slice(0, 160),
        roleId: thread.roleId.slice(0, 60),
        modelId: thread.modelId.slice(0, 60),
        useSearchGrounding: Boolean(thread.useSearchGrounding),
        messages: thread.messages.slice(-60),
        updatedAt: serverTimestamp(),
      };
      if (existingSnap.exists()) {
        await updateDoc(docRef, payload);
      } else {
        await setDoc(docRef, {
          id: threadId,
          uid,
          ...payload,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const syncExperimentToCloud = async (uid: string, exp: ExperimentScenario) => {
    const expId = toSafeDocId(exp.id, 'exp');
    const path = `users/${uid}/experiments/${expId}`;
    try {
      await setDoc(doc(db, 'users', uid, 'experiments', expId), {
        id: expId,
        uid,
        question: exp.question.slice(0, 300),
        title: exp.title.slice(0, 200),
        domain: exp.domain.slice(0, 100),
        summary: exp.summary.slice(0, 1500),
        predictions: exp.predictions.slice(0, 10),
        parameters: exp.parameters.slice(0, 10),
        outcomeExplanation: exp.outcomeExplanation.slice(0, 15),
        realWorldApplications: exp.realWorldApplications.slice(0, 10),
        chartSeries: exp.chartSeries.slice(0, 15),
        ...(exp.isAiGenerated !== undefined ? { isAiGenerated: exp.isAiGenerated } : {}),
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const seedInitialCloudWorkspace = async (firebaseUser: User) => {
    const uid = firebaseUser.uid;
    const profileRef = doc(db, 'users', uid);
    const snapshot = stateRef.current;

    try {
      const profileSnap = await getDoc(profileRef);
      if (!profileSnap.exists()) {
        await setDoc(profileRef, {
          uid,
          displayName: (
            firebaseUser.displayName ||
            snapshot.settings.studentName ||
            'Learner'
          ).slice(0, 80),
          email: (firebaseUser.email || '').slice(0, 160),
          academicFocus: (snapshot.settings.academicFocus || 'STEM Foundations').slice(0, 120),
          defaultLevel: snapshot.settings.defaultLevel,
          defaultLanguage: snapshot.settings.defaultLanguage.slice(0, 40),
          weeklyQuizGoal: Math.max(1, Math.min(100, Math.round(snapshot.settings.weeklyQuizGoal))),
          showInstantFeedback: Boolean(snapshot.settings.showInstantFeedback),
          autoSaveLessons: Boolean(snapshot.settings.autoSaveLessons),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await Promise.all([
          ...snapshot.lessons.map((l) => syncLessonToCloud(uid, l)),
          ...snapshot.masteryRecords.map((m) => syncMasteryToCloud(uid, m)),
          ...snapshot.quizAttempts.map((a) => syncQuizAttemptToCloud(uid, a)),
          ...snapshot.focusSessions.map((f) => syncFocusSessionToCloud(uid, f)),
          ...snapshot.tutorThreads.map((t) => syncTutorThreadToCloud(uid, t)),
          ...snapshot.experiments.map((e) => syncExperimentToCloud(uid, e)),
        ]);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    }
  };

  // Firebase Auth & Real-Time Firestore Listeners
  useEffect(() => {
    let unsubscribes: Array<() => void> = [];

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribes.forEach((u) => u());
      unsubscribes = [];

      setUser(firebaseUser);
      setAuthReady(true);

      if (!firebaseUser) {
        setSyncStatus('guest');
        setCloudRooms([]);
        return;
      }

      setSyncStatus('syncing');
      setAuthError(null);

      try {
        await seedInitialCloudWorkspace(firebaseUser);
      } catch (err) {
        setSyncStatus('error');
        setAuthError(err instanceof Error ? err.message : 'Unable to initialize cloud workspace.');
        return;
      }

      const uid = firebaseUser.uid;

      const unsubProfile = onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            setState((prev) => ({
              ...prev,
              settings: {
                studentName: d.displayName || prev.settings.studentName,
                academicFocus: d.academicFocus || prev.settings.academicFocus,
                defaultLevel: d.defaultLevel || prev.settings.defaultLevel,
                defaultLanguage: d.defaultLanguage || prev.settings.defaultLanguage,
                weeklyQuizGoal: Number(d.weeklyQuizGoal) || prev.settings.weeklyQuizGoal,
                showInstantFeedback:
                  typeof d.showInstantFeedback === 'boolean'
                    ? d.showInstantFeedback
                    : prev.settings.showInstantFeedback,
                autoSaveLessons:
                  typeof d.autoSaveLessons === 'boolean'
                    ? d.autoSaveLessons
                    : prev.settings.autoSaveLessons,
              },
            }));
          }
          setSyncStatus('synced');
        },
        (error) => handleFirestoreError(error, OperationType.GET, `users/${uid}`)
      );

      const unsubLessons = onSnapshot(
        query(collection(db, 'users', uid, 'lessons'), orderBy('updatedAt', 'desc')),
        (snap) => {
          if (!snap.empty) {
            const loaded: SimplifiedLesson[] = snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: d.id,
                topic: d.topic,
                title: d.title,
                subject: d.subject,
                level: d.level,
                language: d.language,
                readMinutes: d.readMinutes,
                summary: d.summary,
                definition: d.definition,
                coreMechanism: d.coreMechanism || [],
                examples: d.examples || [],
                analogies: d.analogies || [],
                keyTakeaways: d.keyTakeaways || [],
                groundedSources: d.groundedSources,
                sourceNoteName: d.sourceNoteName,
                isAiGenerated: d.isAiGenerated,
                createdAt: normalizeTimestamp(d.createdAt),
              };
            });
            setState((prev) => ({ ...prev, lessons: loaded }));
          }
        },
        (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/lessons`)
      );

      const unsubMastery = onSnapshot(
        collection(db, 'users', uid, 'mastery'),
        (snap) => {
          if (!snap.empty) {
            const loaded: TopicMasteryRecord[] = snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                topic: d.topic,
                subject: d.subject,
                correctAnswers: d.correctAnswers,
                attemptedQuestions: d.attemptedQuestions,
                previousScorePercent: d.previousScorePercent ?? null,
                latestScorePercent: d.latestScorePercent ?? null,
                lastPracticedAt: d.lastPracticedAt ?? null,
                strongConcepts: d.strongConcepts || [],
                weakConcepts: d.weakConcepts || [],
                revisionAdvice: d.revisionAdvice || '',
              };
            });
            setState((prev) => ({ ...prev, masteryRecords: loaded }));
          }
        },
        (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/mastery`)
      );

      const unsubAttempts = onSnapshot(
        query(collection(db, 'users', uid, 'quizAttempts'), orderBy('createdAt', 'desc')),
        (snap) => {
          if (!snap.empty) {
            const loaded: QuizAttempt[] = snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: d.id,
                topic: d.topic,
                correctCount: d.correctCount,
                totalQuestions: d.totalQuestions,
                scorePercent: d.scorePercent,
                timestamp: normalizeTimestamp(d.createdAt),
              };
            });
            setState((prev) => ({ ...prev, quizAttempts: loaded }));
          }
        },
        (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/quizAttempts`)
      );

      const unsubFocus = onSnapshot(
        query(collection(db, 'users', uid, 'focusSessions'), orderBy('createdAt', 'desc')),
        (snap) => {
          if (!snap.empty) {
            const loaded: FocusSession[] = snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: d.id,
                durationMinutes: d.durationMinutes,
                focusTopic: d.focusTopic,
                createdAt: normalizeTimestamp(d.createdAt),
              };
            });
            setState((prev) => ({ ...prev, focusSessions: loaded }));
          }
        },
        (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/focusSessions`)
      );

      const unsubTutor = onSnapshot(
        query(collection(db, 'users', uid, 'tutorThreads'), orderBy('updatedAt', 'desc')),
        (snap) => {
          if (!snap.empty) {
            const loaded: TutorThread[] = snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: d.id,
                title: d.title,
                roleId: d.roleId,
                modelId: d.modelId,
                useSearchGrounding: Boolean(d.useSearchGrounding),
                messages: d.messages || [],
                createdAt: normalizeTimestamp(d.createdAt),
                updatedAt: normalizeTimestamp(d.updatedAt),
              };
            });
            setState((prev) => ({ ...prev, tutorThreads: loaded }));
          }
        },
        (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/tutorThreads`)
      );

      const unsubExperiments = onSnapshot(
        query(collection(db, 'users', uid, 'experiments'), orderBy('createdAt', 'desc')),
        (snap) => {
          if (!snap.empty) {
            const loaded: ExperimentScenario[] = snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: d.id,
                question: d.question,
                title: d.title,
                domain: d.domain,
                summary: d.summary,
                predictions: d.predictions || [],
                parameters: d.parameters || [],
                outcomeExplanation: d.outcomeExplanation || [],
                realWorldApplications: d.realWorldApplications || [],
                chartSeries: d.chartSeries || [],
                isAiGenerated: d.isAiGenerated,
              };
            });
            setState((prev) => ({ ...prev, experiments: loaded }));
          }
        },
        (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/experiments`)
      );

      // Collaborative Study Rooms (open rooms visible to signed-in learners)
      const unsubOpenRooms = onSnapshot(
        query(collection(db, 'studyRooms'), where('visibility', '==', 'open')),
        (snap) => {
          const loaded = snap.docs
            .map((docSnap) => mapRoomDoc(docSnap.data()))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          setCloudRooms(loaded);
          setState((prev) => {
            const localUnpublished = prev.solutions.filter((s) => !s.isPublished);
            const cloudIds = new Set(loaded.map((c) => c.id));
            const merged = [
              ...loaded,
              ...localUnpublished.filter((l) => !cloudIds.has(l.id)),
            ];
            return {
              ...prev,
              solutions: merged.length > 0 ? merged : prev.solutions,
            };
          });
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'studyRooms')
      );

      unsubscribes = [
        unsubProfile,
        unsubLessons,
        unsubMastery,
        unsubAttempts,
        unsubFocus,
        unsubTutor,
        unsubExperiments,
        unsubOpenRooms,
      ];
    });

    return () => {
      unsubAuth();
      unsubscribes.forEach((u) => u());
    };
  }, []);

  // Listen to real-time contributions for the currently selected published Study Room
  useEffect(() => {
    if (!user) return;
    const activeRoom = state.solutions.find((s) => s.id === activeSolutionId);
    if (!activeRoom || !activeRoom.isPublished) return;

    const roomId = toSafeDocId(activeRoom.id, 'room');
    const contribPath = `studyRooms/${roomId}/contributions`;

    const unsubContrib = onSnapshot(
      query(collection(db, 'studyRooms', roomId, 'contributions'), orderBy('createdAt', 'asc')),
      (snap) => {
        const items: SolutionContribution[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: String(d.id || docSnap.id),
            roomId: String(d.roomId || roomId),
            authorUid: String(d.authorUid || ''),
            authorName: String(d.authorName || 'Collaborator'),
            kind: (d.kind as SolutionContribution['kind']) || 'peer-idea',
            text: String(d.text || ''),
            createdAt: normalizeTimestamp(d.createdAt),
          };
        });
        setState((prev) => ({
          ...prev,
          solutionContributions: {
            ...prev.solutionContributions,
            [activeRoom.id]: items,
          },
        }));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, contribPath)
    );

    return () => unsubContrib();
  }, [user, activeSolutionId, state.solutions.length]);

  const completeAndLogFocusMinutes = (minutes: number) => {
    const cleanMinutes = Math.max(1, Math.min(240, Math.round(minutes)));
    const currentTopic = focusTopicRef.current || 'General Study';
    const currentUser = userRef.current;

    const session: FocusSession = {
      id: `fs-${Date.now()}`,
      durationMinutes: cleanMinutes,
      focusTopic: currentTopic,
      createdAt: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      focusSessions: [session, ...prev.focusSessions],
      weeklyActivity: prev.weeklyActivity.map((day, idx) =>
        idx === prev.weeklyActivity.length - 1
          ? { ...day, minutes: day.minutes + cleanMinutes }
          : day
      ),
    }));

    setLastCompletedFocusNotice(
      `Logged ${cleanMinutes} min focus sprint${currentTopic ? ` on ${currentTopic}` : ''}.`
    );

    if (currentUser) {
      syncFocusSessionToCloud(currentUser.uid, session).catch(() => {});
    }
  };

  // Accurate wall-clock countdown interval for Focus Timer
  useEffect(() => {
    if (!focusRunning) {
      timerTargetEndRef.current = null;
      return;
    }

    timerTargetEndRef.current = Date.now() + focusRemainingSeconds * 1000;

    const interval = window.setInterval(() => {
      if (!timerTargetEndRef.current) return;
      const diffSec = Math.max(0, Math.ceil((timerTargetEndRef.current - Date.now()) / 1000));
      setFocusRemainingSeconds(diffSec);

      if (diffSec === 0) {
        window.clearInterval(interval);
        setFocusRunning(false);
        timerTargetEndRef.current = null;
        const completedMinutes = focusDurationRef.current;
        completeAndLogFocusMinutes(completedMinutes);
        setFocusRemainingSeconds(completedMinutes * 60);
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [focusRunning]);

  const setFocusDuration = (minutes: number) => {
    const clamped = Math.max(1, Math.min(120, Math.round(minutes) || 25));
    setFocusRunning(false);
    setFocusDurationMinutes(clamped);
    setFocusRemainingSeconds(clamped * 60);
    setLastCompletedFocusNotice(null);
  };

  const toggleFocusTimer = () => {
    setLastCompletedFocusNotice(null);
    setFocusRunning((prev) => !prev);
  };

  const resetFocusTimer = () => {
    setFocusRunning(false);
    setFocusRemainingSeconds(focusDurationMinutes * 60);
    setLastCompletedFocusNotice(null);
  };

  const logFocusSessionEarly = () => {
    const elapsedSeconds = focusDurationMinutes * 60 - focusRemainingSeconds;
    const elapsedMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    setFocusRunning(false);
    setFocusRemainingSeconds(focusDurationMinutes * 60);
    completeAndLogFocusMinutes(elapsedMinutes);
  };

  const dismissFocusNotice = () => setLastCompletedFocusNotice(null);

  const navigateToQuiz = (topic: string) => {
    setActiveQuizTopic(topic);
    setActiveScreen('quiz');
  };

  const navigateToSimplifier = (topic: string) => {
    const matching = stateRef.current.lessons.find(
      (l) => l.topic.toLowerCase() === topic.toLowerCase()
    );
    if (matching) {
      setActiveLessonId(matching.id);
    }
    setSimplifierDraftTopic(topic);
    setActiveScreen('simplifier');
  };

  const navigateToSolutionWithTopic = (topic: string) => {
    setSolutionDraftTopic(topic);
    setActiveScreen('solutions');
  };

  const addLesson = (lesson: SimplifiedLesson) => {
    const prevSnapshot = stateRef.current;
    const hasMastery = prevSnapshot.masteryRecords.some(
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

    setState((prev) => {
      const nextLessons = prev.settings.autoSaveLessons
        ? [lesson, ...prev.lessons.filter((l) => l.id !== lesson.id)]
        : [lesson, ...prev.lessons];

      const stillMissingMastery = !prev.masteryRecords.some(
        (m) => m.topic.toLowerCase() === lesson.topic.toLowerCase()
      );
      const nextMastery =
        createdMastery && stillMissingMastery
          ? [createdMastery, ...prev.masteryRecords]
          : prev.masteryRecords;

      return {
        ...prev,
        lessons: nextLessons,
        masteryRecords: nextMastery,
      };
    });
    setActiveLessonId(lesson.id);

    if (user) {
      syncLessonToCloud(user.uid, lesson).catch(() => {});
      if (createdMastery) {
        syncMasteryToCloud(user.uid, createdMastery).catch(() => {});
      }
    }
  };

  const saveQuizBank = (bank: QuizBank) => {
    setState((prev) => ({
      ...prev,
      quizBanks: {
        ...prev.quizBanks,
        [bank.topic]: bank,
      },
    }));
  };

  const recordQuizCompletion = (input: QuizSubmissionInput): QuizAttempt => {
    const scorePercent =
      calculateMasteryPercentage(input.correctCount, input.totalQuestions) ??
      Math.round((input.correctCount / Math.max(input.totalQuestions, 1)) * 100);

    const attempt: QuizAttempt = {
      id: `att-${Date.now()}`,
      topic: input.topic,
      correctCount: input.correctCount,
      totalQuestions: input.totalQuestions,
      scorePercent,
      timestamp: new Date().toISOString(),
    };

    const classification = classifyMastery(scorePercent, input.totalQuestions);

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

    const prevSnapshot = stateRef.current;
    const existingIdx = prevSnapshot.masteryRecords.findIndex(
      (m) => m.topic.toLowerCase() === input.topic.toLowerCase()
    );
    const computedLatest = calculateMasteryPercentage(input.correctCount, input.totalQuestions);

    const updatedMasteryRecord: TopicMasteryRecord =
      existingIdx >= 0
        ? {
            ...prevSnapshot.masteryRecords[existingIdx],
            subject: input.subject || prevSnapshot.masteryRecords[existingIdx].subject,
            correctAnswers: input.correctCount,
            attemptedQuestions: input.totalQuestions,
            previousScorePercent: prevSnapshot.masteryRecords[existingIdx].latestScorePercent,
            latestScorePercent: computedLatest,
            lastPracticedAt: attempt.timestamp,
            strongConcepts: input.strongConcepts,
            weakConcepts: input.weakConcepts,
            revisionAdvice,
          }
        : {
            topic: input.topic,
            subject: input.subject,
            correctAnswers: input.correctCount,
            attemptedQuestions: input.totalQuestions,
            previousScorePercent: null,
            latestScorePercent: computedLatest,
            lastPracticedAt: attempt.timestamp,
            strongConcepts: input.strongConcepts,
            weakConcepts: input.weakConcepts,
            revisionAdvice,
          };

    setState((prev) => {
      const idxInPrev = prev.masteryRecords.findIndex(
        (m) => m.topic.toLowerCase() === input.topic.toLowerCase()
      );
      let nextMastery: TopicMasteryRecord[];
      if (idxInPrev >= 0) {
        nextMastery = [...prev.masteryRecords];
        nextMastery[idxInPrev] = updatedMasteryRecord;
      } else {
        nextMastery = [updatedMasteryRecord, ...prev.masteryRecords];
      }

      const nextWeekly = prev.weeklyActivity.map((day, idx) =>
        idx === prev.weeklyActivity.length - 1
          ? {
              ...day,
              minutes: day.minutes + Math.max(5, input.totalQuestions * 2),
              quizzes: day.quizzes + 1,
            }
          : day
      );

      return {
        ...prev,
        quizAttempts: [attempt, ...prev.quizAttempts],
        masteryRecords: nextMastery,
        weeklyActivity: nextWeekly,
      };
    });

    if (user) {
      syncQuizAttemptToCloud(user.uid, attempt).catch(() => {});
      syncMasteryToCloud(user.uid, updatedMasteryRecord).catch(() => {});
    }

    return attempt;
  };

  const addExperiment = (experiment: ExperimentScenario) => {
    setState((prev) => ({
      ...prev,
      experiments: [experiment, ...prev.experiments],
    }));

    if (user) {
      syncExperimentToCloud(user.uid, experiment).catch(() => {});
    }
  };

  // --- Solution Studio & Study Room Actions ---

  const publishRoomToFirestore = async (room: SolutionProject) => {
    const firebaseUser = userRef.current;
    if (!firebaseUser) return;

    const roomId = toSafeDocId(room.id, 'room');
    const cleanCode =
      room.roomCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) ||
      `SB${String(Date.now()).slice(-4)}`;
    const roomPath = `studyRooms/${roomId}`;

    try {
      await setDoc(doc(db, 'studyRooms', roomId), {
        id: roomId,
        roomCode: cleanCode,
        ownerUid: firebaseUser.uid,
        ownerName: (firebaseUser.displayName || stateRef.current.settings.studentName || 'Learner').slice(
          0,
          80
        ),
        title: room.title.slice(0, 200),
        domain: room.domain.slice(0, 100),
        problemStatement: room.problemStatement.slice(0, 1200),
        targetCommunity: room.targetCommunity.slice(0, 240),
        constraints: room.constraints.slice(0, 600),
        ...(room.linkedTopic ? { linkedTopic: room.linkedTopic.slice(0, 160) } : {}),
        solutionSummary: room.solutionSummary.slice(0, 1800),
        feasibilityScore: Math.max(0, Math.min(100, Math.round(room.feasibilityScore || 75))),
        aiIntegrationPlan: room.aiIntegrationPlan.slice(0, 1500),
        buildPhases: room.buildPhases.slice(0, 10),
        impactMetrics: room.impactMetrics.slice(0, 10),
        tasks: room.tasks.slice(0, 20),
        risks: room.risks.slice(0, 10),
        visibility: room.visibility === 'invite' ? 'invite' : 'open',
        memberUids: [],
        endorseUids: [],
        isAiGenerated: Boolean(room.isAiGenerated),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, roomPath);
    }
  };

  const createSolution = async (solution: SolutionProject, publishToCloud = false) => {
    const shouldPublish = Boolean(publishToCloud && userRef.current);
    const enriched: SolutionProject = {
      ...solution,
      ownerUid: shouldPublish && userRef.current ? userRef.current.uid : solution.ownerUid,
      ownerName:
        shouldPublish && userRef.current?.displayName
          ? userRef.current.displayName
          : solution.ownerName,
      isPublished: shouldPublish,
    };

    setState((prev) => ({
      ...prev,
      solutions: [enriched, ...prev.solutions],
    }));
    setActiveSolutionId(enriched.id);

    if (shouldPublish) {
      await publishRoomToFirestore(enriched);
    }
  };

  const publishSolutionToRoom = async (solutionId: string) => {
    const firebaseUser = userRef.current;
    if (!firebaseUser) {
      throw new Error('Sign in with Google to publish and collaborate live in Firestore.');
    }
    const target = stateRef.current.solutions.find((s) => s.id === solutionId);
    if (!target) return;

    const updated: SolutionProject = {
      ...target,
      ownerUid: firebaseUser.uid,
      ownerName: firebaseUser.displayName || stateRef.current.settings.studentName || 'Learner',
      isPublished: true,
      updatedAt: new Date().toISOString(),
    };

    await publishRoomToFirestore(updated);

    setState((prev) => ({
      ...prev,
      solutions: prev.solutions.map((s) => (s.id === solutionId ? updated : s)),
    }));
  };

  const joinStudyRoomByCode = async (
    rawCode: string
  ): Promise<{ ok: boolean; message: string }> => {
    const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) {
      return { ok: false, message: 'Enter a Study Room code (e.g., BIO4821).' };
    }

    const localMatch = stateRef.current.solutions.find(
      (s) => s.roomCode.toUpperCase() === code
    );
    if (localMatch && !userRef.current) {
      setActiveSolutionId(localMatch.id);
      return { ok: true, message: `Opened local room "${localMatch.title}" (${code}).` };
    }

    if (!userRef.current) {
      return {
        ok: false,
        message: 'Room code not found locally. Sign in with Google to search and join shared Firestore study rooms.',
      };
    }

    try {
      const q = query(
        collection(db, 'studyRooms'),
        where('visibility', '==', 'open'),
        where('roomCode', '==', code)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        if (localMatch) {
          setActiveSolutionId(localMatch.id);
          return { ok: true, message: `Opened room "${localMatch.title}" (${code}).` };
        }
        return {
          ok: false,
          message: `No open Study Room found with code "${code}".`,
        };
      }

      const roomDoc = snap.docs[0];
      const room = mapRoomDoc(roomDoc.data());
      const uid = userRef.current.uid;

      if (room.ownerUid !== uid && !room.memberUids.includes(uid)) {
        const nextMembers = [...room.memberUids, uid].slice(0, 20);
        await updateDoc(doc(db, 'studyRooms', room.id), {
          memberUids: nextMembers,
          updatedAt: serverTimestamp(),
        });
        room.memberUids = nextMembers;
      }

      setState((prev) => ({
        ...prev,
        solutions: [room, ...prev.solutions.filter((s) => s.id !== room.id)],
      }));
      setActiveSolutionId(room.id);
      return { ok: true, message: `Joined "${room.title}" (${room.roomCode}).` };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'studyRooms');
      return { ok: false, message: 'Unable to join room.' };
    }
  };

  const toggleSolutionTask = async (solutionId: string, taskId: string) => {
    const target = stateRef.current.solutions.find((s) => s.id === solutionId);
    if (!target) return;

    const actorName =
      userRef.current?.displayName || stateRef.current.settings.studentName || 'Learner';
    const nextTasks = target.tasks.map((t) => {
      if (t.id !== taskId) return t;
      const nextCompleted = !t.completed;
      return {
        ...t,
        completed: nextCompleted,
        assigneeName: nextCompleted ? actorName : t.assigneeName,
      };
    });

    setState((prev) => ({
      ...prev,
      solutions: prev.solutions.map((s) =>
        s.id === solutionId
          ? { ...s, tasks: nextTasks, updatedAt: new Date().toISOString() }
          : s
      ),
    }));

    if (userRef.current && target.isPublished) {
      const roomId = toSafeDocId(target.id, 'room');
      try {
        await updateDoc(doc(db, 'studyRooms', roomId), {
          tasks: nextTasks.slice(0, 20),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `studyRooms/${roomId}`);
      }
    }
  };

  const endorseSolution = async (solutionId: string) => {
    const target = stateRef.current.solutions.find((s) => s.id === solutionId);
    if (!target) return;

    const actorId = userRef.current?.uid || 'guest';
    const alreadyEndorsed = target.endorseUids.includes(actorId);
    const nextEndorse = alreadyEndorsed
      ? target.endorseUids.filter((id) => id !== actorId)
      : [...target.endorseUids, actorId].slice(0, 25);

    setState((prev) => ({
      ...prev,
      solutions: prev.solutions.map((s) =>
        s.id === solutionId
          ? { ...s, endorseUids: nextEndorse, updatedAt: new Date().toISOString() }
          : s
      ),
    }));

    if (userRef.current && target.isPublished) {
      const roomId = toSafeDocId(target.id, 'room');
      try {
        await updateDoc(doc(db, 'studyRooms', roomId), {
          endorseUids: nextEndorse,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `studyRooms/${roomId}`);
      }
    }
  };

  const addSolutionContribution = async (
    solutionId: string,
    kind: SolutionContribution['kind'],
    text: string
  ) => {
    const cleanText = text.trim();
    if (!cleanText) return;
    const target = stateRef.current.solutions.find((s) => s.id === solutionId);
    if (!target) return;

    const firebaseUser = userRef.current;
    const contribId = `c-${Date.now()}`;
    const entry: SolutionContribution = {
      id: contribId,
      roomId: target.id,
      authorUid: firebaseUser?.uid || 'guest',
      authorName: firebaseUser?.displayName || stateRef.current.settings.studentName || 'Learner',
      kind,
      text: cleanText.slice(0, 1500),
      createdAt: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      solutionContributions: {
        ...prev.solutionContributions,
        [solutionId]: [...(prev.solutionContributions[solutionId] || []), entry],
      },
    }));

    if (firebaseUser && target.isPublished) {
      const roomId = toSafeDocId(target.id, 'room');
      const path = `studyRooms/${roomId}/contributions/${contribId}`;
      try {
        await setDoc(doc(db, 'studyRooms', roomId, 'contributions', contribId), {
          id: contribId,
          roomId,
          roomOwnerUid: target.ownerUid,
          roomVisibility: target.visibility,
          authorUid: firebaseUser.uid,
          authorName: entry.authorName.slice(0, 80),
          kind,
          text: entry.text,
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    }
  };

  const applySolutionIteration = async (
    solutionId: string,
    patch: Partial<
      Pick<
        SolutionProject,
        | 'solutionSummary'
        | 'feasibilityScore'
        | 'aiIntegrationPlan'
        | 'buildPhases'
        | 'impactMetrics'
        | 'tasks'
        | 'risks'
      >
    >,
    iterationNote: string
  ) => {
    const target = stateRef.current.solutions.find((s) => s.id === solutionId);
    if (!target) return;

    const updated: SolutionProject = {
      ...target,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      solutions: prev.solutions.map((s) => (s.id === solutionId ? updated : s)),
    }));

    if (
      userRef.current &&
      target.isPublished &&
      target.ownerUid === userRef.current.uid
    ) {
      const roomId = toSafeDocId(target.id, 'room');
      try {
        await updateDoc(doc(db, 'studyRooms', roomId), {
          solutionSummary: updated.solutionSummary.slice(0, 1800),
          feasibilityScore: Math.max(0, Math.min(100, Math.round(updated.feasibilityScore || 75))),
          aiIntegrationPlan: updated.aiIntegrationPlan.slice(0, 1500),
          buildPhases: updated.buildPhases.slice(0, 10),
          impactMetrics: updated.impactMetrics.slice(0, 10),
          tasks: updated.tasks.slice(0, 20),
          risks: updated.risks.slice(0, 10),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `studyRooms/${roomId}`);
      }
    }

    if (iterationNote.trim()) {
      await addSolutionContribution(solutionId, 'ai-critique', iterationNote.trim());
    }
  };

  // --- Study Tutor Actions ---

  const createTutorThread = (
    roleId: TutorRoleId = 'socratic',
    modelId: TutorModelId = 'gemini-4-hydrogen'
  ): TutorThread => {
    const now = new Date().toISOString();
    const thread: TutorThread = {
      id: `thread-${Date.now()}`,
      title: 'New Study Session',
      roleId,
      modelId,
      useSearchGrounding: false,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    setState((prev) => ({
      ...prev,
      tutorThreads: [thread, ...prev.tutorThreads],
    }));
    setActiveTutorThreadId(thread.id);
    if (user) {
      syncTutorThreadToCloud(user.uid, thread).catch(() => {});
    }
    return thread;
  };

  const updateTutorThreadConfig = (
    threadId: string,
    patch: Partial<Pick<TutorThread, 'roleId' | 'modelId' | 'useSearchGrounding' | 'title'>>
  ) => {
    const existing = stateRef.current.tutorThreads.find((t) => t.id === threadId);
    const updatedThread: TutorThread | null = existing
      ? {
          ...existing,
          ...patch,
          updatedAt: new Date().toISOString(),
        }
      : null;

    setState((prev) => ({
      ...prev,
      tutorThreads: prev.tutorThreads.map((t) =>
        t.id === threadId && updatedThread ? updatedThread : t
      ),
    }));

    if (user && updatedThread) {
      syncTutorThreadToCloud(user.uid, updatedThread).catch(() => {});
    }
  };

  const appendTutorTurn = (
    threadId: string,
    userMessage: TutorMessage,
    assistantMessage: TutorMessage
  ) => {
    const existing = stateRef.current.tutorThreads.find((t) => t.id === threadId);
    const nextTitle = existing
      ? existing.messages.length === 0
        ? userMessage.text.slice(0, 48).trim() || existing.title
        : existing.title
      : 'Study Session';
    const updatedThread: TutorThread | null = existing
      ? {
          ...existing,
          title: nextTitle,
          messages: [...existing.messages, userMessage, assistantMessage].slice(-60),
          updatedAt: new Date().toISOString(),
        }
      : null;

    setState((prev) => ({
      ...prev,
      tutorThreads: prev.tutorThreads.map((t) =>
        t.id === threadId && updatedThread ? updatedThread : t
      ),
    }));

    if (user && updatedThread) {
      syncTutorThreadToCloud(user.uid, updatedThread).catch(() => {});
    }
  };

  const updateSettings = (patch: Partial<StudentSettings>) => {
    const mergedSettings: StudentSettings = {
      ...stateRef.current.settings,
      ...patch,
    };

    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...patch },
    }));

    if (user) {
      const uid = user.uid;
      const safeName = mergedSettings.studentName.trim() || 'Learner';
      const safeFocus = mergedSettings.academicFocus.trim() || 'STEM Foundations';
      updateDoc(doc(db, 'users', uid), {
        displayName: safeName.slice(0, 80),
        academicFocus: safeFocus.slice(0, 120),
        defaultLevel: mergedSettings.defaultLevel,
        defaultLanguage: mergedSettings.defaultLanguage.slice(0, 40),
        weeklyQuizGoal: Math.max(1, Math.min(100, Math.round(mergedSettings.weeklyQuizGoal))),
        showInstantFeedback: Boolean(mergedSettings.showInstantFeedback),
        autoSaveLessons: Boolean(mergedSettings.autoSaveLessons),
        updatedAt: serverTimestamp(),
      }).catch((error) => handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`));
    }
  };

  const resetAllData = () => {
    const fresh: PersistedState = {
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
    setState(fresh);
    setActiveLessonId(INITIAL_LESSONS[0].id);
    setActiveQuizTopic('Photosynthesis & Calvin Cycle');
    setActiveTutorThreadId(INITIAL_TUTOR_THREADS[0].id);
    setActiveSolutionId(INITIAL_SOLUTIONS[0].id);
    localStorage.removeItem(STORAGE_KEY);
  };

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      setAuthError(msg);
      throw err;
    }
  };

  const signOutUser = async () => {
    setAuthError(null);
    await signOut(auth);
  };

  return (
    <StudyContext.Provider
      value={{
        ...state,
        activeScreen,
        setActiveScreen,
        activeQuizTopic,
        setActiveQuizTopic,
        activeLessonId,
        setActiveLessonId,
        simplifierDraftTopic,
        setSimplifierDraftTopic,
        activeSolutionId,
        setActiveSolutionId,
        solutionDraftTopic,
        setSolutionDraftTopic,
        navigateToQuiz,
        navigateToSimplifier,
        navigateToSolutionWithTopic,
        addLesson,
        saveQuizBank,
        recordQuizCompletion,
        addExperiment,
        updateSettings,
        resetAllData,

        cloudRooms,
        createSolution,
        publishSolutionToRoom,
        joinStudyRoomByCode,
        toggleSolutionTask,
        endorseSolution,
        applySolutionIteration,
        addSolutionContribution,

        focusDurationMinutes,
        focusRemainingSeconds,
        focusRunning,
        focusTopic,
        lastCompletedFocusNotice,
        setFocusDuration,
        setFocusTopic,
        toggleFocusTimer,
        resetFocusTimer,
        logFocusSessionEarly,
        dismissFocusNotice,

        activeTutorThreadId,
        setActiveTutorThreadId,
        createTutorThread,
        updateTutorThreadConfig,
        appendTutorTurn,

        authReady,
        user,
        syncStatus,
        authError,
        signInWithGoogle,
        signOutUser,
      }}
    >
      {children}
    </StudyContext.Provider>
  );
}

export function useStudy() {
  const ctx = useContext(StudyContext);
  if (!ctx) {
    throw new Error('useStudy must be used inside StudyProvider');
  }
  return ctx;
}
