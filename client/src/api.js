// Single API call: upload a PDF, get back a quiz.
// Returns { quiz, truncated, message }. Throws Error with a user-friendly message.

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export function validateFile(file) {
  if (!file) return 'Please upload a PDF or PowerPoint (.pptx) file.';
  const name = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
  const isPptx =
    file.type ===
      'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    name.endsWith('.pptx');
  if (!isPdf && !isPptx) {
    return 'Please upload a PDF or PowerPoint (.pptx) file.';
  }
  if (file.size > MAX_BYTES) return 'File exceeds 10MB limit.';
  return null;
}

export async function uploadPdf(file) {
  const formData = new FormData();
  formData.append('file', file);

  let res;
  try {
    res = await fetch('/api/upload', { method: 'POST', body: formData });
  } catch {
    // fetch only rejects on network-level failures.
    throw new Error('Connection error. Check your internet and try again.');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON response body.
  }

  if (!res.ok) {
    throw new Error(
      (data && data.error) || 'Failed to generate quiz. Please try again.'
    );
  }

  return data;
}
