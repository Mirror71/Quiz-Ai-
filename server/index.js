import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

// Load .env from the project root (one level above /server), per the spec.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import uploadRouter from './routes/upload.js';

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: '15mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api/upload', uploadRouter);

// Production / single-unit deployment: if the client has been built, serve it
// from Express so the whole app runs from one process on one port.
const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist));
  // SPA fallback for any non-API route.
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
  console.log('🗂️  Serving built client from /client/dist');
}

// Centralized error handler — catches multer errors and anything thrown downstream.
app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File exceeds 10MB limit.' });
  }
  if (err && err.message === 'INVALID_FILE_TYPE') {
    return res
      .status(415)
      .json({ error: 'Please upload a PDF or PowerPoint (.pptx) file.' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

if (!process.env.GEMINI_API_KEY) {
  console.warn('⚠️  GEMINI_API_KEY is not set. Create a .env file at the project root.');
}

app.listen(PORT, () => {
  console.log(`✅ QuizAI server listening on http://localhost:${PORT}`);
  console.log(`   Allowing CORS from ${CLIENT_ORIGIN}`);
});
