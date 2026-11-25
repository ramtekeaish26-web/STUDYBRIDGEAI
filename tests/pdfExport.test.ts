import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLessonPdfBytes } from '../src/utils/pdfExport';
import { INITIAL_LESSONS } from '../src/data/sampleData';
import { SimplifiedLesson } from '../src/types/study';

test('buildLessonPdfBytes emits valid PDF header, xref table, trailer, and EOF marker', () => {
  const lesson = INITIAL_LESSONS[0];
  const bytes = buildLessonPdfBytes(lesson);
  const text = Buffer.from(bytes).toString('latin1');

  assert.ok(text.startsWith('%PDF-1.4\n'));
  assert.ok(text.includes('xref\n'));
  assert.ok(text.includes('/Root 1 0 R'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));
  assert.ok(text.includes('STUDYBRIDGE - OFFLINE STUDY GUIDE'));
});

test('buildLessonPdfBytes maps mathematical/Unicode symbols safely and paginates long lessons', () => {
  const longLesson: SimplifiedLesson = {
    ...INITIAL_LESSONS[0],
    title: 'Entropy ΔS ≥ 0 & H₂O → O₂ Balance',
    coreMechanism: Array.from({ length: 28 }, (_, i) =>
      `Step ${i + 1}: Explain energy conversion α → β across membrane gradients with H₂O splitting.`
    ),
  };

  const bytes = buildLessonPdfBytes(longLesson);
  const text = Buffer.from(bytes).toString('latin1');

  assert.ok(text.includes('DeltaS >= 0'));
  assert.ok(text.includes('H2O -> O2'));
  assert.ok(text.includes('Page 1 of 2') || text.includes('Page 1 of 3'));
  assert.ok(text.includes('Page 2 of'));
});
