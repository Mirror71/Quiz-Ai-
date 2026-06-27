import { extractText } from '../utils/extract.js';
import { generateQuiz } from '../utils/gemini.js';

export async function handleUpload(req, res) {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: 'Please upload a PDF or PowerPoint (.pptx) file.' });
    }

    // 1 & 2. Extract text from the PDF or PPTX.
    let extracted;
    try {
      extracted = await extractText(req.file);
    } catch (err) {
      if (err.message === 'EMPTY_TEXT') {
        return res.status(422).json({
          error:
            'This file contains no extractable text (it may be scanned or image-only).',
        });
      }
      if (err.message === 'UNSUPPORTED_TYPE') {
        return res
          .status(415)
          .json({ error: 'Please upload a PDF or PowerPoint (.pptx) file.' });
      }
      throw err;
    }

    // 4. Generate the quiz via Gemini.
    let quiz;
    try {
      quiz = await generateQuiz(extracted.text);
    } catch (err) {
      if (err.message === 'MALFORMED_RESPONSE') {
        return res.status(502).json({
          error: 'AI returned an unexpected format. Please try again.',
        });
      }
      if (err.message === 'RATE_LIMIT') {
        return res.status(429).json({
          error:
            'The AI is rate-limited right now (free-tier quota). Please wait a moment and try again.',
        });
      }
      if (err.message === 'OVERLOADED') {
        return res.status(503).json({
          error:
            'The AI model is busy right now (high demand). Please try again in a few seconds.',
        });
      }
      console.error('Gemini API error:', err);
      return res.status(502).json({
        error: 'Failed to generate quiz. Please try again.',
      });
    }

    return res.json({
      quiz,
      truncated: extracted.truncated,
      message: extracted.truncated
        ? 'Your PDF was long, so the quiz covers the first portion of the document.'
        : null,
    });
  } catch (err) {
    console.error('Upload handler error:', err);
    return res
      .status(500)
      .json({ error: 'Something went wrong. Please try again.' });
  }
}
