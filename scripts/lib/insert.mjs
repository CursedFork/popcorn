// Inserts new movies at chosen ranks and keeps every list number in step.
// Your numbers are stored in five places, and all of them move together:
//   data/movies.txt, src/data/movies.json, data/overrides.json, data/batch-fixes*.txt,
//   and data/ratings.json (your grades)
// This file only works on text and objects in memory. add.mjs does the reading and writing.
import { parseList } from './parse.mjs';
import { normalize } from './match.mjs';

const ACTIVE = /^(\d+)(\s*[.)]\s*|\s+)(.*)$/; // a numbered movie line
const BATCH = /^(\d+)(\s+\d+.*)$/; // a fix-batch line: "number id  # note"

// Turns lines like "210. The Batman (2022)" into { rank, title, year, line }.
export function parseNewMovies(texts) {
  const inserts = [];
  const problems = [];
  for (const text of texts) {
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const { entries, unparsed } = parseList(line);
      if (unparsed.length || entries.length !== 1) {
        const why = unparsed[0]?.reason ?? 'it needs a number at the start';
        problems.push(`"${line}": ${why}. Use this form: 210. Title (Year)`);
        continue;
      }
      const { number, title, year } = entries[0];
      inserts.push({ rank: number, title, year, line: `${number}. ${title}${year ? ` (${year})` : ''}` });
    }
  }
  const seen = new Set();
  for (const ins of inserts) {
    if (seen.has(ins.rank)) problems.push(`Two of the new movies both want number ${ins.rank}.`);
    seen.add(ins.rank);
  }
  return { inserts, problems };
}

// state:   { listText, movies, overrides, batches, ratings }
//          (batches is { "batch-fixes.txt": "text", ... }; ratings is { "12": "B+", ... } and may be left out)
// inserts: [{ rank, title, year, line }]
// Returns the new state plus a report. Throws a plain-language Error if anything looks wrong.
export function planInserts(state, inserts, { allowDuplicate = false } = {}) {
  let lines = state.listText.split(/\r?\n/);
  let movies = state.movies.map((m) => ({ ...m }));
  let overrides = { ...state.overrides };
  let ratings = { ...(state.ratings ?? {}) };
  let batches = { ...state.batches };
  const steps = [];
  const shifts = []; // for each insert: { rank, pushes }, to work out where every old number ended up

  // Ascending order means each rank is the movie's final number.
  for (const ins of [...inserts].sort((a, b) => a.rank - b.rank)) {
    const active = lines.map((text, index) => ({ text, index, m: text.match(ACTIVE) })).filter((x) => x.m);
    const used = new Set(active.map((x) => Number(x.m[1])));
    const max = Math.max(0, ...used);

    if (ins.rank < 1 || ins.rank > max + 1) {
      throw new Error(
        `Number ${ins.rank} is out of range. Your list has numbers up to ${max}, so a new movie can go anywhere from 1 to ${max + 1}.`,
      );
    }

    const wanted = normalize(ins.title);
    const twin = parseList(lines.join('\n')).entries.find(
      (e) => normalize(e.title) === wanted && (e.year === null || ins.year === null || e.year === ins.year),
    );
    if (twin && !allowDuplicate) {
      throw new Error(
        `"${ins.title}" looks like it is already on your list as #${twin.number} ("${twin.title}${twin.year ? ` (${twin.year})` : ''}"). ` +
          'If that is a different movie, add the year to tell them apart, or add --allow-duplicate.',
      );
    }

    // If the number is taken, everything from it onward moves down by one.
    const pushes = used.has(ins.rank);
    const shift = (n) => (pushes && n >= ins.rank ? n + 1 : n);
    const moved = pushes ? [...used].filter((n) => n >= ins.rank).length : 0;

    shifts.push({ rank: ins.rank, pushes });

    lines = lines.map((text) => {
      const m = text.match(ACTIVE);
      if (!m || !pushes || Number(m[1]) < ins.rank) return text;
      return `${shift(Number(m[1]))}${m[2]}${m[3]}`;
    });

    for (const movie of movies) movie.number = shift(movie.number);

    const next = {};
    for (const [key, value] of Object.entries(overrides)) next[shift(Number(key))] = value;
    overrides = next;

    const nextRatings = {};
    for (const [key, grade] of Object.entries(ratings)) nextRatings[shift(Number(key))] = grade;
    ratings = nextRatings;

    for (const [name, text] of Object.entries(batches)) {
      batches[name] = text
        .split('\n')
        .map((l) => {
          const m = l.match(BATCH);
          return m && shift(Number(m[1])) !== Number(m[1]) ? `${shift(Number(m[1]))}${m[2]}` : l;
        })
        .join('\n');
    }

    // The new line goes just before the first movie that now has a bigger number,
    // or after the last numbered line if there is none.
    const after = lines.map((text, index) => ({ index, m: text.match(ACTIVE) })).filter((x) => x.m);
    const firstBigger = after.find((x) => Number(x.m[1]) > ins.rank);
    const at = firstBigger ? firstBigger.index : after.length ? after.at(-1).index + 1 : lines.length;
    lines.splice(at, 0, ins.line);

    steps.push({ ...ins, pushes, moved, firstOld: ins.rank, lastOld: max });
  }

  // Count each thing once, however many times it moved: compare where it started with where it ended.
  const finalNumber = (n) => shifts.reduce((x, s) => (s.pushes && x >= s.rank ? x + 1 : x), n);
  const moves = (n) => finalNumber(n) !== n;
  const originalLines = state.listText.split(/\r?\n/);
  const totals = {
    listLines: originalLines.filter((l) => ACTIVE.test(l) && moves(Number(l.match(ACTIVE)[1]))).length,
    movies: state.movies.filter((m) => moves(m.number)).length,
    overrides: Object.keys(state.overrides).filter((k) => moves(Number(k))).length,
    ratings: Object.keys(state.ratings ?? {}).filter((k) => moves(Number(k))).length,
    batchLines: Object.values(state.batches)
      .flatMap((text) => text.split('\n'))
      .filter((l) => BATCH.test(l) && moves(Number(l.match(BATCH)[1]))).length,
  };

  movies.sort((a, b) => a.number - b.number);
  const sortedOverrides = Object.fromEntries(Object.entries(overrides).sort((a, b) => a[0] - b[0]));
  const sortedRatings = Object.fromEntries(Object.entries(ratings).sort((a, b) => a[0] - b[0]));
  return { listText: lines.join('\n'), movies, overrides: sortedOverrides, ratings: sortedRatings, batches, steps, totals };
}

// The saved data must describe exactly the movies on the list, or renumbering could misalign them.
export function checkInStep(listText, movies) {
  const listed = new Set(parseList(listText).entries.map((e) => e.number));
  const saved = new Set(movies.map((m) => m.number));
  const notSaved = [...listed].filter((n) => !saved.has(n));
  const notListed = [...saved].filter((n) => !listed.has(n));
  if (notSaved.length || notListed.length) {
    const bits = [];
    if (notSaved.length) bits.push(`on the list but not looked up yet: ${notSaved.slice(0, 8).join(', ')}${notSaved.length > 8 ? ', ...' : ''}`);
    if (notListed.length) bits.push(`saved but no longer on the list: ${notListed.slice(0, 8).join(', ')}${notListed.length > 8 ? ', ...' : ''}`);
    throw new Error(`Your list and your saved data don't match (${bits.join('; ')}). Run npm run lookup first, then try again.`);
  }
}
