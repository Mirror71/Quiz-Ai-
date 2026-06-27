import { rawPdfText } from './pdf.js';
import { rawPptxText } from './pptx.js';

export const MAX_CHARS = 12000;

const PDF_MIME = 'application/pdf';
const PPTX_MIME =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';

/**
 * Detects the file type from mimetype/filename and returns 'pdf' | 'pptx' | null.
 */
export function detectType(file) {
  const name = (file.originalname || '').toLowerCase();
  if (file.mimetype === PDF_MIME || name.endsWith('.pdf')) return 'pdf';
  if (file.mimetype === PPTX_MIME || name.endsWith('.pptx')) return 'pptx';
  return null;
}

/**
 * Extracts text from a PDF or PPTX buffer, applying empty-check and truncation.
 * @returns {Promise<{ text: string, truncated: boolean }>}
 * @throws {Error} 'EMPTY_TEXT' if no extractable text is found.
 * @throws {Error} 'UNSUPPORTED_TYPE' if the file isn't a PDF or PPTX.
 */
export async function extractText(file) {
  const type = detectType(file);

  let raw;
  if (type === 'pdf') {
    raw = await rawPdfText(file.buffer);
  } else if (type === 'pptx') {
    raw = await rawPptxText(file.buffer);
  } else {
    throw new Error('UNSUPPORTED_TYPE');
  }

  raw = (raw || '').trim();
  if (!raw) {
    throw new Error('EMPTY_TEXT');
  }

  if (raw.length > MAX_CHARS) {
    return { text: raw.slice(0, MAX_CHARS), truncated: true };
  }

  return { text: raw, truncated: false };
}
