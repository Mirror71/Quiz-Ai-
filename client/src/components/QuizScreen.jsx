import { useState } from 'react';

const LETTERS = ['A', 'B', 'C', 'D'];

export default function QuizScreen({ quiz, notice, onFinish }) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState(new Array(quiz.length).fill(null));

  const q = quiz[current];
  const selected = answers[current];
  const answered = selected !== null;
  const isLast = current === quiz.length - 1;
  const progress = ((current + 1) / quiz.length) * 100;

  function select(letter) {
    if (answered) return; // disable further selection once answered
    const next = answers.slice();
    next[current] = letter;
    setAnswers(next);
  }

  function goNext() {
    if (isLast) {
      onFinish(answers);
    } else {
      setCurrent((c) => c + 1);
    }
  }

  function optionClasses(letter) {
    const base =
      'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition';
    if (!answered) {
      return `${base} border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50`;
    }
    if (letter === q.answer) {
      return `${base} border-green-500 bg-green-50`;
    }
    if (letter === selected) {
      return `${base} border-red-500 bg-red-50`;
    }
    return `${base} border-slate-200 bg-white opacity-60`;
  }

  return (
    <div className="animate-fade-in">
      {notice && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {notice}
        </div>
      )}

      {/* Progress */}
      <div className="mb-5">
        <div className="mb-1 flex justify-between text-sm font-medium text-slate-500">
          <span>
            Question {current + 1} of {quiz.length}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold leading-snug">{q.question}</h2>

        <div className="mt-5 flex flex-col gap-3">
          {LETTERS.map((letter) => (
            <button
              key={letter}
              type="button"
              disabled={answered}
              onClick={() => select(letter)}
              className={optionClasses(letter)}
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold">
                {letter}
              </span>
              <span className="flex-1">{q.options[letter]}</span>
            </button>
          ))}
        </div>

        {/* Feedback */}
        {answered && (
          <div className="mt-5 animate-fade-in rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold">
              {selected === q.answer ? (
                <span className="text-green-700">✅ Correct!</span>
              ) : (
                <span className="text-red-700">
                  ❌ Incorrect — the answer is {q.answer}.
                </span>
              )}
            </p>
            <p className="mt-2 text-sm text-slate-600">{q.explanation}</p>
          </div>
        )}
      </div>

      {answered && (
        <button
          type="button"
          onClick={goNext}
          className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          {isLast ? 'See Results' : 'Next Question'}
        </button>
      )}
    </div>
  );
}
