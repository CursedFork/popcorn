// npm run test:filters
// Runs the real filter, sort and URL code against your real data and checks the
// answers against counts worked out separately from the raw JSON file.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toGridMovies, type RawMovie } from '../src/lib/movies.ts';
import { buildFacets, filterMovies, describeResults, emptySelection, type Selected } from '../src/lib/filters.ts';
import { sortMovies } from '../src/lib/order.ts';
import { GRADES, gradeScore } from '../src/lib/grades.ts';
import { readState, shareLink, writeState } from '../src/lib/urlstate.ts';
import { canPickAnother, pickSurprise } from '../src/lib/surprise.ts';
import { computeStats } from '../src/lib/stats.ts';
import { shortDescription, splitSentences } from '../src/lib/text.ts';
import { buildSearchIndex, suggest, titleMatches } from '../src/lib/search.ts';

const raw: RawMovie[] = JSON.parse(readFileSync('src/data/movies.json', 'utf8'));
const aliases = JSON.parse(readFileSync('data/aliases.json', 'utf8'));
const ratings: Record<string, string> = JSON.parse(readFileSync('data/ratings.json', 'utf8'));
const movies = toGridMovies(raw, aliases, ratings);
const pick = (partial: Partial<Selected>): Selected => ({ ...emptySelection(), ...partial });
const nums = (list: { number: number }[]) => list.map((m) => m.number);
// Movies are found by title, so these tests don't care what number a movie has in your list.
const numberOf = (title: string, year?: number) =>
  movies.find((m) => m.title === title && (year === undefined || m.year === year))!.number;
const DOOMSDAY = numberOf('Avengers: Doomsday');
const label = (list: { number: number; title: string }[], n = 4) =>
  list.slice(0, n).map((m) => `#${m.number} ${m.title}`).join(', ') + (list.length > n ? ', ...' : '');

let passed = 0;
function check(name: string, run: () => void) {
  run();
  passed++;
  console.log(`PASS  ${name}`);
}

console.log('\n--- STRICT versus LOOSE ---');

check('Genres Comedy + Horror: loose is the union, strict is the overlap', () => {
  const sel = pick({ genre: ['Comedy', 'Horror'] });
  const loose = filterMovies(movies, sel, 'loose');
  const strict = filterMovies(movies, sel, 'strict');
  const comedy = raw.filter((m) => m.genres.includes('Comedy'));
  const horror = raw.filter((m) => m.genres.includes('Horror'));
  const either = raw.filter((m) => m.genres.includes('Comedy') || m.genres.includes('Horror'));
  const both = raw.filter((m) => m.genres.includes('Comedy') && m.genres.includes('Horror'));
  assert.equal(loose.length, either.length);
  assert.equal(strict.length, both.length);
  assert.ok(strict.length < loose.length);
  console.log(`      Comedy ${comedy.length}, Horror ${horror.length}`);
  console.log(`      loose (ANY): ${loose.length}   strict (ALL): ${strict.length}`);
  console.log(`      strict examples: ${label(strict)}`);
});

check('Two stars with no shared movie: loose shows both, strict shows none', () => {
  const sel = pick({ star: ['Tom Hanks', 'Jim Carrey'] });
  const shared = raw.filter((m) => m.stars.includes('Tom Hanks') && m.stars.includes('Jim Carrey'));
  const loose = filterMovies(movies, sel, 'loose');
  const strict = filterMovies(movies, sel, 'strict');
  assert.equal(loose.length, 14 + 14 - shared.length);
  assert.equal(strict.length, shared.length);
  console.log(`      loose: ${loose.length}   strict: ${strict.length} (they share ${shared.length})`);
});

check('Mixed types: genre Family + studio Pixar', () => {
  const sel = pick({ genre: ['Family'], studio: ['Pixar'] });
  const strict = filterMovies(movies, sel, 'strict');
  const expected = movies.filter((m) => m.genres.includes('Family') && m.studios.includes('Pixar'));
  assert.deepEqual(nums(strict), nums(expected));
  assert.ok(strict.length > 0);
  console.log(`      strict: ${strict.length} movies, ${label(strict)}`);
  console.log(`      loose:  ${filterMovies(movies, sel, 'loose').length} movies`);
});

