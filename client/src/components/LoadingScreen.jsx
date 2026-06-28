// Skeleton / shimmer UI shown while Gemini generates the quiz (5–15s).
function ShimmerBar({ className = '' }) {
  return (
    <div
      className={`relative overflow-hidden rounded bg-slate-200 ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

export default function LoadingScreen() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6 text-center">
        <h2 className="text-xl font-bold">Generating your quiz…</h2>
        <p className="mt-1 text-sm text-slate-500">
          Reading your PDF and writing questions. This usually takes 5–15 seconds.
        </p>
      </div>

      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <ShimmerBar className="h-5 w-3/4" />
            <div className="mt-4 space-y-3">
              <ShimmerBar className="h-10 w-full" />
              <ShimmerBar className="h-10 w-full" />
              <ShimmerBar className="h-10 w-5/6" />
              <ShimmerBar className="h-10 w-4/6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
