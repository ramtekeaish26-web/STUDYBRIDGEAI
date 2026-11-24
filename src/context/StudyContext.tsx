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
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, googleProvider, testConnection } from '../firebase';
import {
  INITIAL_FOCUS_SESSIONS,
  INITIAL_LESSONS,
  INITIAL_QUIZ_ATTEMPTS,
  INITIAL_QUIZ_BANKS,
  INITIAL_SETTINGS,
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

const STORAGE_KEY = 'studybridge_state_v2';

interface PersistedState {
  lessons: SimplifiedLesson[];
  quizBanks: Record<string, QuizBank>;
  masteryRecords: TopicMasteryRecord[];
  quizAttempts: QuizAttempt[];
  experiments: ExperimentScenario[];
  weeklyActivity: WeeklyStudyDay[];
  focusSessions: FocusSession[];
  tutorThreads: TutorThread[];
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
  navigateToQuiz: (topic: string) => void;
  navigateToSimplifier: (topic: string) => void;
  addLesson: (lesson: SimplifiedLesson) => void;
  saveQuizBank: (bank: QuizBank) => void;
  recordQuizCompletion: (input: QuizSubmissionInput) => QuizAttempt;
  addExperiment: (experiment: ExperimentScenario) => void;
  updateSettings: (patch: Partial<StudentSettings>) => void;
  resetAllData: () => void;

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
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('studybridge_state_v1');
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
    settings: INITIAL_SETTINGS,
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
  const stateRef = useRef<PersistedState>(state);
  stateRef.current = state;

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
          displayName: (firebaseUser.displayName || snapshot.settings.studentName || 'Learner').slice(0, 80),
          email: (firebaseUser.email || '').slice(0, 160),
          academicFocus: snapshot.settings.academicFocus.slice(0, 120),
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

      unsubscribes = [
        unsubProfile,
        unsubLessons,
        unsubMastery,
        unsubAttempts,
        unsubFocus,
        unsubTutor,
        unsubExperiments,
      ];
    });

    return () => {
      unsubAuth();
      unsubscribes.forEach((u) => u());
    };
  }, []);

  const completeAndLogFocusMinutes = (minutes: number) => {
    const cleanMinutes = Math.max(1, Math.min(240, Math.round(minutes)));
    const session: FocusSession = {
      id: `fs-${Date.now()}`,
      durationMinutes: cleanMinutes,
      focusTopic: focusTopic || 'General Study',
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
      `Logged ${cleanMinutes} min focus sprint${focusTopic ? ` on ${focusTopic}` : ''}.`
    );

    if (user) {
      syncFocusSessionToCloud(user.uid, session).catch(() => {});
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
        completeAndLogFocusMinutes(focusDurationMinutes);
        setFocusRemainingSeconds(focusDurationMinutes * 60);
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
    const matching = state.lessons.find(
      (l) => l.topic.toLowerCase() === topic.toLowerCase()
    );
    if (matching) {
      setActiveLessonId(matching.id);
    }
    setSimplifierDraftTopic(topic);
    setActiveScreen('simplifier');
  };

  const addLesson = (lesson: SimplifiedLesson) => {
    let createdMastery: TopicMasteryRecord | null = null;

    setState((prev) => {
      const nextLessons = prev.settings.autoSaveLessons
        ? [lesson, ...prev.lessons.filter((l) => l.id !== lesson.id)]
        : [lesson, ...prev.lessons];

      const hasMastery = prev.masteryRecords.some(
        (m) => m.topic.toLowerCase() === lesson.topic.toLowerCase()
      );

      if (!hasMastery) {
        createdMastery = {
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
      }

      const nextMastery = createdMastery
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

    let updatedMasteryRecord: TopicMasteryRecord | null = null;

    setState((prev) => {
      const existingIdx = prev.masteryRecords.findIndex(
        (m) => m.topic.toLowerCase() === input.topic.toLowerCase()
      );

      let nextMastery: TopicMasteryRecord[];
      if (existingIdx >= 0) {
        const existing = prev.masteryRecords[existingIdx];
        const updated: TopicMasteryRecord = {
          ...existing,
          subject: input.subject || existing.subject,
          correctAnswers: input.correctCount,
          attemptedQuestions: input.totalQuestions,
          previousScorePercent: existing.latestScorePercent,
          latestScorePercent: calculateMasteryPercentage(
            input.correctCount,
            input.totalQuestions
          ),
          lastPracticedAt: attempt.timestamp,
          strongConcepts: input.strongConcepts,
          weakConcepts: input.weakConcepts,
          revisionAdvice,
        };
        updatedMasteryRecord = updated;
        nextMastery = [...prev.masteryRecords];
        nextMastery[existingIdx] = updated;
      } else {
        const created: TopicMasteryRecord = {
          topic: input.topic,
          subject: input.subject,
          correctAnswers: input.correctCount,
          attemptedQuestions: input.totalQuestions,
          previousScorePercent: null,
          latestScorePercent: calculateMasteryPercentage(
            input.correctCount,
            input.totalQuestions
          ),
          lastPracticedAt: attempt.timestamp,
          strongConcepts: input.strongConcepts,
          weakConcepts: input.weakConcepts,
          revisionAdvice,
        };
        updatedMasteryRecord = created;
        nextMastery = [created, ...prev.masteryRecords];
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
      if (updatedMasteryRecord) {
        syncMasteryToCloud(user.uid, updatedMasteryRecord).catch(() => {});
      }
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
    let updatedThread: TutorThread | null = null;
    setState((prev) => ({
      ...prev,
      tutorThreads: prev.tutorThreads.map((t) => {
        if (t.id !== threadId) return t;
        updatedThread = {
          ...t,
          ...patch,
          updatedAt: new Date().toISOString(),
        };
        return updatedThread;
      }),
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
    let updatedThread: TutorThread | null = null;
    setState((prev) => ({
      ...prev,
      tutorThreads: prev.tutorThreads.map((t) => {
        if (t.id !== threadId) return t;
        const nextTitle =
          t.messages.length === 0
            ? userMessage.text.slice(0, 48).trim() || t.title
            : t.title;
        updatedThread = {
          ...t,
          title: nextTitle,
          messages: [...t.messages, userMessage, assistantMessage].slice(-60),
          updatedAt: new Date().toISOString(),
        };
        return updatedThread;
      }),
    }));
    if (user && updatedThread) {
      syncTutorThreadToCloud(user.uid, updatedThread).catch(() => {});
    }
  };

  const updateSettings = (patch: Partial<StudentSettings>) => {
    let mergedSettings: StudentSettings | null = null;
    setState((prev) => {
      mergedSettings = { ...prev.settings, ...patch };
      return {
        ...prev,
        settings: mergedSettings,
      };
    });

    if (user && mergedSettings) {
      const s = mergedSettings as StudentSettings;
      const uid = user.uid;
      updateDoc(doc(db, 'users', uid), {
        displayName: s.studentName.slice(0, 80),
        academicFocus: s.academicFocus.slice(0, 120),
        defaultLevel: s.defaultLevel,
        defaultLanguage: s.defaultLanguage.slice(0, 40),
        weeklyQuizGoal: Math.max(1, Math.min(100, Math.round(s.weeklyQuizGoal))),
        showInstantFeedback: Boolean(s.showInstantFeedback),
        autoSaveLessons: Boolean(s.autoSaveLessons),
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
      settings: INITIAL_SETTINGS,
    };
    setState(fresh);
    setActiveLessonId(INITIAL_LESSONS[0].id);
    setActiveQuizTopic('Photosynthesis & Calvin Cycle');
    setActiveTutorThreadId(INITIAL_TUTOR_THREADS[0].id);
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
        navigateToQuiz,
        navigateToSimplifier,
        addLesson,
        saveQuizBank,
        recordQuizCompletion,
        addExperiment,
        updateSettings,
        resetAllData,

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
