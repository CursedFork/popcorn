// Reads the text list. Accepts "1. Title", "1 Title" or "1) Title", with an
// optional "(year)" at the end. Lines starting with # and blank lines are skipped.
// Your numbers are used exactly as written.

const LINE = /^(\d+)(?:\s*[.)]\s*|\s+)(.+)$/;
const YEAR_AT_END = /^(.*?)\s*\((\d{4})\)$/;

export function parseList(text) {
  const entries = [];
  const unparsed = [];
  const duplicates = [];
  const firstSeen = new Map();

  text.split(/\r?\n/).forEach((raw, index) => {
    const lineNo = index + 1;
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;

    const match = line.match(LINE);
    if (!match) {
      unparsed.push({ lineNo, text: line, reason: 'does not start with a number' });
      return;
    }

    const number = Number(match[1]);
    let title = match[2].trim();
    let year = null;
    const withYear = title.match(YEAR_AT_END);
    if (withYear && withYear[1]) {
      title = withYear[1].trim();
      year = Number(withYear[2]);
    }

    if (number < 1 || number > 9999) {
      unparsed.push({ lineNo, text: line, reason: 'number is outside 1 to 9999' });
      return;
    }
    if (firstSeen.has(number)) {
      duplicates.push({ number, lineNo, firstLineNo: firstSeen.get(number), text: line });
      return; // the first line with this number wins
    }
    firstSeen.set(number, lineNo);
    entries.push({ number, title, year, lineNo });
  });

  entries.sort((a, b) => a.number - b.number);
  return { entries, unparsed, duplicates, gaps: findGaps(entries.map((e) => e.number)) };
}

// Missing numbers between 1 and the highest number, as ranges like [21, 999].
function findGaps(numbers) {
  const gaps = [];
  let expected = 1;
  for (const n of numbers) {
    if (n > expected) gaps.push([expected, n - 1]);
    expected = n + 1;
  }
  return gaps;
}

export function describeProblems({ entries, unparsed, duplicates, gaps }) {
  const lines = [`Read ${entries.length} movies from the list.`];
  for (const u of unparsed) {
    lines.push(`  PROBLEM line ${u.lineNo}: "${u.text}" (${u.reason}), skipped`);
  }
  for (const d of duplicates) {
    lines.push(
      `  DUPLICATE number ${d.number} on line ${d.lineNo}: "${d.text}" (line ${d.firstLineNo} already uses it), skipped`,
    );
  }
  if (gaps.length) {
    const ranges = gaps.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(', ');
    lines.push(`  GAPS, numbers with no movie yet: ${ranges}`);
  }
  return lines;
}