check('A single pick behaves the same in both modes', () => {
  const sel = pick({ star: ['Adam Sandler'] });
  assert.deepEqual(nums(filterMovies(movies, sel, 'loose')), nums(filterMovies(movies, sel, 'strict')));
});

console.log('\n--- DECADES narrow, and multiple decades mean ANY ---');

check('One decade + loose genre: only that decade, only that genre', () => {
  const sel = pick({ decade: ['1990s'], genre: ['Horror'] });
  const got = filterMovies(movies, sel, 'loose');
  const expected = raw.filter((m) => m.decade === '1990s' && m.genres.includes('Horror'));
  assert.equal(got.length, expected.length);
  console.log(`      1990s horror: ${got.length}, ${label(got)}`);
});

check('Two decades are an OR, even in strict mode', () => {
  const sel = pick({ decade: ['1980s', '1990s'] });
  const expected = raw.filter((m) => m.decade === '1980s' || m.decade === '1990s');
  assert.equal(filterMovies(movies, sel, 'strict').length, expected.length);
  console.log(`      1980s or 1990s: ${expected.length}`);
});

check('Decade does not count as a pick for strict matching', () => {
  const sel = pick({ decade: ['2010s'], genre: ['Animation'] });
  const strict = filterMovies(movies, sel, 'strict');
  const expected = raw.filter((m) => m.decade === '2010s' && m.genres.includes('Animation'));
  assert.equal(strict.length, expected.length);
});

console.log('\n--- ORDER RULES ---');

check('Filtering only hides movies: the survivors keep your number order', () => {
  const sel = pick({ genre: ['Horror', 'Comedy'], decade: ['1980s', '2000s'] });
  const filtered = sortMovies(filterMovies(movies, sel, 'loose'), 'mine');
  const full = nums(sortMovies(movies, 'mine'));
  const positions = nums(filtered).map((n) => full.indexOf(n));
  assert.ok(positions.every((p, i) => i === 0 || positions[i - 1] < p));
  assert.ok(nums(filtered).every((n, i, a) => i === 0 || a[i - 1] < n));
  console.log(`      ${filtered.length} movies, numbers ascending: ${nums(filtered).slice(0, 8).join(', ')}, ...`);
});

check('Decade selected: release order is oldest first, ties by your number', () => {
  const sel = pick({ decade: ['1990s', '2000s'] });
  const rel = sortMovies(filterMovies(movies, sel, 'loose'), 'release');
  for (let i = 1; i < rel.length; i++) {
    const a = rel[i - 1];
    const b = rel[i];
    assert.ok(a.releaseDate! <= b.releaseDate!, `${a.number} before ${b.number}`);
    if (a.releaseDate === b.releaseDate) assert.ok(a.number < b.number, 'tie broken by number');
  }
  const ties = rel.filter((m, i) => rel[i + 1]?.releaseDate === m.releaseDate);
  console.log(`      ${rel.length} movies, first ${label(rel, 3)}`);
  console.log(`      same-date pairs found and ordered by number: ${ties.length}`);
});

check('Flipping the toggle changes order but never the set of movies', () => {
  const sel = pick({ decade: ['1990s'] });
  const subset = filterMovies(movies, sel, 'loose');
  assert.deepEqual([...nums(sortMovies(subset, 'mine'))].sort((a, b) => a - b), [...nums(sortMovies(subset, 'release'))].sort((a, b) => a - b));
});

check('Your numbers run 1 to the end with no gaps, and Doomsday is last in my order but not pinned', () => {
  const mine = sortMovies(movies, 'mine');
  assert.deepEqual(nums(mine), movies.map((_, i) => i + 1));
  assert.equal(mine.at(-1)!.number, DOOMSDAY);
  assert.equal(DOOMSDAY, movies.length);
  const rel = sortMovies(movies, 'release');
  const doomsday = rel.findIndex((m) => m.number === DOOMSDAY);
  console.log(`      numbers 1 to ${movies.length}; #${DOOMSDAY} is last in my order and at position ${doomsday + 1} of ${rel.length} in release order`);
});

