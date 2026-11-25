import test from 'node:test';
import assert from 'node:assert/strict';
import { toSafeDocId } from '../src/utils/firestoreErrors';

/* ------------------------------------------------------------------ */
/*  toSafeDocId                                                       */
/* ------------------------------------------------------------------ */

test('toSafeDocId sanitizes special characters to underscores', () => {
  assert.equal(toSafeDocId('hello world!'), 'hello_world');
  assert.equal(toSafeDocId('topic/subtopic'), 'topic_subtopic');
  assert.equal(toSafeDocId('a.b.c@d'), 'a_b_c_d');
});

test('toSafeDocId strips leading and trailing underscores', () => {
  assert.equal(toSafeDocId('___clean___'), 'clean');
  assert.equal(toSafeDocId('  __name__  '), 'name');
});

test('toSafeDocId preserves valid characters (letters, digits, hyphens, underscores)', () => {
  assert.equal(toSafeDocId('valid-id_123'), 'valid-id_123');
  assert.equal(toSafeDocId('ABC-xyz-789'), 'ABC-xyz-789');
});

test('toSafeDocId truncates to 110 characters', () => {
  const longStr = 'a'.repeat(200);
  const result = toSafeDocId(longStr);
  assert.equal(result.length, 110);
});

test('toSafeDocId returns fallback for empty or whitespace-only input', () => {
  const r1 = toSafeDocId('');
  assert.ok(r1.startsWith('doc-'), `empty string fallback: ${r1}`);

  const r2 = toSafeDocId('   ');
  assert.ok(r2.startsWith('doc-'), `whitespace fallback: ${r2}`);

  const r3 = toSafeDocId('!!!', 'custom');
  assert.ok(r3.startsWith('custom-'), `custom fallback prefix: ${r3}`);
});

test('toSafeDocId handles Unicode-only input with fallback', () => {
  const result = toSafeDocId('日本語テスト');
  assert.ok(result.startsWith('doc-'), `Unicode-only should use fallback: ${result}`);
});
