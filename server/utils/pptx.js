import JSZip from 'jszip';

// A .pptx is a ZIP archive of XML. Slide text lives in ppt/slides/slideN.xml,
// inside <a:t>...</a:t> runs. We read slides in numeric order and concatenate.

function slideNumber(name) {
  const m = name.match(/slide(\d+)\.xml$/);
  return m ? parseInt(m[1], 10) : 0;
}

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Extracts raw text from a .pptx buffer (no truncation/empty handling).
 * @returns {Promise<string>}
 */
export async function rawPptxText(buffer) {
  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => slideNumber(a) - slideNumber(b));

  const slides = [];
  for (const name of slideFiles) {
    const xml = await zip.files[name].async('string');
    const runs = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) =>
      decodeEntities(m[1])
    );
    const slideText = runs.join(' ').replace(/\s+/g, ' ').trim();
    if (slideText) slides.push(slideText);
  }

  return slides.join('\n\n').trim();
}
