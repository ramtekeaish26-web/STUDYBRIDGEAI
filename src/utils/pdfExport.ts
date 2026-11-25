import { SimplifiedLesson } from '../types/study';

const PAGE_WIDTH = 612; // US Letter width in pt
const PAGE_HEIGHT = 792; // US Letter height in pt
const MARGIN_X = 54;
const TOP_Y = 740;
const BOTTOM_Y = 62;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

function sanitizeForWinAnsi(input: string): string {
  const replacements: Record<string, string> = {
    '—': '--',
    '–': '-',
    '•': '-',
    '·': '-',
    '→': '->',
    '←': '<-',
    '⇌': '<=>',
    '≈': '~=',
    '≤': '<=',
    '≥': '>=',
    '≠': '!=',
    '÷': '/',
    '×': 'x',
    '“': '"',
    '”': '"',
    '‘': "'",
    '’': "'",
    '…': '...',
    '₀': '0',
    '₁': '1',
    '₂': '2',
    '₃': '3',
    '₄': '4',
    '₅': '5',
    '₆': '6',
    '₇': '7',
    '₈': '8',
    '₉': '9',
    '⁰': '^0',
    '¹': '^1',
    '²': '^2',
    '³': '^3',
    '⁺': '+',
    '⁻': '-',
    'Ω': 'Ohm',
    'α': 'alpha',
    'β': 'beta',
    'Δ': 'Delta',
    'Σ': 'Sum',
    'π': 'pi',
  };

  let out = '';
  for (const ch of input) {
    if (replacements[ch]) {
      out += replacements[ch];
    } else {
      const code = ch.charCodeAt(0);
      if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) {
        out += ch;
      } else if (code === 10 || code === 13 || code === 9) {
        out += ' ';
      } else {
        out += '?';
      }
    }
  }
  return out;
}

function escapePdfLiteral(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function encodeLatin1(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes[i] = code <= 255 ? code : 63; // '?'
  }
  return bytes;
}

function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  const clean = sanitizeForWinAnsi(text).trim();
  if (!clean) return [];

  // Conservative average Helvetica character width (~0.52 * fontSize)
  const avgCharWidth = fontSize * 0.51;
  const maxChars = Math.max(20, Math.floor(maxWidth / avgCharWidth));

  const paragraphs = clean.split(/\r?\n/);
  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      if (currentLine.length + 1 + word.length <= maxChars) {
        currentLine += ` ${word}`;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
  }

  return lines;
}

interface DrawState {
  pages: string[][];
  currentPage: string[];
  y: number;
}

function ensureSpace(state: DrawState, neededHeight: number) {
  if (state.y - neededHeight < BOTTOM_Y) {
    state.pages.push(state.currentPage);
    state.currentPage = [];
    state.y = TOP_Y;
  }
}

function drawTextLines(
  state: DrawState,
  lines: string[],
  options: {
    font: 'F1' | 'F2';
    size: number;
    lineHeight: number;
    colorRgb?: string;
    indent?: number;
  }
) {
  const { font, size, lineHeight, colorRgb = '0.12 0.14 0.21', indent = 0 } = options;
  for (const line of lines) {
    ensureSpace(state, lineHeight);
    if (line.length > 0) {
      const escaped = escapePdfLiteral(line);
      state.currentPage.push(
        `BT /${font} ${size} Tf ${colorRgb} rg 1 0 0 1 ${MARGIN_X + indent} ${state.y} Tm (${escaped}) Tj ET`
      );
    }
    state.y -= lineHeight;
  }
}

function drawRule(state: DrawState) {
  ensureSpace(state, 12);
  state.currentPage.push(
    `0.82 0.84 0.89 RG 0.75 w ${MARGIN_X} ${state.y} m ${PAGE_WIDTH - MARGIN_X} ${state.y} l S`
  );
  state.y -= 14;
}

