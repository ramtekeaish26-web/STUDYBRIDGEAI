import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createUniqueId,
  generateRoomCode,
  loadPersistedState,
  createInitialSampleState,
  addLessonToState,
  applyQuizCompletionToState,
  logFocusMinutesInState,
  computeTodayFocusMinutes,
  toggleSolutionTaskInState,
  endorseSolutionInState,
  appendTutorTurnInState,
  createTutorThreadRecord,
  STORAGE_KEY,
  PersistedState,
} from '../src/utils/studyState';
import { SimplifiedLesson, TutorMessage } from '../src/types/study';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeSampleState(): PersistedState {
  const base = createInitialSampleState();
  return {
    ...base,
    settings: { ...base.settings, autoSaveLessons: true },
  };
}

function makeSampleLesson(overrides: Partial<SimplifiedLesson> = {}): SimplifiedLesson {
  return {
    id: 'lesson-test-1',
    topic: 'Unit Testing',
    title: 'Introduction to Unit Testing',
    subject: 'Computer Science',
    level: 'Beginner',
    language: 'English',
    readMinutes: 5,
    summary: 'Learn the basics of unit testing.',
    definition: 'Unit testing validates individual units of source code.',
    coreMechanism: ['Arrange', 'Act', 'Assert'],
    examples: [{ title: 'Simple Assert', detail: 'assert.equal(1+1, 2)' }],
    analogies: [{ concept: 'Unit Test', comparison: 'Like spell-checking one paragraph' }],
    keyTakeaways: ['Test early', 'Test often'],
    createdAt: new Date().toISOString(),
    isAiGenerated: true,
    ...overrides,
  };
}

