import { useRef, useState } from 'react';
import { validateFile } from '../api.js';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function UploadScreen({ onUpload, error }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [localError, setLocalError] = useState(null);
  const [dragging, setDragging] = useState(false);

  function pick(selected) {
    const validationError = validateFile(selected);
    if (validationError) {
      setLocalError(validationError);
      setFile(null);
      return;
    }
    setLocalError(null);
    setFile(selected);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) pick(dropped);
  }

  const message = localError || error;

  return (
    <div className="animate-fade-in">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold sm:text-3xl">
          Turn any PDF into a quiz
        </h2>
        <p className="mt-2 text-slate-500">
          Upload a text-based PDF or PowerPoint and we'll generate 10
          multiple-choice questions.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed bg-white p-10 text-center shadow-sm transition ${
          dragging
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-slate-300 hover:border-indigo-400'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])}
        />
        <div className="text-4xl">📄</div>
        <p className="mt-3 font-medium">
          Drag &amp; drop your PDF or PPTX here
        </p>
        <p className="mt-1 text-sm text-slate-400">or click to browse</p>
        <button
          type="button"
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          Choose file
        </button>
        <p className="mt-3 text-xs text-slate-400">PDF or PPTX · max 10MB</p>
      </div>

      {file && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3 overflow-hidden">
            <span className="text-xl">📎</span>
            <div className="overflow-hidden">
              <p className="truncate font-medium">{file.name}</p>
              <p className="text-xs text-slate-400">{formatSize(file.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFile(null)}
            className="ml-3 shrink-0 text-sm text-slate-400 hover:text-slate-600"
          >
            Remove
          </button>
        </div>
      )}

      {message && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <button
        type="button"
        disabled={!file}
        onClick={() => file && onUpload(file)}
        className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Generate Quiz
      </button>
    </div>
  );
}