export function buildLessonPdfBytes(lesson: SimplifiedLesson): Uint8Array {
  const state: DrawState = {
    pages: [],
    currentPage: [],
    y: TOP_Y,
  };

  // Top Brand & Metadata
  drawTextLines(state, ['STUDYBRIDGE - OFFLINE STUDY GUIDE'], {
    font: 'F2',
    size: 9,
    lineHeight: 14,
    colorRgb: '0.39 0.40 0.95',
  });

  drawTextLines(state, wrapText(lesson.title || lesson.topic, 18, CONTENT_WIDTH), {
    font: 'F2',
    size: 18,
    lineHeight: 24,
    colorRgb: '0.12 0.14 0.21',
  });

  const metaParts = [
    `Topic: ${lesson.topic}`,
    `Subject: ${lesson.subject}`,
    `Level: ${lesson.level}`,
    `Language: ${lesson.language}`,
    `${lesson.readMinutes} min read`,
  ];
  if (lesson.sourceNoteName) {
    metaParts.push(`Source: ${lesson.sourceNoteName}`);
  }
  drawTextLines(state, wrapText(metaParts.join('  |  '), 10, CONTENT_WIDTH), {
    font: 'F1',
    size: 10,
    lineHeight: 15,
    colorRgb: '0.35 0.39 0.47',
  });

  state.y -= 4;
  drawRule(state);

  // Summary
  if (lesson.summary) {
    drawTextLines(state, wrapText(lesson.summary, 11, CONTENT_WIDTH), {
      font: 'F1',
      size: 11,
      lineHeight: 16,
    });
    state.y -= 8;
  }

  // Definition
  if (lesson.definition) {
    ensureSpace(state, 36);
    drawTextLines(state, ['CLEAR DEFINITION'], {
      font: 'F2',
      size: 11,
      lineHeight: 16,
      colorRgb: '0.39 0.40 0.95',
    });
    drawTextLines(state, wrapText(lesson.definition, 10.5, CONTENT_WIDTH), {
      font: 'F1',
      size: 10.5,
      lineHeight: 15.5,
    });
    state.y -= 10;
  }

  // Step-by-step Core Mechanism
  if (lesson.coreMechanism.length > 0) {
    ensureSpace(state, 36);
    drawTextLines(state, ['HOW IT WORKS STEP BY STEP'], {
      font: 'F2',
      size: 11,
      lineHeight: 16,
      colorRgb: '0.39 0.40 0.95',
    });
    lesson.coreMechanism.forEach((step, idx) => {
      const wrapped = wrapText(`${idx + 1}. ${step}`, 10.5, CONTENT_WIDTH - 10);
      drawTextLines(state, wrapped, {
        font: 'F1',
        size: 10.5,
        lineHeight: 15,
        indent: 8,
      });
      state.y -= 4;
    });
    state.y -= 6;
  }

  // Real-World Examples
  if (lesson.examples.length > 0) {
    ensureSpace(state, 36);
    drawTextLines(state, ['REAL-WORLD EXAMPLES'], {
      font: 'F2',
      size: 11,
      lineHeight: 16,
      colorRgb: '0.39 0.40 0.95',
    });
    lesson.examples.forEach((ex) => {
      drawTextLines(state, wrapText(ex.title, 10.5, CONTENT_WIDTH - 10), {
        font: 'F2',
        size: 10.5,
        lineHeight: 15,
        indent: 8,
      });
      drawTextLines(state, wrapText(ex.detail, 10, CONTENT_WIDTH - 14), {
        font: 'F1',
        size: 10,
        lineHeight: 14.5,
        colorRgb: '0.28 0.32 0.40',
        indent: 12,
      });
      state.y -= 5;
    });
    state.y -= 6;
  }

  // Intuitive Analogies
  if (lesson.analogies.length > 0) {
    ensureSpace(state, 36);
    drawTextLines(state, ['INTUITIVE ANALOGIES'], {
      font: 'F2',
      size: 11,
      lineHeight: 16,
      colorRgb: '0.49 0.23 0.93',
    });
    lesson.analogies.forEach((an) => {
      drawTextLines(state, wrapText(an.concept, 10.5, CONTENT_WIDTH - 10), {
        font: 'F2',
        size: 10.5,
        lineHeight: 15,
        indent: 8,
      });
      drawTextLines(state, wrapText(an.comparison, 10, CONTENT_WIDTH - 14), {
        font: 'F1',
        size: 10,
        lineHeight: 14.5,
        colorRgb: '0.28 0.32 0.40',
        indent: 12,
      });
      state.y -= 5;
    });
    state.y -= 6;
  }

  // Key Takeaways
  if (lesson.keyTakeaways.length > 0) {
    ensureSpace(state, 36);
    drawTextLines(state, ['KEY TAKEAWAYS'], {
      font: 'F2',
      size: 11,
      lineHeight: 16,
      colorRgb: '0.02 0.47 0.34',
    });
    lesson.keyTakeaways.forEach((tk) => {
      const wrapped = wrapText(`- ${tk}`, 10.5, CONTENT_WIDTH - 10);
      drawTextLines(state, wrapped, {
        font: 'F1',
        size: 10.5,
        lineHeight: 15,
        indent: 8,
      });
      state.y -= 3;
    });
    state.y -= 6;
  }

  // Grounded Web Sources
  if (lesson.groundedSources && lesson.groundedSources.length > 0) {
    ensureSpace(state, 36);
    drawTextLines(state, ['GROUNDED WEB SOURCES'], {
      font: 'F2',
      size: 11,
      lineHeight: 16,
      colorRgb: '0.39 0.40 0.95',
    });
    lesson.groundedSources.forEach((src, idx) => {
      const wrapped = wrapText(`[${idx + 1}] ${src.title} (${src.uri})`, 9.5, CONTENT_WIDTH - 10);
      drawTextLines(state, wrapped, {
        font: 'F1',
        size: 9.5,
        lineHeight: 14,
        colorRgb: '0.28 0.32 0.40',
        indent: 8,
      });
    });
  }

  if (state.currentPage.length > 0) {
    state.pages.push(state.currentPage);
  }
  if (state.pages.length === 0) {
    state.pages.push([]);
  }

  // Add page footer to every page
  const totalPages = state.pages.length;
  state.pages.forEach((cmds, pageIdx) => {
    const footerText = escapePdfLiteral(
      `STUDYBRIDGE - Learn smarter. Understand deeper. Grow faster.   |   Page ${pageIdx + 1} of ${totalPages}`
    );
    cmds.push(
      `BT /F1 8.5 Tf 0.42 0.46 0.54 rg 1 0 0 1 ${MARGIN_X} 34 Tm (${footerText}) Tj ET`
    );
  });

  // Assemble PDF objects:
  // 1: Catalog
  // 2: Pages
  // 3: Font F1 (Helvetica)
  // 4: Font F2 (Helvetica-Bold)
  // 5..4+N: Page objects
  // 5+N..4+2N: Content stream objects
  const pageCount = state.pages.length;
  const pageObjNums: number[] = [];
  const contentObjNums: number[] = [];
  for (let i = 0; i < pageCount; i++) {
    pageObjNums.push(5 + i);
    contentObjNums.push(5 + pageCount + i);
  }

  const objects: string[] = [];
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageCount} >>\nendobj\n`
  );
  objects.push(
    `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`
  );
  objects.push(
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`
  );

  for (let i = 0; i < pageCount; i++) {
    objects.push(
      `${pageObjNums[i]} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjNums[i]} 0 R >>\nendobj\n`
    );
  }

  for (let i = 0; i < pageCount; i++) {
    const stream = state.pages[i].join('\n');
    const streamLen = encodeLatin1(stream).length;
    objects.push(
      `${contentObjNums[i]} 0 obj\n<< /Length ${streamLen} >>\nstream\n${stream}\nendstream\nendobj\n`
    );
  }

  const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const chunks: Uint8Array[] = [encodeLatin1(header)];
  const offsets: number[] = [0];
  let byteOffset = chunks[0].length;

  for (const objStr of objects) {
    offsets.push(byteOffset);
    const bytes = encodeLatin1(objStr);
    chunks.push(bytes);
    byteOffset += bytes.length;
  }

  const xrefStart = byteOffset;
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  chunks.push(encodeLatin1(xref));

  const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalSize);
  let cursor = 0;
  for (const chunk of chunks) {
    result.set(chunk, cursor);
    cursor += chunk.length;
  }
  return result;
}

export function downloadLessonAsPdf(lesson: SimplifiedLesson): void {
  const pdfBytes = buildLessonPdfBytes(lesson);
  const buffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const safeName = (lesson.topic || lesson.title || 'studybridge-lesson')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeName || 'studybridge-lesson'}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
