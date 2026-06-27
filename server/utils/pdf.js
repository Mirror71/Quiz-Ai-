// pdf-parse's package index runs a debug harness on import that reads a sample
// file from disk, which crashes in production. Import the library module directly.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

/**
 * Extracts raw text from a PDF buffer (no truncation/empty handling — that
 * lives in extract.js so it's shared across file types).
 * @returns {Promise<string>}
 */
export async function rawPdfText(buffer) {
  const data = await pdfParse(buffer);
  return (data.text || '').trim();
}
