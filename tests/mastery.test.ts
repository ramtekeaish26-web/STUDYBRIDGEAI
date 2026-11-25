import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMasteryPercentage,
  calculateOverallMastery,
  classifyMastery,
  getClassificationTheme,
  MIN_QUESTIONS_FOR_MASTERY,
} from '../src/utils/mastery';
import { TopicMasteryRecord } from '../src/types/study';

test('calculateMasteryPercentage computes rounded percentage and enforces minimum questions', () => {
  assert.equal(MIN_QUESTIONS_FOR_MASTERY, 2);
  assert.equal(calculateMasteryPercentage(0, 0), null);
  assert.equal(calculateMasteryPercentage(1, 1), null);
  assert.equal(calculateMasteryPercentage(0, 2), 0);
  assert.equal(calculateMasteryPercentage(1, 2), 50);
  assert.equal(calculateMasteryPercentage(2, 3), 67);
  assert.equal(calculateMasteryPercentage(4, 5), 80);
  assert.equal(calculateMasteryPercentage(5, 5), 100);
});

test('classifyMastery maps all exact threshold boundaries', () => {
  assert.equal(classifyMastery(null, 0), 'Insufficient Data');
  assert.equal(classifyMastery(100, 1), 'Insufficient Data');
  assert.equal(classifyMastery(0, 4), 'Needs Improvement');
  assert.equal(classifyMastery(49, 5), 'Needs Improvement');
  assert.equal(classifyMastery(50, 4), 'Developing');
  assert.equal(classifyMastery(69, 5), 'Developing');
  assert.equal(classifyMastery(70, 5), 'Good Understanding');
  assert.equal(classifyMastery(84, 5), 'Good Understanding');
  assert.equal(classifyMastery(85, 5), 'Strong Understanding');
  assert.equal(classifyMastery(100, 4), 'Strong Understanding');
});

test('calculateOverallMastery aggregates only tested topics (>= MIN_QUESTIONS_FOR_MASTERY)', () => {
  const untestedOnly: TopicMasteryRecord[] = [
    {
      topic: 'Quantum Entanglement',
      subject: 'Physics',
      correctAnswers: 1,
      attemptedQuestions: 1,
      previousScorePercent: null,
      latestScorePercent: null,
      lastPracticedAt: null,
      strongConcepts: [],
      weakConcepts: [],
      revisionAdvice: '',
    },
  ];
  assert.equal(calculateOverallMastery(untestedOnly), null);

  const mixed: TopicMasteryRecord[] = [
    ...untestedOnly,
    {
      topic: 'Cellular Respiration',
      subject: 'Biology',
      correctAnswers: 4,
      attemptedQuestions: 5,
      previousScorePercent: 60,
      latestScorePercent: 80,
      lastPracticedAt: '2026-11-22T15:00:00Z',
      strongConcepts: [],
      weakConcepts: [],
      revisionAdvice: '',
    },
    {
      topic: 'Supply & Demand',
      subject: 'Economics',
      correctAnswers: 2,
      attemptedQuestions: 5,
      previousScorePercent: null,
      latestScorePercent: 40,
      lastPracticedAt: '2026-11-22T15:00:00Z',
      strongConcepts: [],
      weakConcepts: [],
      revisionAdvice: '',
    },
  ];
  // (4 + 2) / (5 + 5) * 100 = 60%
  assert.equal(calculateOverallMastery(mixed), 60);
});

test('getClassificationTheme returns distinct accessible styles for every tier', () => {
  assert.equal(getClassificationTheme('Strong Understanding').shortTag, 'Strong');
  assert.equal(getClassificationTheme('Good Understanding').shortTag, 'Good');
  assert.equal(getClassificationTheme('Developing').shortTag, 'Developing');
  assert.equal(getClassificationTheme('Needs Improvement').shortTag, 'Needs Focus');
  assert.equal(getClassificationTheme('Insufficient Data').shortTag, 'Untested');
});
