// The lookup pipeline: list file -> TMDB -> src/data/movies.json (+ a review report).
// Files that sit beside the list (overrides.json, review-report.md) are found from
// the list's folder, so a test list in another folder stays fully separate.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseList, describeProblems } from './parse.mjs';
import { findMatch, yearOf } from './match.mjs';
import { getDetails, requestCount } from './tmdb.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function paths(opts = {}) {
  const list = resolve(opts.listPath ?? join(ROOT, 'data', 'movies.txt'));
  const dataDir = dirname(list);
  return {
    list,
    overrides: join(dataDir, 'overrides.json'),
    report: join(dataDir, 'review-report.md'),
    out: resolve(opts.outPath ?? join(ROOT, 'src', 'data', 'movies.json')),
  };
}

export async function readJson(file, fallback) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${file} is not valid JSON. Fix it, or delete it to start fresh.`);
  }
}

export async function writeJson(file, data) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + '\n');
}

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY = {
  tmdbId: null,
  officialTitle: null,
  releaseDate: null,
  year: null,
  decade: null,
  genres: [],
  overview: '',
  posterPath: null,
  stars: [],
  directors: [],
  studios: [],
};

const decadeOf = (year) => (year ? `${Math.floor(year / 10) * 10}s` : null);

function withDates(fields) {
  const year = fields.year ?? yearOf(fields.releaseDate);
  return { ...fields, year, decade: decadeOf(year) };
}

function fromDetails(base, d, date) {
  const releaseDate = d.release_date || null;
  const released = d.status === 'Released' && releaseDate && releaseDate <= date;
  return {
    ...base,
    ...withDates({
      ...EMPTY,
      tmdbId: d.id,
      officialTitle: d.title,
      releaseDate,
      genres: (d.genres ?? []).map((g) => g.name),
      overview: d.overview ?? '',
      posterPath: d.poster_path ?? null,
      stars: [...(d.credits?.cast ?? [])]
        .sort((a, b) => a.order - b.order)
        .slice(0, 5)
        .map((p) => p.name),
      directors: [...new Set((d.credits?.crew ?? []).filter((p) => p.job === 'Director').map((p) => p.name))],
      studios: (d.production_companies ?? []).map((c) => c.name),
    }),
    status: released ? 'matched' : 'unreleased',
    fetchedAt: date,
  };
}

function fromManual(base, manual, date) {
  return {
    ...base,
    ...withDates({
      ...EMPTY,
      officialTitle: manual.officialTitle ?? base.myTitle,
      releaseDate: manual.releaseDate ?? null,
      year: manual.year ?? null,
      genres: manual.genres ?? [],
      overview: manual.overview ?? '',
      posterPath: manual.posterPath ?? null,
      stars: manual.stars ?? [],
      directors: manual.directors ?? [],
      studios: manual.studios ?? [],
    }),
    status: 'manual',
    fetchedAt: date,
  };
}

async function lookupOne(entry, override, date) {
  const input = { title: entry.title, year: entry.year, override: override ?? null };
  const base = { number: entry.number, myTitle: entry.title, input };

  if (override && typeof override === 'object') return fromManual(base, override, date);
  if (typeof override === 'number') return fromDetails(base, await getDetails(override), date);

  const match = await findMatch(entry, date);
  if (match.flag) {
    return { ...base, ...EMPTY, status: 'needs review', reason: match.flag, candidates: match.candidates, fetchedAt: date };
  }
  return fromDetails(base, await getDetails(match.id), date);
}

// How many TMDB requests a set of movies will take (a search + a details call each).
export function estimateRequests(entries, overrides) {
  let low = 0;
  let high = 0;
  for (const e of entries) {
    const o = overrides[e.number];
    if (o && typeof o === 'object') continue;
    if (typeof o === 'number') {
      low += 1;
      high += 1;
    } else {
      low += 2;
      high += e.year ? 4 : 3; // a year-less search can need a second look; a year search can retry once
    }
  }
  return { low, high };
}

async function writeReport(file, movies, date) {
  const flagged = movies.filter((m) => m.status === 'needs review');
  const lines = [`# Review report`, '', `Generated ${date}. ${flagged.length} movie(s) need a look.`, ''];
  for (const m of flagged) {
    lines.push(`## #${m.number} ${m.myTitle}${m.input.year ? ` (${m.input.year})` : ''}`, '');
    lines.push(`Why it was flagged: ${m.reason}`, '', 'Top candidates:');
    if (m.candidates.length === 0) lines.push('- (none)');
    m.candidates.forEach((c, i) =>
      lines.push(`${i + 1}. TMDB ${c.id}, ${c.year ?? 'no year'}, "${c.title}": ${c.description}`),
    );
    lines.push('', `To fix: npm run fix ${m.number} <TMDB id>`, '');
  }
  await writeFile(file, lines.join('\n'));
  return flagged.length;
}