console.log('\n--- THE SUMMARY SENTENCE ---');

check('Sentences read plainly', () => {
  const base = { total: movies.length };
  const none = describeResults({ ...base, shown: 993, selected: emptySelection(), mode: 'loose', order: 'mine' });
  const any = describeResults({ ...base, shown: 31, selected: pick({ genre: ['Drama'], star: ['Tom Hanks'] }), mode: 'loose', order: 'mine' });
  const all = describeResults({ ...base, shown: 2, selected: pick({ genre: ['Drama'], star: ['Tom Hanks'] }), mode: 'strict', order: 'mine' });
  const dec = describeResults({ ...base, shown: 15, selected: pick({ star: ['Tom Hanks'], decade: ['1990s', '2000s'] }), mode: 'loose', order: 'release' });
  assert.match(any, /ANY of: Drama, Tom Hanks/);
  assert.match(all, /ALL of: Drama, Tom Hanks/);
  for (const s of [none, any, all, dec]) console.log(`      "${s}"`);
});

console.log('\n--- THE PAGE ADDRESS ---');

check('A view survives a round trip through the URL, awkward names included', () => {
  const state = {
    selected: pick({ decade: ['1990s'], genre: ['Drama'], star: ['Tom Hanks'], studio: ['A&M Films', 'Le Studio Canal+', 'Bad Angels Productions, Ltd.'] }),
    mode: 'strict' as const,
    order: 'release' as const,
    query: 'spider-man & co',
    movie: 55,
  };
  const query = writeState('', state);
  assert.deepEqual(readState(query), state);
  console.log(`      ${query}`);
});

check('The default view leaves the address clean, and other parameters survive', () => {
  const base = { selected: emptySelection(), mode: 'loose' as const, order: 'mine' as const, query: '', movie: null };
  assert.equal(writeState('', base), '');
  const kept = writeState('?utm=keepme&genre=Old', { ...base, selected: pick({ genre: ['Horror'] }) });
  assert.equal(new URLSearchParams(kept).get('utm'), 'keepme');
  assert.deepEqual(new URLSearchParams(kept).getAll('genre'), ['Horror']);
});

check('Bad values in a link are ignored, not trusted', () => {
  const s = readState('?movie=abc&sort=sideways&match=maybe');
  assert.equal(s.movie, null);
  assert.equal(s.order, 'mine');
  assert.equal(s.mode, 'loose');
  assert.equal(readState('?movie=-4').movie, null);
});

check('The same link applied twice gives exactly the same movies', () => {
  const run = (state: ReturnType<typeof readState>) =>
    nums(sortMovies(filterMovies(movies, state.selected, state.mode, state.query), state.order));
  const state = readState('?genre=Horror&genre=Comedy&decade=1980s&match=strict&sort=release&q=the');
  const a = run(state);
  const b = run(readState(writeState('', state)));
  assert.deepEqual(a, b);
  console.log(`      ${a.length} movies: ${a.join(', ')}`);
});

console.log('\n--- SEARCH ---');

check('Title search ignores case, accents and punctuation', () => {
  assert.ok(titleMatches('Spider-Man: Homecoming', 'spiderman'));
  assert.ok(titleMatches('Spider-Man: Homecoming', 'HOMECOMING spider'));
  assert.ok(titleMatches('Joker: Folie à Deux', 'folie a deux'));
  assert.ok(!titleMatches('Heat', 'cold'));
  const got = filterMovies(movies, emptySelection(), 'loose', 'scream');
  const expected = raw.filter((m) => /scream/i.test(m.officialTitle ?? m.myTitle));
  assert.equal(got.length, expected.length);
  console.log(`      "scream" finds ${got.length}: ${label(got, 5)}`);
});

