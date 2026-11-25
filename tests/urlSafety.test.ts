import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafeHttpUrl, sanitizeCitations } from '../src/utils/urlSafety';

test('isSafeHttpUrl allows http/https URLs and blocks javascript/data/file schemes', () => {
  assert.equal(isSafeHttpUrl('https://khanacademy.org/science'), true);
  assert.equal(isSafeHttpUrl('http://example.edu/notes'), true);
  assert.equal(isSafeHttpUrl('javascript:alert(1)'), false);
  assert.equal(isSafeHttpUrl('DATA:text/html,<script>alert(1)</script>'), false);
  assert.equal(isSafeHttpUrl('file:///etc/passwd'), false);
  assert.equal(isSafeHttpUrl('not a url'), false);
  assert.equal(isSafeHttpUrl(''), false);
});

test('sanitizeCitations removes unsafe or malformed links while keeping valid citations', () => {
  const cleaned = sanitizeCitations([
    { title: 'NASA Climate', uri: 'https://climate.nasa.gov' },
    { title: 'XSS Attempt', uri: 'javascript:alert(document.cookie)' },
    { title: 'Broken', uri: 'not-a-valid-url' },
    null,
    { title: 'OpenStax', uri: 'https://openstax.org/subjects' },
  ]);

  assert.equal(cleaned.length, 2);
  assert.deepEqual(cleaned, [
    { title: 'NASA Climate', uri: 'https://climate.nasa.gov' },
    { title: 'OpenStax', uri: 'https://openstax.org/subjects' },
  ]);
});
