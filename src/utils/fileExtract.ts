export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_NOTE_EXTENSIONS = ['.pdf', '.txt', '.md', '.csv'];

export interface FileExtractionResult {
  text: string;
  error?: string;
}

export function validateUploadFile(file: { name: string; size: number }): string | null {
  const lower = file.name.toLowerCase().trim();
  const hasAllowedExt = ALLOWED_NOTE_EXTENSIONS.some((ext) => lower.endsWith(ext));
  if (!hasAllowedExt) {
    return `Unsupported file format "${file.name}". Please upload a PDF, Markdown (.md), TXT, or CSV file.`;
  }
  if (file.size <= 0) {
    return `"${file.name}" is empty (0 bytes). Please choose a file containing study notes.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `"${file.name}" exceeds the 10 MB upload limit. Please upload a smaller excerpt or paste key sections below.`;
  }
  return null;
}

function unescapePdfString(raw: string): string {
  return raw
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

export function extractTextFromPdfContent(pdfText: string): string {
  const chunks: string[] = [];

  // Match PDF text operators: (Hello world) Tj and [(Hello) -20 (world)] TJ
  const tjRegex = /\(((?:\\.|[^\\)])+)\)\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = tjRegex.exec(pdfText)) !== null) {
    const cleaned = unescapePdfString(match[1]).trim();
    if (cleaned) chunks.push(cleaned);
  }

  const tjArrayRegex = /\[((?:[^\]])*?)\]\s*TJ/g;
  while ((match = tjArrayRegex.exec(pdfText)) !== null) {
    const inner = match[1];
    const parts: string[] = [];
    const innerLiteral = /\(((?:\\.|[^\\)])*)\)/g;
    let partMatch: RegExpExecArray | null;
    while ((partMatch = innerLiteral.exec(inner)) !== null) {
      parts.push(unescapePdfString(partMatch[1]));
    }
    const joined = parts.join('').trim();
    if (joined) chunks.push(joined);
  }

  if (chunks.length > 0) {
    return chunks.join(' ').replace(/\s+/g, ' ').trim();
  }

  // Fallback for uncompressed PDFs containing readable prose outside dictionary metadata
  const withoutDicts = pdfText.replace(/<<[\s\S]*?>>/g, ' ');
  const readableMatches = withoutDicts.match(/[A-Za-z0-9][A-Za-z0-9 ,.;:()\-/%]{14,}/g) ?? [];
  return readableMatches
    .filter(
      (chunk) =>
        chunk.includes(' ') &&
        !/\b(obj|endobj|endstream|xref|trailer|startxref|FlateDecode|MediaBox|XObject|Subtype|Catalog|FontDescriptor|ProcSet)\b/.test(
          chunk
        ) &&
        !chunk.includes('PDF-') &&
        !chunk.includes('/')
    )
    .slice(0, 100)
    .join(' ')
    .trim();
}

async function tryInflateStream(bytes: Uint8Array): Promise<string | null> {
  if (typeof DecompressionStream === 'undefined') {
    return null;
  }

  for (const format of ['deflate', 'deflate-raw'] as const) {
    try {
      const ds = new DecompressionStream(format);
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const stream = new Blob([copy]).stream().pipeThrough(ds);
      const decompressed = await new Response(stream).arrayBuffer();
      const text = new TextDecoder('latin1').decode(decompressed);
      if (text && text.length > 0) {
        return text;
      }
    } catch {
      // Try next deflate framing
    }
  }
  return null;
}

export async function extractPdfBufferText(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const latin1 = new TextDecoder('latin1').decode(bytes);

  // First try direct text operators (works on uncompressed PDFs & STUDYBRIDGE PDFs)
  const direct = extractTextFromPdfContent(latin1);
  if (direct.length >= 20) {
    return direct.slice(0, 6000);
  }

  // Attempt native DecompressionStream inflation on PDF stream blocks
  const streamRegex = /stream\r?\n/g;
  const collected: string[] = [];
  let match: RegExpExecArray | null;
  let inspectedStreams = 0;

  while ((match = streamRegex.exec(latin1)) !== null && inspectedStreams < 25) {
    const startIdx = match.index + match[0].length;
    const endIdx = latin1.indexOf('endstream', startIdx);
    if (endIdx <= startIdx) break;

    let trimEnd = endIdx;
    while (trimEnd > startIdx && (latin1[trimEnd - 1] === '\n' || latin1[trimEnd - 1] === '\r')) {
      trimEnd--;
    }

    inspectedStreams++;
    const slice = bytes.subarray(startIdx, trimEnd);
    if (slice.length > 4 && slice.length < 2 * 1024 * 1024) {
      const inflated = await tryInflateStream(slice);
      if (inflated) {
        const extracted = extractTextFromPdfContent(inflated);
        if (extracted) {
          collected.push(extracted);
        }
      }
    }
  }

  const combined = (collected.length > 0 ? collected.join(' ') : direct)
    .replace(/\s+/g, ' ')
    .trim();

  return combined.slice(0, 6000);
}

export async function extractTextFromFile(file: File): Promise<FileExtractionResult> {
  const validationError = validateUploadFile({ name: file.name, size: file.size });
  if (validationError) {
    return { text: '', error: validationError };
  }

  const lower = file.name.toLowerCase();
  if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.csv')) {
    const raw = (await file.text()).trim();
    if (!raw) {
      return {
        text: '',
        error: `"${file.name}" does not contain readable text.`,
      };
    }
    return { text: raw.slice(0, 6000) };
  }

  try {
    const buffer = await file.arrayBuffer();
    const extracted = await extractPdfBufferText(buffer);
    if (!extracted) {
      return {
        text: '',
        error: `Attached "${file.name}", but no selectable text stream could be extracted (it may be scanned or image-based). Paste key study notes in the box below.`,
      };
    }
    return { text: extracted };
  } catch {
    return {
      text: '',
      error: `Could not read "${file.name}". Please paste your study notes below.`,
    };
  }
}