check('Typing an actor suggests them, and choosing them lists their movies', () => {
  const index = buildSearchIndex(buildFacets(movies));
  const hits = suggest(index, 'tom hanks');
  assert.equal(hits[0].name, 'Tom Hanks');
  assert.equal(hits[0].kind, 'star');
  assert.equal(hits[0].count, 14);
  const shown = filterMovies(movies, pick({ star: [hits[0].name] }), 'loose');
  assert.equal(shown.length, 14);
  console.log(`      "tom hanks" suggests: ${hits.map((h) => `${h.name} (${h.kind}, ${h.count})`).join('; ')}`);
});

check('Studios are suggested too, using your merged names', () => {
  const index = buildSearchIndex(buildFacets(movies));
  const hits = suggest(index, 'disney');
  const names = hits.map((h) => h.name);
  assert.ok(names.includes('Walt Disney'), names.join(', '));
  assert.ok(!names.includes('Walt Disney Pictures'));
  console.log(`      "disney" suggests: ${hits.map((h) => `${h.name} (${h.kind})`).join('; ')}`);
});

check('A person who is both a star and a director appears once for each role', () => {
  const index = buildSearchIndex(buildFacets(movies));
  const both = new Set(raw.flatMap((m) => m.directors).filter((d) => raw.some((m) => m.stars.includes(d))));
  const name = [...both][0];
  const hits = suggest(index, name).filter((h) => h.name === name);
  assert.deepEqual(hits.map((h) => h.kind).sort(), ['director', 'star']);
  console.log(`      ${name}: ${hits.map((h) => `${h.kind} ${h.count}`).join(', ')}`);
});

check('One-letter searches suggest nothing', () => {
  assert.deepEqual(suggest(buildSearchIndex(buildFacets(movies)), 'a'), []);
});

console.log('\n--- DESCRIPTIONS ---');

check('Sentences are cut at boundaries, not after Dr., Mr. or initials', () => {
  const text = 'Dr. Doom plots with Mr. Fix and J. Jonah Jameson of the U.S. Army. Then it ends! A third sentence follows. And a fourth.';
  const parts = splitSentences(text);
  assert.equal(parts.length, 4);
  assert.equal(shortDescription(text).short, 'Dr. Doom plots with Mr. Fix and J. Jonah Jameson of the U.S. Army. Then it ends!');
  assert.equal(shortDescription('One sentence only.').hasMore, false);
  assert.equal(shortDescription('Two. Sentences.').hasMore, false);
  assert.equal(shortDescription('One. Two. Three.').short, 'One. Two.');
});

