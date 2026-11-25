import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import {
  extractPdfBufferText,
  extractTextFromFile,
  extractTextFromPdfContent,
  MAX_UPLOAD_BYTES,
  validateUploadFile,
} from '../src/utils/fileExtract';
import { buildLessonPdfBytes } from '../src/utils/pdfExport';
import { INITIAL_LESSONS } from '../src/data/sampleData';

test('validateUploadFile rejects unsupported formats, empty files, and >10MB files', () => {
  assert.match(validateUploadFile({ name: 'slides.pptx', size: 1024 }) || '', /Unsupported/);
  assert.match(validateUploadFile({ name: 'empty.txt', size: 0 }) || '', /empty/);
  assert.match(
    validateUploadFile({ name: 'huge.pdf', size: MAX_UPLOAD_BYTES + 1 }) || '',
    /10 MB/
  );
  assert.equal(validateUploadFile({ name: 'lecture-notes.pdf', size: 4096 }), null);
  assert.equal(validateUploadFile({ name: 'notes.md', size: 512 }), null);
});

test('extractTextFromFile reads plain text and markdown files cleanly', async () => {
  const file = new File(['Mitochondria generate ATP via oxidative phosphorylation.'], 'bio.md', {
    type: 'text/markdown',
  });
  const result = await extractTextFromFile(file);
  assert.equal(result.error, undefined);
  assert.match(result.text, /Mitochondria generate ATP/);
});

test('extractTextFromFile handles STUDYBRIDGE-generated PDF round-trip extraction', async () => {
  const sampleLesson = INITIAL_LESSONS[0];
  const pdfBytes = buildLessonPdfBytes(sampleLesson);
  const pdfBuf = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;
  const file = new File([pdfBuf], 'cellular-respiration.pdf', {
    type: 'application/pdf',
  });

  const result = await extractTextFromFile(file);
  assert.equal(result.error, undefined);
  assert.match(result.text, /STUDYBRIDGE/);
  assert.match(result.text, /Cellular Respiration/i);
});

test('extractPdfBufferText inflates compressed FlateDecode PDF streams', async () => {
  const contentStream = 'BT /F1 12 Tf 72 720 Tm (Thermodynamics entropy increases in isolated systems) Tj ET';
  const compressed = zlib.deflateSync(Buffer.from(contentStream, 'latin1'));
  const prefix = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Length ' + compressed.length + ' /Filter /FlateDecode >>\nstream\n',
    'latin1'
  );
  const suffix = Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1');
  const fullPdf = Buffer.concat([prefix, compressed, suffix]);

  const extracted = await extractPdfBufferText(
    fullPdf.buffer.slice(fullPdf.byteOffset, fullPdf.byteOffset + fullPdf.byteLength)
  );
  assert.match(extracted, /Thermodynamics entropy increases in isolated systems/);
});

test('extractTextFromFile reports clear error on binary/image-only PDF without text streams', async () => {
  const rawBuf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /XObject >>\nendobj\n%%EOF', 'latin1');
  const ab = rawBuf.buffer.slice(rawBuf.byteOffset, rawBuf.byteOffset + rawBuf.byteLength) as ArrayBuffer;
  const file = new File([ab], 'scan.pdf', { type: 'application/pdf' });
  const result = await extractTextFromFile(file);
  assert.ok(result.error);
  assert.match(result.error, /no selectable text stream/i);
});

test('extractTextFromPdfContent unescapes PDF literal parentheses and TJ arrays', () => {
  const sample =
    'BT (Supply \\(S\\) and Demand) Tj [(Equilibrium ) -20 (Price)] TJ ET';
  const extracted = extractTextFromPdfContent(sample);
  assert.match(extracted, /Supply \(S\) and Demand/);
  assert.match(extracted, /Equilibrium Price/);
});
