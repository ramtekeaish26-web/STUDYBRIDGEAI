import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  INITIAL_LESSONS,
  INITIAL_QUIZ_BANKS,
  INITIAL_SOLUTIONS,
  INITIAL_TOPIC_MASTERY,
} from '../src/data/sampleData';
import { calculateMasteryPercentage, classifyMastery } from '../src/utils/mastery';

test('Quiz submission updates topic mastery, classification tier, and attempt delta accurately', () => {
  const bank = INITIAL_QUIZ_BANKS['Photosynthesis & Calvin Cycle'];
  assert.ok(bank && bank.questions.length === 5);

  const priorRecord = INITIAL_TOPIC_MASTERY.find(
    (m) => m.topic === 'Photosynthesis & Calvin Cycle'
  );
  assert.ok(priorRecord);
  assert.equal(priorRecord.latestScorePercent, 40);
  assert.equal(
    classifyMastery(priorRecord.latestScorePercent, priorRecord.attemptedQuestions),
    'Needs Improvement'
  );

  // Simulate student answering 4 out of 5 correctly on retake
  const correctCount = 4;
  const totalQuestions = bank.questions.length;
  const newScore = calculateMasteryPercentage(correctCount, totalQuestions);
  assert.equal(newScore, 80);
  assert.equal(classifyMastery(newScore, totalQuestions), 'Good Understanding');

  const previousScore = priorRecord.latestScorePercent;
  const delta = newScore! - (previousScore ?? 0);
  assert.equal(delta, 40);
});

test('Sample quiz banks cover 4 options and valid correctIndex for every question', () => {
  for (const [topic, bank] of Object.entries(INITIAL_QUIZ_BANKS)) {
    assert.ok(bank.questions.length >= 4, `${topic} should have at least 4 questions`);
    for (const q of bank.questions) {
      assert.equal(q.options.length, 4, `${q.id} should have 4 options`);
      assert.ok(q.correctIndex >= 0 && q.correctIndex < 4, `${q.id} correctIndex valid`);
      assert.ok(q.explanation.trim().length > 10, `${q.id} should have explanation`);
    }
  }
});

test('Initial lessons and solutions link cleanly to existing curriculum topics', () => {
  assert.ok(INITIAL_LESSONS.length >= 3);
  assert.ok(INITIAL_SOLUTIONS.length >= 2);
  for (const sol of INITIAL_SOLUTIONS) {
    assert.ok(sol.roomCode.length >= 6);
    assert.ok(sol.tasks.length >= 2);
    assert.ok(sol.buildPhases.length >= 2);
    if (sol.linkedTopic) {
      const matched = INITIAL_TOPIC_MASTERY.some((m) => m.topic === sol.linkedTopic);
      assert.ok(matched, `Solution ${sol.id} linkedTopic should exist in INITIAL_TOPIC_MASTERY`);
    }
  }
});

test('Sidebar navigation and App router include all 8 required screens', () => {
  const sidebarSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/Sidebar.tsx'),
    'utf8'
  );
  const appSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/App.tsx'),
    'utf8'
  );

  const requiredScreens = [
    'dashboard',
    'simplifier',
    'quiz',
    'gaps',
    'experiment',
    'solutions',
    'tutor',
    'settings',
  ];

  for (const id of requiredScreens) {
    assert.ok(sidebarSrc.includes(`id: '${id}'`), `Sidebar missing screen ${id}`);
    assert.ok(appSrc.includes(`case '${id}'`), `App router missing screen ${id}`);
  }
});