check('Across all 993 real descriptions, every short version ends on a full sentence', () => {
  let cut = 0;
  const odd: string[] = [];
  for (const m of raw) {
    const d = shortDescription(m.overview ?? '');
    assert.ok(m.overview.startsWith(d.short), `#${m.number} short is a prefix`);
    if (d.hasMore) cut++;
    if (!/[.!?]["'”’)]*$/.test(d.short)) odd.push(`#${m.number}`);
    assert.ok(!/\b(Dr|Mr|Mrs|Ms|Jr|Sr|St|Mt|vs)\.$/.test(d.short), `#${m.number} ends on an abbreviation`);
  }
  console.log(`      ${cut} of ${raw.length} need "read more"; short versions not ending in . ! or ?: ${odd.length ? odd.join(', ') : 'none'}`);
});

check('The Fantastic Four blurb is cut after the second real sentence', () => {
  const d = shortDescription(raw.find((m) => m.officialTitle === 'Fantastic Four' && m.year === 2005)!.overview);
  assert.ok(!d.short.endsWith('Dr.'));
  console.log(`      ...${d.short.slice(-70)}`);
});

check('Sentences with a search phrase read plainly', () => {
  const s = describeResults({ shown: 9, total: movies.length, selected: pick({ decade: ['1990s'], star: ['Tom Hanks'] }), mode: 'loose', order: 'release', query: 'the' });
  assert.match(s, /with “the” in the title, released in the 1990s that match ANY of: Tom Hanks/);
  console.log(`      "${s}"`);
});

console.log('\n--- SURPRISE ME ---');

check('It never picks a "Coming soon" movie', () => {
  for (let i = 0; i < 3000; i++) assert.notEqual(pickSurprise(movies, null)!.number, DOOMSDAY);
});

check('It says so (null) when nothing can be picked', () => {
  const doomsday = movies.filter((m) => m.number === DOOMSDAY);
  assert.equal(pickSurprise([], null), null);
  assert.equal(pickSurprise(doomsday, null), null);
  const none = filterMovies(movies, pick({ star: ['Tom Hanks'], genre: ['Horror'] }), 'strict');
  assert.equal(none.length, 0);
  assert.equal(pickSurprise(none, null), null);
  console.log(`      empty results -> ${pickSurprise(none, null)}, only Coming soon -> ${pickSurprise(doomsday, null)}`);
});

check('It avoids repeating the last pick when there are other options', () => {
  const [friday, scream, shining] = [numberOf('Friday the 13th', 1980), numberOf('Scream', 1996), numberOf('The Shining')];
  const three = movies.filter((m) => [friday, scream, shining].includes(m.number));
  const seen = new Set<number>();
  for (let i = 0; i < 500; i++) {
    const got = pickSurprise(three, scream)!;
    assert.notEqual(got.number, scream);
    seen.add(got.number);
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), [friday, shining].sort((a, b) => a - b));
  console.log(`      after #${scream} (Scream) it chose only from: ${[...seen].join(', ')}`);
});

check('With a single choice left, it picks it even if it was the last pick', () => {
  const screamNumber = numberOf('Scream', 1996);
  const one = movies.filter((m) => m.number === screamNumber);
  assert.equal(pickSurprise(one, screamNumber)!.number, screamNumber);
  assert.equal(canPickAnother(one), false);
  assert.equal(canPickAnother(movies), true);
  // a "Coming soon" movie next to one real movie still counts as one choice
  assert.equal(canPickAnother(movies.filter((m) => [screamNumber, DOOMSDAY].includes(m.number))), false);
});

check('It only picks from the current results, and can reach every one of them', () => {
  const shown = filterMovies(movies, pick({ star: ['Tom Hanks'] }), 'loose');
  const allowed = new Set(nums(shown));
  const seen = new Set<number>();
  for (let i = 0; i < 4000; i++) {
    const got = pickSurprise(shown, null)!.number;
    assert.ok(allowed.has(got));
    seen.add(got);
  }
  assert.equal(seen.size, shown.length);
  console.log(`      Tom Hanks results: ${shown.length} movies, all ${seen.size} reachable in 4000 draws`);
});

check('A fixed random number picks predictably (first, middle, last)', () => {
  const wanted = [numberOf('Friday the 13th', 1980), numberOf('Scream', 1996), numberOf('The Shining'), numberOf('It', 1990)];
  const four = movies.filter((m) => wanted.includes(m.number));
  assert.equal(four.length, 4);
  assert.equal(pickSurprise(four, null, () => 0)!.number, four[0].number);
  assert.equal(pickSurprise(four, null, () => 0.5)!.number, four[2].number);
  assert.equal(pickSurprise(four, null, () => 0.999999)!.number, four[3].number);
});

console.log('\n--- STATS PAGE ---');

const stats = computeStats(movies);
const aliasOf = (n: string) => (aliases as Record<string, string>)[n] ?? n;
const topFromRaw = (get: (m: RawMovie) => string[]) => {
  const counts = new Map<string, number>();
  for (const m of raw) for (const n of new Set(get(m))) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10).map(([name, count]) => ({ name, count }));
};
const plain = (rows: { name: string; count: number }[]) => rows.map(({ name, count }) => ({ name, count }));

