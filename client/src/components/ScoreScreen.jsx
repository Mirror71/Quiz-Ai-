const LETTERS = ['A', 'B', 'C', 'D'];

function feedbackFor(pct) {
  if (pct >= 80) return { emoji: '🎉', text: 'Excellent work!' };
  if (pct >= 60) return { emoji: '👍', text: 'Nice job — solid result.' };
  if (pct >= 40) return { emoji: '📚', text: 'Not bad — keep studying!' };
  return { emoji: '💪', text: "Keep at it — you'll get there." };
}

export default function ScoreScreen({ quiz, answers, onRetake, onNewUpload }) {
  const correct = quiz.reduce(
    (acc, q, i) => acc + (answers[i] === q.answer ? 1 : 0),
    0
  );
  const total = quiz.length;
  const pct = Math.round((correct / total) * 100);
  const { emoji, text } = feedbackFor(pct);

  return (
    <div className="animate-fade-in">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="text-5xl">{emoji}</div>
        <p className="mt-3 text-4xl font-extrabold">
          {correct}/{total}
        </p>
        <p className="mt-1 text-2xl font-bold text-indigo-600">{pct}%</p>
        <p className="mt-2 text-slate-500">{text}</p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onRetake}
            className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700"
          >
            Retake Quiz
          </button>
          <button
            type="button"
            onClick={onNewUpload}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Upload New PDF
          </button>
        </div>
      </div>

      {/* Per-question summary */}
      <div className="mt-6 space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Review
        </h3>
        {quiz.map((q, i) => {
          const userAns = answers[i];
          const isCorrect = userAns === q.answer;
          return (
            <div
              key={i}
              className={`rounded-xl border p-4 ${
                isCorrect
                  ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50'
              }`}
            >
              <div className="flex items-start gap-2">
                <span>{isCorrect ? '✅' : '❌'}</span>
                <div className="flex-1">
                  <p className="font-medium">
                    {i + 1}. {q.question}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Correct answer:{' '}
                    <span className="font-semibold">
                      {q.answer}. {q.options[q.answer]}
                    </span>
                  </p>
                  {!isCorrect && (
                    <p className="mt-0.5 text-sm text-slate-500">
                      Your answer:{' '}
                      {userAns
                        ? `${userAns}. ${q.options[userAns]}`
                        : 'No answer'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
