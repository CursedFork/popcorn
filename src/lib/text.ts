// Cuts a description after its first two sentences, only ever at a sentence boundary.
// The browser's built-in splitter breaks after "Dr." and "Mr.", so this one skips
// common abbreviations and initials (like "J. Jonah Jameson" or "U.S.").

const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'mt', 'vs', 'vol', 'inc', 'ltd', 'co',
  'gen', 'col', 'capt', 'lt', 'sgt', 'rev', 'hon', 'dept', 'no',
]);

// Returns the position just after each sentence (not counting trailing spaces).
function sentenceEnds(text: string): number[] {
  const ends: number[] = [];
  const boundary = /([.!?]+)(["'”’)\]]*)(\s+)(?=\S)/g;
  for (const m of text.matchAll(boundary)) {
    const next = text[m.index + m[0].length];
    if (/\p{Ll}/u.test(next)) continue; // a new sentence starts with a capital, quote or digit

    if (m[1] === '.') {
      const word = text.slice(0, m.index).match(/(\S+)$/)?.[1] ?? '';
      const bare = word.replace(/^[("'“‘]+/, '');
      if (ABBREVIATIONS.has(bare.toLowerCase())) continue;
      if (/^\p{Lu}$/u.test(bare)) continue; // an initial, like the "J" in "J. Jonah"
      if (/^(\p{L}\.)+\p{L}$/u.test(bare)) continue; // like "U.S" in "U.S. Army"
    }
    ends.push(m.index + m[1].length + m[2].length);
  }
  return ends;
}

export function splitSentences(text: string): string[] {
  const trimmed = text.trim();
  const ends = sentenceEnds(trimmed);
  const parts: string[] = [];
  let start = 0;
  for (const end of ends) {
    parts.push(trimmed.slice(start, end).trim());
    start = end;
  }
  const last = trimmed.slice(start).trim();
  if (last) parts.push(last);
  return parts;
}

export function shortDescription(text: string): { short: string; full: string; hasMore: boolean } {
  const full = text.trim();
  const ends = sentenceEnds(full);
  // Two sentences or fewer: show everything, no "read more".
  if (ends.length < 2) return { short: full, full, hasMore: false };
  return { short: full.slice(0, ends[1]).trim(), full, hasMore: true };
}