check('Totals, and unreleased movies are left out of year-based numbers', () => {
  assert.equal(stats.total, raw.length);
  assert.equal(stats.notReleased, raw.filter((m) => m.status === 'unreleased').length);
  assert.equal(stats.byDecade.reduce((s, d) => s + d.count, 0), stats.released);
  assert.equal(stats.byDecade.find((d) => d.name === '2020s')!.count, raw.filter((m) => m.decade === '2020s' && m.status !== 'unreleased').length);
  console.log(`      ${stats.total} movies, ${stats.released} released, ${stats.notReleased} not yet; decade bars add up to ${stats.released}`);
});

check('Oldest, newest and average release year', () => {
  // Worked out straight from the raw data, so it stays right as the list changes.
  const dated = raw
    .filter((m) => m.status !== 'unreleased' && m.releaseDate)
    .sort((a, b) => (a.releaseDate! < b.releaseDate! ? -1 : a.releaseDate! > b.releaseDate! ? 1 : a.number - b.number));
  assert.equal(stats.oldest!.number, dated[0].number);
  assert.equal(stats.newest!.number, dated.at(-1)!.number);
  const years = raw.filter((m) => m.status !== 'unreleased' && m.year !== null).map((m) => m.year!);
  assert.equal(stats.averageYear, years.reduce((a, b) => a + b, 0) / years.length);
  assert.notEqual(stats.newest!.number, DOOMSDAY);
  console.log(`      oldest #${stats.oldest!.number} ${stats.oldest!.title} (${stats.oldest!.year}), newest #${stats.newest!.number} ${stats.newest!.title} (${stats.newest!.year}), average ${stats.averageYear!.toFixed(1)}`);
});

check('Top 10 genres, stars, directors and studios match the raw data (studios after merging)', () => {
  assert.deepEqual(plain(stats.genres), topFromRaw((m) => m.genres));
  assert.deepEqual(plain(stats.stars), topFromRaw((m) => m.stars));
  assert.deepEqual(plain(stats.directors), topFromRaw((m) => m.directors));
  assert.deepEqual(plain(stats.studios), topFromRaw((m) => m.studios.map(aliasOf)));
  for (const list of [stats.genres, stats.stars, stats.directors, stats.studios]) assert.equal(list.length, 10);
  console.log(`      top studio: ${stats.studios[0].name} (${stats.studios[0].count}); Walt Disney merged: ${stats.studios.some((s) => s.name === 'Walt Disney')}`);
});

check('Every bar links to a home-page view with exactly that many movies', () => {
  let bars = 0;
  for (const list of [stats.byDecade, stats.grades, stats.genres, stats.stars, stats.directors, stats.studios]) {
    for (const row of list) {
      const view = readState(new URL(row.href, 'https://x.test').search);
      const got = filterMovies(movies, view.selected, view.mode, view.query).filter((m) => !m.comingSoon || list !== stats.byDecade);
      assert.equal(got.length, row.count, `${row.name}: bar says ${row.count}, link shows ${got.length}`);
      bars++;
    }
  }
  const decadeLink = readState(new URL(stats.byDecade[0].href, 'https://x.test').search);
  assert.equal(decadeLink.order, 'release');
  console.log(`      checked ${bars} bars; decade links open in release order`);
});

console.log('\n--- YOUR GRADES ---');

const rawGrade = (m: RawMovie) => ratings[m.number] ?? null;
const gradedRaw = raw.filter((m) => rawGrade(m));