function makeTutorMsg(role: 'user' | 'model', text: string): TutorMessage {
  return {
    id: createUniqueId('msg'),
    role,
    text,
    createdAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  createUniqueId                                                    */
/* ------------------------------------------------------------------ */

test('createUniqueId produces unique values with correct prefix', () => {
  const a = createUniqueId('quiz');
  const b = createUniqueId('quiz');
  const c = createUniqueId();
  assert.ok(a.startsWith('quiz-'), `should start with prefix, got: ${a}`);
  assert.ok(c.startsWith('id-'), `default prefix should be "id", got: ${c}`);
  assert.notEqual(a, b, 'successive calls should produce different ids');
});

/* ------------------------------------------------------------------ */
/*  generateRoomCode                                                  */
/* ------------------------------------------------------------------ */

test('generateRoomCode returns 3 uppercase letters + 4 digits', () => {
  for (let i = 0; i < 20; i++) {
    const code = generateRoomCode();
    assert.match(code, /^[A-Z]{3}\d{4}$/, `Room code format invalid: ${code}`);
    assert.equal(code.length, 7);
  }
  // Uniqueness spot check
  const codes = new Set(Array.from({ length: 50 }, () => generateRoomCode()));
  assert.ok(codes.size >= 40, 'Should generate mostly unique codes in 50 tries');
});

/* ------------------------------------------------------------------ */
/*  loadPersistedState                                                */
/* ------------------------------------------------------------------ */

test('loadPersistedState returns sample data when storage is empty', () => {
  const mockStorage = { getItem: () => null };
  const state = loadPersistedState(mockStorage);
  assert.ok(state.lessons.length > 0, 'should have sample lessons');
  assert.ok(state.settings.studentName.length > 0, 'should have student name');
});

test('loadPersistedState loads valid persisted data from v3 key', () => {
  const seed = createInitialSampleState();
  seed.settings.studentName = 'Alice';
  const mockStorage = {
    getItem: (key: string) => (key === STORAGE_KEY ? JSON.stringify(seed) : null),
  };
  const state = loadPersistedState(mockStorage);
  assert.equal(state.settings.studentName, 'Alice');
});

test('loadPersistedState falls back to sample on corrupt JSON', () => {
  const mockStorage = { getItem: () => '{{{invalid json' };
  const state = loadPersistedState(mockStorage);
  assert.ok(state.lessons.length > 0, 'should fall back to sample data');
});

test('loadPersistedState falls back when missing required fields', () => {
  const incomplete = JSON.stringify({ lessons: [], settings: { studentName: 'Bob' } });
  const mockStorage = { getItem: () => incomplete };
  // Missing masteryRecords so condition fails → falls back to sample
  const state = loadPersistedState(mockStorage);
  // Sample data has masteryRecords
  assert.ok(state.masteryRecords.length > 0);
});

/* ------------------------------------------------------------------ */
/*  addLessonToState                                                  */
/* ------------------------------------------------------------------ */

test('addLessonToState saves lesson when autoSaveLessons is true', () => {
  const state = makeSampleState();
  const lesson = makeSampleLesson();
  const { nextState, createdMastery, saved } = addLessonToState(state, lesson);
  assert.ok(saved, 'lesson should be saved');
  assert.ok(nextState.lessons.some((l) => l.id === lesson.id), 'lesson should appear in state');
  // A new topic should create a mastery record
  assert.ok(createdMastery !== null, 'should create mastery record for new topic');
  assert.equal(createdMastery!.topic, 'Unit Testing');
  assert.equal(createdMastery!.correctAnswers, 0);
});

test('addLessonToState does NOT save when autoSaveLessons is false', () => {
  const state = makeSampleState();
  state.settings.autoSaveLessons = false;
  const lesson = makeSampleLesson();
  const { nextState, saved } = addLessonToState(state, lesson);
  assert.ok(!saved, 'lesson should not be saved');
  assert.equal(nextState, state, 'state should be unchanged');
});

test('addLessonToState does not duplicate mastery record for existing topic', () => {
  const state = makeSampleState();
  // Pick an existing topic from seed data
  const existingTopic = state.masteryRecords[0].topic;
  const lesson = makeSampleLesson({ topic: existingTopic });
  const { createdMastery } = addLessonToState(state, lesson);
  assert.equal(createdMastery, null, 'should not create duplicate mastery');
});

/* ------------------------------------------------------------------ */
/*  applyQuizCompletionToState                                        */
/* ------------------------------------------------------------------ */

test('applyQuizCompletionToState updates mastery, attempt, and weekly activity', () => {
  const state = makeSampleState();
  const { nextState, attempt, updatedMasteryRecord } = applyQuizCompletionToState(state, {
    topic: 'Photosynthesis & Calvin Cycle',
    subject: 'Biology',
    correctCount: 4,
    totalQuestions: 5,
    strongConcepts: ['Light reactions'],
    weakConcepts: ['Carbon fixation'],
  });

  assert.equal(attempt.correctCount, 4);
  assert.equal(attempt.totalQuestions, 5);
  assert.equal(attempt.scorePercent, 80);
  assert.ok(attempt.id.startsWith('att-'));

  // Mastery record updated
  assert.equal(updatedMasteryRecord.topic, 'Photosynthesis & Calvin Cycle');
  assert.equal(updatedMasteryRecord.latestScorePercent, 80);
  assert.deepEqual(updatedMasteryRecord.strongConcepts, ['Light reactions']);

  // Attempt is prepended
  assert.equal(nextState.quizAttempts[0].id, attempt.id);

  // Weekly activity last day updated
  const lastDay = nextState.weeklyActivity[nextState.weeklyActivity.length - 1];
  const originalLastDay = state.weeklyActivity[state.weeklyActivity.length - 1];
  assert.equal(lastDay.quizzes, originalLastDay.quizzes + 1);
  assert.ok(lastDay.minutes > originalLastDay.minutes);
});

test('applyQuizCompletionToState creates new mastery for unknown topic', () => {
  const state = makeSampleState();
  const { updatedMasteryRecord, nextState } = applyQuizCompletionToState(state, {
    topic: 'Quantum Computing',
    subject: 'Physics',
    correctCount: 3,
    totalQuestions: 5,
    strongConcepts: [],
    weakConcepts: ['Qubits'],
  });
  assert.equal(updatedMasteryRecord.topic, 'Quantum Computing');
  assert.equal(updatedMasteryRecord.previousScorePercent, null);
  // Should be prepended to records
  assert.equal(nextState.masteryRecords[0].topic, 'Quantum Computing');
});

test('applyQuizCompletionToState clamps and rounds correctCount/totalQuestions', () => {
  const state = makeSampleState();
  const { attempt } = applyQuizCompletionToState(state, {
    topic: 'Clamping Test',
    subject: 'Math',
    correctCount: 12,     // greater than totalQuestions
    totalQuestions: 5,
    strongConcepts: [],
    weakConcepts: [],
  });
  assert.equal(attempt.correctCount, 5, 'correctCount clamped to totalQuestions');
  assert.equal(attempt.totalQuestions, 5);
});

/* ------------------------------------------------------------------ */
/*  logFocusMinutesInState                                            */
/* ------------------------------------------------------------------ */

test('logFocusMinutesInState creates session and updates weekly activity', () => {
  const state = makeSampleState();
  const { nextState, session } = logFocusMinutesInState(state, 25, 'Biology Review');
  assert.equal(session.durationMinutes, 25);
  assert.equal(session.focusTopic, 'Biology Review');
  assert.ok(session.id.startsWith('fs-'));
  assert.equal(nextState.focusSessions[0].id, session.id);

  const lastDay = nextState.weeklyActivity[nextState.weeklyActivity.length - 1];
  const originalLastDay = state.weeklyActivity[state.weeklyActivity.length - 1];
  assert.equal(lastDay.minutes, originalLastDay.minutes + 25);
});

test('logFocusMinutesInState clamps minutes to 1-240 range', () => {
  const state = makeSampleState();
  const { session: s1 } = logFocusMinutesInState(state, 0, '');
  assert.equal(s1.durationMinutes, 1, 'minimum clamped to 1');
  assert.equal(s1.focusTopic, 'General Study', 'empty topic defaults');

  const { session: s2 } = logFocusMinutesInState(state, 999, 'Marathon');
  assert.equal(s2.durationMinutes, 240, 'maximum clamped to 240');
});

/* ------------------------------------------------------------------ */
/*  computeTodayFocusMinutes                                          */
/* ------------------------------------------------------------------ */

test('computeTodayFocusMinutes sums only sessions from the reference date', () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const sessions = [
    { id: 'a', durationMinutes: 10, focusTopic: 'X', createdAt: today.toISOString() },
    { id: 'b', durationMinutes: 20, focusTopic: 'Y', createdAt: today.toISOString() },
    { id: 'c', durationMinutes: 50, focusTopic: 'Z', createdAt: yesterday.toISOString() },
  ];

  assert.equal(computeTodayFocusMinutes(sessions, today), 30, 'only today sessions summed');
  assert.equal(computeTodayFocusMinutes(sessions, yesterday), 50, 'yesterday session isolated');
  assert.equal(computeTodayFocusMinutes([], today), 0, 'empty array returns 0');
});

test('computeTodayFocusMinutes handles invalid date strings', () => {
  const sessions = [
    { id: 'x', durationMinutes: 10, focusTopic: 'A', createdAt: 'not-a-date' },
  ];
  assert.equal(computeTodayFocusMinutes(sessions, new Date()), 0, 'invalid dates skipped');
});

/* ------------------------------------------------------------------ */
/*  toggleSolutionTaskInState                                         */
/* ------------------------------------------------------------------ */

test('toggleSolutionTaskInState toggles task completion and assigns name', () => {
  const state = makeSampleState();
  const sol = state.solutions[0];
  assert.ok(sol.tasks.length > 0, 'sample solution should have tasks');

  const task = sol.tasks[0];
  const wasCompleted = task.completed;

  const { nextState, nextTasks } = toggleSolutionTaskInState(
    state,
    sol.id,
    task.id,
    'TestUser'
  );

  assert.ok(nextTasks, 'should return tasks');
  const updated = nextTasks!.find((t) => t.id === task.id)!;
  assert.equal(updated.completed, !wasCompleted, 'completion toggled');

  if (!wasCompleted) {
    assert.equal(updated.assigneeName, 'TestUser', 'assignee set on completion');
  }

  // State was updated
  const updatedSol = nextState.solutions.find((s) => s.id === sol.id)!;
  assert.ok(updatedSol.updatedAt.length > 0);
});

test('toggleSolutionTaskInState returns unchanged state for missing solution', () => {
  const state = makeSampleState();
  const { nextState, target } = toggleSolutionTaskInState(state, 'nonexistent', 't1', 'User');
  assert.equal(nextState, state);
  assert.equal(target, undefined);
});

/* ------------------------------------------------------------------ */
/*  endorseSolutionInState                                            */
/* ------------------------------------------------------------------ */

test('endorseSolutionInState adds and removes endorsement', () => {
  const state = makeSampleState();
  const sol = state.solutions[0];

  // Add endorsement
  const { nextState: s1, nextEndorse: e1 } = endorseSolutionInState(state, sol.id, 'user-abc');
  assert.ok(e1!.includes('user-abc'), 'user added to endorseUids');

  // Remove endorsement
  const { nextEndorse: e2 } = endorseSolutionInState(s1, sol.id, 'user-abc');
  assert.ok(!e2!.includes('user-abc'), 'user removed from endorseUids');
});

test('endorseSolutionInState caps endorsements at 25', () => {
  const state = makeSampleState();
  const sol = state.solutions[0];
  // Fill up with 24 fake UIDs
  const stuffed: PersistedState = {
    ...state,
    solutions: state.solutions.map((s) =>
      s.id === sol.id
        ? { ...s, endorseUids: Array.from({ length: 24 }, (_, i) => `u${i}`) }
        : s
    ),
  };
  const { nextEndorse } = endorseSolutionInState(stuffed, sol.id, 'u-new');
  assert.ok(nextEndorse!.length <= 25, 'endorseUids capped at 25');
});

test('endorseSolutionInState returns unchanged state for missing solution', () => {
  const state = makeSampleState();
  const { nextState } = endorseSolutionInState(state, 'nonexistent', 'uid');
  assert.equal(nextState, state);
});

/* ------------------------------------------------------------------ */
/*  appendTutorTurnInState                                            */
/* ------------------------------------------------------------------ */

test('appendTutorTurnInState adds messages and sets title on first turn', () => {
  const state = makeSampleState();
  const thread = createTutorThreadRecord('socratic', 'gemini-4-hydrogen');

  // Add thread to state
  const stateWithThread: PersistedState = {
    ...state,
    tutorThreads: [thread, ...state.tutorThreads],
  };

  const userMsg = makeTutorMsg('user', 'What is photosynthesis?');
  const modelMsg = makeTutorMsg('model', 'Photosynthesis converts light to energy.');

  const { nextState, updatedThread } = appendTutorTurnInState(
    stateWithThread,
    thread.id,
    userMsg,
    modelMsg
  );

  assert.ok(updatedThread !== null);
  assert.equal(updatedThread!.messages.length, 2);
  assert.equal(updatedThread!.title, 'What is photosynthesis?');

  const inState = nextState.tutorThreads.find((t) => t.id === thread.id)!;
  assert.equal(inState.messages.length, 2);
});

test('appendTutorTurnInState enforces 60-message cap', () => {
  const state = makeSampleState();
  const thread = createTutorThreadRecord();

  // Pre-fill with 59 messages
  const filled = {
    ...thread,
    messages: Array.from({ length: 59 }, (_, i) =>
      makeTutorMsg(i % 2 === 0 ? 'user' : 'model', `Message ${i}`)
    ),
  };

  const stateWithThread: PersistedState = {
    ...state,
    tutorThreads: [filled],
  };

  const userMsg = makeTutorMsg('user', 'Extra question');
  const modelMsg = makeTutorMsg('model', 'Extra answer');

  const { updatedThread } = appendTutorTurnInState(
    stateWithThread,
    filled.id,
    userMsg,
    modelMsg
  );

  assert.ok(updatedThread !== null);
  // 59 existing + 2 new = 61, capped at 60
  assert.equal(updatedThread!.messages.length, 60, 'messages capped at 60');
  // Oldest message was dropped
  assert.equal(updatedThread!.messages[updatedThread!.messages.length - 1].text, 'Extra answer');
});

test('appendTutorTurnInState returns null for nonexistent thread', () => {
  const state = makeSampleState();
  const { updatedThread } = appendTutorTurnInState(
    state,
    'nonexistent-id',
    makeTutorMsg('user', 'Hello'),
    makeTutorMsg('model', 'Hi')
  );
  assert.equal(updatedThread, null);
});

/* ------------------------------------------------------------------ */
/*  createTutorThreadRecord                                           */
/* ------------------------------------------------------------------ */

test('createTutorThreadRecord creates well-formed thread with defaults', () => {
  const thread = createTutorThreadRecord();
  assert.ok(thread.id.startsWith('thread-'));
  assert.equal(thread.roleId, 'socratic');
  assert.equal(thread.modelId, 'gemini-4-hydrogen');
  assert.equal(thread.useSearchGrounding, false);
  assert.equal(thread.messages.length, 0);
  assert.equal(thread.title, 'New Study Session');
  assert.ok(thread.createdAt === thread.updatedAt);
});

test('createTutorThreadRecord accepts custom role and model', () => {
  const thread = createTutorThreadRecord('stem-solver', 'gemini-4-neon');
  assert.equal(thread.roleId, 'stem-solver');
  assert.equal(thread.modelId, 'gemini-4-neon');
});
