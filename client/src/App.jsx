import { useState } from 'react';
import UploadScreen from './components/UploadScreen.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import QuizScreen from './components/QuizScreen.jsx';
import ScoreScreen from './components/ScoreScreen.jsx';
import { uploadPdf } from './api.js';

// App states: 'upload' | 'loading' | 'quiz' | 'score'
export default function App() {
  const [stage, setStage] = useState('upload');
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]); // user's selected option per question
  const [notice, setNotice] = useState(null); // e.g. truncation message
  const [error, setError] = useState(null);

  async function handleUpload(file) {
    setError(null);
    setNotice(null);
    setStage('loading');
    try {
      const data = await uploadPdf(file);
      setQuiz(data.quiz);
      setAnswers(new Array(data.quiz.length).fill(null));
      setNotice(data.message || null);
      setStage('quiz');
    } catch (err) {
      setError(err.message);
      setStage('upload');
    }
  }

  function handleFinish(finalAnswers) {
    setAnswers(finalAnswers);
    setStage('score');
  }

  function handleRetake() {
    setAnswers(new Array(quiz.length).fill(null));
    setStage('quiz');
  }

  function handleNewUpload() {
    setQuiz(null);
    setAnswers([]);
    setNotice(null);
    setError(null);
    setStage('upload');
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-4">
          <span className="text-2xl">🧠</span>
          <h1 className="text-lg font-bold tracking-tight">QuizAI</h1>
          <span className="ml-auto text-xs text-slate-400">
            PDF → Quiz, powered by Claude
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        {stage === 'upload' && (
          <UploadScreen onUpload={handleUpload} error={error} />
        )}
        {stage === 'loading' && <LoadingScreen />}
        {stage === 'quiz' && (
          <QuizScreen
            quiz={quiz}
            notice={notice}
            onFinish={handleFinish}
          />
        )}
        {stage === 'score' && (
          <ScoreScreen
            quiz={quiz}
            answers={answers}
            onRetake={handleRetake}
            onNewUpload={handleNewUpload}
          />
        )}
      </main>
    </div>
  );
}