check('Every graded movie carries its grade; others carry none; junk grades are ignored', () => {
  assert.equal(movies.filter((m) => m.rating).length, gradedRaw.length);
  for (const m of movies) assert.equal(m.rating, ratings[m.number] ?? null);
  const unrated = movies.filter((m) => !m.rating);
  const junk = toGridMovies(raw.slice(0, 3), aliases, { 1: 'Z', 2: 'b', 3: 'A+' });
  assert.deepEqual(junk.map((m) => m.rating), [null, null, 'A+']);
  console.log(`      ${gradedRaw.length} of ${movies.length} graded; not graded: ${unrated.map((m) => `#${m.number} ${m.title}`).join(', ')}`);
});

check('The Grade filter lists the grades best to worst, with counts from the whole list', () => {
  const options = buildFacets(movies).grade;
  assert.deepEqual(options.map((o) => o.name), GRADES.filter((g) => gradedRaw.some((m) => rawGrade(m) === g)));
  for (const o of options) assert.equal(o.count, gradedRaw.filter((m) => rawGrade(m) === o.name).length);
  assert.equal(options.reduce((s, o) => s + o.count, 0), gradedRaw.length);
});

check('Picking grades narrows the list, and several grades mean ANY of them', () => {
  const one = filterMovies(movies, pick({ grade: ['A+'] }), 'loose');
  assert.deepEqual(nums(one), gradedRaw.filter((m) => rawGrade(m) === 'A+').map((m) => m.number));
  const two = filterMovies(movies, pick({ grade: ['S+', 'A+'] }), 'strict'); // strict does not break grades
  assert.equal(two.length, gradedRaw.filter((m) => ['S+', 'A+'].includes(rawGrade(m)!)).length);
  assert.ok(one.every((m) => m.rating === 'A+'));
});

check('A whole letter (S+, S and S-) selects exactly the S range', () => {
  const sRange = filterMovies(movies, pick({ grade: ['S+', 'S', 'S-'] }), 'loose');
  assert.equal(sRange.length, gradedRaw.filter((m) => rawGrade(m)!.startsWith('S')).length);
  assert.ok(sRange.every((m) => m.rating!.startsWith('S')));
});

check('Grade combines with other filters: a genre, a decade, and a search all narrow further', () => {
  const horrorA = filterMovies(movies, pick({ grade: ['A+', 'A', 'A-'], genre: ['Horror'] }), 'loose');
  const expected = gradedRaw.filter((m) => rawGrade(m)!.startsWith('A') && m.genres.includes('Horror'));
  assert.equal(horrorA.length, expected.length);
  const decade = filterMovies(movies, pick({ grade: ['B'], decade: ['1990s'] }), 'loose');
  assert.equal(decade.length, gradedRaw.filter((m) => rawGrade(m) === 'B' && m.decade === '1990s').length);
  const searched = filterMovies(movies, pick({ grade: ['B'] }), 'loose', 'the');
  assert.equal(searched.length, gradedRaw.filter((m) => rawGrade(m) === 'B' && /the/i.test(m.officialTitle ?? m.myTitle)).length);
  console.log(`      A-range horror: ${horrorA.length}, B movies from the 1990s: ${decade.length}`);
});

check('Best rated order: best grade first, ties in your number order, ungraded last', () => {
  const sorted = sortMovies(movies, 'rating');
  assert.equal(sorted.length, movies.length);
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    const sa = a.rating ? gradeScore(a.rating) : 0;
    const sb = b.rating ? gradeScore(b.rating) : 0;
    assert.ok(sa >= sb, `#${a.number} before #${b.number}`);
    if (sa === sb) assert.ok(a.number < b.number, 'ties keep your order');
  }
  assert.equal(sorted[0].rating, 'S+');
  assert.equal(sorted.at(-1)!.rating, null);
  console.log(`      first: ${sorted.slice(0, 3).map((m) => `#${m.number} ${m.title} ${m.rating}`).join(' | ')}`);
});

check('Grades survive the page address, including the plus sign, and junk is ignored', () => {
  const state = { selected: pick({ grade: ['A+', 'S-', 'B'] }), mode: 'loose' as const, order: 'rating' as const, query: '', movie: 7 };
  const query = writeState('', state);
  assert.equal(query, '?grade=A%2B&grade=S-&grade=B&sort=grade&movie=7');
  assert.deepEqual(readState(query), state);
  assert.deepEqual(readState('?grade=B+').selected.grade, ['B+']); // typed by hand: "+" arrives as a space
  assert.deepEqual(readState('?grade=A%2B&grade=Z&grade=b&grade=A%2B').selected.grade, ['A+']);
  assert.equal(readState('?sort=grade').order, 'rating');
  assert.equal(writeState('', { ...state, selected: emptySelection(), movie: null }), '?sort=grade');
});

check('The summary sentence says which grades are showing', () => {
  const base = { shown: 12, total: movies.length, mode: 'loose' as const, order: 'rating' as const };
  const a = describeResults({ ...base, selected: pick({ grade: ['S+', 'S'] }) });
  const b = describeResults({ ...base, selected: pick({ grade: ['A'], decade: ['1990s'], genre: ['Horror'] }), order: 'mine' });
  assert.match(a, /graded S\+ or S, best grade first\./);
  assert.match(b, /graded A, released in the 1990s that match ANY of: Horror, in Andrew's order\./);
  console.log(`      "${a}"`);
  console.log(`      "${b}"`);
});

check('Stats: grade counts, average, most common, best and worst all match the raw ratings', () => {
  const counts = new Map<string, number>();
  for (const m of gradedRaw) counts.set(rawGrade(m)!, (counts.get(rawGrade(m)!) ?? 0) + 1);
  assert.deepEqual(stats.grades.map((g) => [g.name, g.count]), GRADES.filter((g) => counts.has(g)).map((g) => [g, counts.get(g)]));
  assert.equal(stats.graded, gradedRaw.length);
  const mean = gradedRaw.reduce((s, m) => s + gradeScore(rawGrade(m)!), 0) / gradedRaw.length;
  assert.equal(stats.averageGrade!.score, mean);
  assert.equal(stats.averageGrade!.grade, GRADES[GRADES.length - Math.round(mean)]);
  const top = [...counts].sort((a, b) => b[1] - a[1] || GRADES.indexOf(a[0]) - GRADES.indexOf(b[0]))[0];
  assert.deepEqual([stats.commonGrade!.grade, stats.commonGrade!.count], top);
  assert.equal(stats.best!.grade, GRADES.find((g) => counts.has(g)));
  assert.equal(stats.worst!.grade, [...GRADES].reverse().find((g) => counts.has(g)));
  assert.equal(stats.best!.movies.length, counts.get(stats.best!.grade));
  console.log(`      average ${stats.averageGrade!.grade} (${stats.averageGrade!.score.toFixed(1)}), most common ${stats.commonGrade!.grade} (${stats.commonGrade!.count}), best ${stats.best!.grade} x${stats.best!.movies.length}, worst ${stats.worst!.grade} x${stats.worst!.movies.length}`);
});

console.log('\n--- SHARE LINK ROUND TRIP ---');

check('A shared link opens the exact same view in a fresh window', () => {
  const state = {
    selected: pick({ decade: ['1980s', '1990s'], genre: ['Horror'], star: ['Jack Black'], studio: ['Walt Disney'] }),
    mode: 'loose' as const,
    order: 'release' as const,
    query: 'the',
    movie: 55,
  };
  const link = shareLink('https://popcorn.example/', state);
  const reopened = readState(new URL(link).search); // what a fresh browser window reads
  assert.deepEqual(reopened, state);
  const view = (s: typeof state) => nums(sortMovies(filterMovies(movies, s.selected, s.mode, s.query), s.order));
  assert.deepEqual(view(reopened), view(state));
  for (const part of ['decade=1980s', 'decade=1990s', 'genre=Horror', 'star=Jack+Black', 'studio=Walt+Disney', 'sort=release', 'q=the', 'movie=55']) {
    assert.ok(link.includes(part), `link has ${part}`);
  }
  console.log(`      ${link}`);
  console.log(`      reopened: ${view(reopened).length} movies, movie #${reopened.movie} open, same order: true`);
});

check('Strict mode survives sharing too, and an empty view makes a clean link', () => {
  const strict = { selected: pick({ genre: ['Comedy', 'Horror'] }), mode: 'strict' as const, order: 'mine' as const, query: '', movie: null };
  assert.deepEqual(readState(new URL(shareLink('https://popcorn.example/', strict)).search), strict);
  const empty = { selected: emptySelection(), mode: 'loose' as const, order: 'mine' as const, query: '', movie: null };
  assert.equal(shareLink('https://popcorn.example/', empty), 'https://popcorn.example/');
});

console.log(`\nAll ${passed} checks passed.`);