export async function run(opts = {}) {
  const p = paths(opts);
  const date = today();

  const parsed = parseList(await readFile(p.list, 'utf8'));
  for (const line of describeProblems(parsed)) console.log(line);

  const overrides = await readJson(p.overrides, {});
  const existing = new Map((await readJson(p.out, [])).map((m) => [m.number, m]));
  const wanted = opts.numbers ?? [];

  for (const n of wanted) {
    if (!parsed.entries.some((e) => e.number === n)) throw new Error(`Number ${n} is not in ${p.list}`);
  }

  const queue = parsed.entries.filter((e) => {
    if (wanted.length) return wanted.includes(e.number);
    const rec = existing.get(e.number);
    if (opts.all || !rec) return true;
    const input = JSON.stringify({ title: e.title, year: e.year, override: overrides[e.number] ?? null });
    return JSON.stringify(rec.input) !== input; // the line or its override changed
  });

  const { low, high } = estimateRequests(queue, overrides);
  console.log(
    `${queue.length} movie(s) to look up, ${parsed.entries.length - queue.length} already saved. ` +
      `About ${low} TMDB requests (at most ${high}), roughly ${Math.ceil((high * 0.3) / 60)} minute(s).`,
  );
  if (opts.dry) {
    console.log('Dry run: nothing was fetched or saved.');
    return;
  }

  // The list is the source of truth, so anything no longer in it is dropped.
  const keep = new Set(parsed.entries.map((e) => e.number));
  const records = new Map([...existing].filter(([n]) => keep.has(n)));
  const save = () => writeJson(p.out, [...records.values()].sort((a, b) => a.number - b.number));

  const failed = [];
  let done = 0;
  try {
    for (const entry of queue) {
      done++;
      const label = `[${done}/${queue.length}] #${entry.number} ${entry.title}`;
      try {
        const rec = await lookupOne(entry, overrides[entry.number], date);
        records.set(entry.number, rec);
        console.log(`${label} -> ${rec.status}${rec.officialTitle ? ` (${rec.officialTitle}, ${rec.year ?? 'no date'})` : ''}`);
      } catch (error) {
        if (error.fatal) throw error;
        failed.push(entry.number);
        console.log(`${label} -> FAILED: ${error.message}`);
      }
      if (done % 10 === 0) await save();
    }
  } finally {
    await save();
  }

  const flagged = await writeReport(p.report, [...records.values()], date);
  const counts = {};
  for (const r of records.values()) counts[r.status] = (counts[r.status] ?? 0) + 1;
  console.log('');
  console.log(`Saved ${records.size} movies to ${p.out}`);
  console.log('Statuses:', JSON.stringify(counts));
  console.log(`TMDB requests made this run: ${requestCount}`);
  if (flagged) console.log(`${flagged} movie(s) need review. See ${p.report}`);
  if (failed.length) console.log(`These failed and were not saved, run the command again to retry: ${failed.join(', ')}`);
}
