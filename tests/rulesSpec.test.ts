import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const RULES_PATH = path.resolve(process.cwd(), 'firestore.rules');
const RULES_SRC = fs.readFileSync(RULES_PATH, 'utf8');

/* ------------------------------------------------------------------ */
/*  Structural verification of Firestore security rules               */
/* ------------------------------------------------------------------ */

test('Firestore rules start with global default deny catch-all', () => {
  assert.ok(
    RULES_SRC.includes('match /{document=**}'),
    'should have global catch-all match'
  );
  assert.ok(
    RULES_SRC.includes('allow read, write: if false'),
    'global catch-all should deny all'
  );
});

test('Firestore rules require email_verified for write operations', () => {
  // isVerifiedUser and isVerifiedOwner require email_verified
  assert.ok(
    RULES_SRC.includes('request.auth.token.email_verified == true'),
    'rules should check email_verified'
  );
  // All create/update paths for user data use isVerifiedOwner or isVerifiedUser
  const createMatches = RULES_SRC.match(/allow create:.*?;/gs) || [];
  for (const rule of createMatches) {
    // Skip the global deny rule
    if (rule.includes('if false')) continue;
    assert.ok(
      rule.includes('isVerifiedOwner') || rule.includes('isVerifiedUser'),
      `Create rule should require verified user: ${rule.slice(0, 80)}...`
    );
  }
});

test('Firestore rules use hasAll/hasOnly schema validation on all document types', () => {
  const validators = [
    'isValidUserProfile',
    'isValidLesson',
    'isValidMastery',
    'isValidQuizAttempt',
    'isValidFocusSession',
    'isValidTutorThread',
    'isValidExperiment',
    'isValidStudyRoom',
    'isValidRoomContribution',
  ];

  for (const v of validators) {
    assert.ok(RULES_SRC.includes(`function ${v}(`), `should define ${v}`);
    // Find the function body
    const fnStart = RULES_SRC.indexOf(`function ${v}(`);
    const fnBody = RULES_SRC.slice(fnStart, fnStart + 2000);
    assert.ok(fnBody.includes('hasAll'), `${v} should use hasAll for required fields`);
    assert.ok(fnBody.includes('hasOnly'), `${v} should use hasOnly to restrict fields`);
  }
});

test('Firestore rules enforce owner-only endorseUid modifications', () => {
  // The endorseUids update path ensures users can only add/remove their own UID
  assert.ok(
    RULES_SRC.includes('request.auth.uid in incoming().endorseUids'),
    'endorseUid addition requires own UID'
  );
  assert.ok(
    RULES_SRC.includes('!(request.auth.uid in incoming().endorseUids)'),
    'endorseUid removal requires own UID removal'
  );
  assert.ok(
    RULES_SRC.includes("incoming().endorseUids.size() == existing().endorseUids.size() + 1"),
    'endorseUid addition constrained to exactly +1'
  );
});

test('Firestore rules restrict Study Room visibility values', () => {
  assert.ok(
    RULES_SRC.includes("data.visibility in ['open', 'invite']"),
    'visibility restricted to open/invite enum'
  );
});

test('Firestore rules contribution kinds restricted to known values', () => {
  assert.ok(
    RULES_SRC.includes("data.kind in ['peer-idea', 'ai-critique', 'milestone']"),
    'contribution kinds restricted to known values'
  );
});

test('Firestore rules document paths align with firebase-blueprint entities', () => {
  const expectedPaths = [
    'match /users/{userId}',
    '/lessons/{lessonId}',
    '/mastery/{topicId}',
    '/quizAttempts/{attemptId}',
    '/focusSessions/{sessionId}',
    '/tutorThreads/{threadId}',
    '/experiments/{experimentId}',
    'match /studyRooms/{roomId}',
    '/contributions/{contributionId}',
  ];

  for (const p of expectedPaths) {
    assert.ok(RULES_SRC.includes(p), `should include path ${p}`);
  }
});

test('ESLint passes on firestore.rules', () => {
  try {
    const eslintBin = path.resolve(process.cwd(), 'node_modules/.bin/eslint');
    execSync(`"${eslintBin}" "${RULES_PATH}"`, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe',
    });
  } catch (err: unknown) {
    const error = err as { stderr?: string; stdout?: string };
    assert.fail(`ESLint failed on firestore.rules:\n${error.stdout || error.stderr}`);
  }
});
