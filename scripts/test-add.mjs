// npm run test:add
// Checks the insert-and-renumber logic in memory. It never touches your files or the internet.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseList } from './lib/parse.mjs';
import { checkInStep, parseNewMovies, planInserts } from './lib/insert.mjs';

let passed = 0;
function check(name, run) {
  run();
  passed++;
  console.log(`PASS  ${name}`);
}
const one = (line) => parseNewMovies([line]).inserts[0];
const numbersIn = (text) => parseList(text).entries.map((e) => e.number);

// A small list with a header, five movies, and a dropped-movies note at the bottom.
const LIST = [
  '# Header comment. Your numbers are used exactly as written.',
  '1. Alpha (2001)',
  '2. Bravo (2002)',
  '3. Charlie (2003)',
  '4. Delta (2004)',
  '5. Echo (2005)',
  '',
  '# Dropped on purpose, so they have no number here.',
  '# Foxtrot (a duplicate)',
].join('\n');
const MOVIES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'].map((t, i) => ({ number: i + 1, myTitle: t, tmdbId: 100 + i }));
const state = () => ({
  listText: LIST,
  movies: MOVIES.map((m) => ({ ...m })),
  overrides: { 3: 903, 5: { officialTitle: 'Echo by hand' } },
  ratings: { 2: 'A', 3: 'B+', 5: 'S-' },
  batches: { 'batch-fixes.txt': '# note\n3    903   # Charlie\n5    905   # Echo' },
});
const NONE = { listLines: 0, movies: 0, overrides: 0, ratings: 0, batchLines: 0 };

console.log('--- READING THE NEW LINES ---');

check('Lines in the project format are read, and tidied', () => {
  const { inserts, problems } = parseNewMovies(['210. The Batman (2022)\n  305)  Heat   (1995)  ', '# a comment', '']);
  assert.deepEqual(problems, []);
  assert.deepEqual(inserts.map((i) => i.line), ['210. The Batman (2022)', '305. Heat (1995)']);
});

check('Lines with no number, or the same number twice, are refused with a clear message', () => {
  assert.match(parseNewMovies(['The Batman (2022)']).problems[0], /Use this form: 210\. Title \(Year\)/);
  assert.match(parseNewMovies(['5. A (1999)', '5. B (2000)']).problems.join(' '), /both want number 5/);
});

console.log('\n--- INSERTING ---');

check('Insert in the middle: later movies shift in all four places, nothing else moves', () => {
  const out = planInserts(state(), [one('3. New One (2020)')]);
  assert.deepEqual(numbersIn(out.listText), [1, 2, 3, 4, 5, 6]);
  assert.match(out.listText, /\n3\. New One \(2020\)\n4\. Charlie \(2003\)\n/);
  assert.deepEqual(out.movies.map((m) => [m.number, m.myTitle]), [[1, 'Alpha'], [2, 'Bravo'], [4, 'Charlie'], [5, 'Delta'], [6, 'Echo']]);
  assert.deepEqual(Object.keys(out.overrides), ['4', '6']);
  assert.equal(out.overrides[4], 903);
  assert.equal(out.overrides[6].officialTitle, 'Echo by hand');
  assert.deepEqual(out.ratings, { 2: 'A', 4: 'B+', 6: 'S-' }); // grades travel with their movies
  assert.equal(out.batches['batch-fixes.txt'], '# note\n4    903   # Charlie\n6    905   # Echo');
  assert.ok(out.listText.startsWith('# Header comment.'));
  assert.ok(out.listText.endsWith('# Foxtrot (a duplicate)'));
  assert.deepEqual(out.totals, { listLines: 3, movies: 3, overrides: 2, ratings: 2, batchLines: 2 });
});

check('Insert at number 1 shifts everything', () => {
  const out = planInserts(state(), [one('1. First (1999)')]);
  assert.deepEqual(numbersIn(out.listText), [1, 2, 3, 4, 5, 6]);
  assert.match(out.listText, /\n1\. First \(1999\)\n2\. Alpha/);
  assert.equal(out.movies[0].myTitle, 'Alpha');
  assert.equal(out.movies[0].number, 2);
});

check('Insert at the very end (next number) changes no other movie', () => {
  const out = planInserts(state(), [one('6. Last (2030)')]);
  assert.deepEqual(numbersIn(out.listText), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(out.totals, NONE);
  assert.match(out.listText, /5\. Echo \(2005\)\n6\. Last \(2030\)\n\n# Dropped on purpose/);
  assert.deepEqual(out.overrides, state().overrides);
  assert.deepEqual(out.ratings, state().ratings);
});

check('Several new movies at once each end up at the number you gave', () => {
  const out = planInserts(state(), [one('4. Four (2040)'), one('2. Two (2020)')]);
  const parsed = parseList(out.listText).entries;
  assert.deepEqual(parsed.map((e) => e.number), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(parsed[1].title, 'Two');
  assert.equal(parsed[3].title, 'Four');
  assert.deepEqual(out.movies.map((m) => m.myTitle), ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']);
  assert.deepEqual(out.movies.map((m) => m.number), [1, 3, 5, 6, 7]);
  assert.deepEqual(Object.keys(out.overrides), ['5', '7']);
  assert.deepEqual(out.ratings, { 3: 'A', 5: 'B+', 7: 'S-' }); // Bravo, Charlie and Echo's grades followed them
});

check('A free number in a gap needs no shifting', () => {
  const gappy = {
    ...state(),
    listText: LIST.replace('3. Charlie (2003)\n', ''),
    movies: MOVIES.filter((m) => m.number !== 3),
    overrides: {},
    ratings: { 4: 'C' },
    batches: {},
  };
  const out = planInserts(gappy, [one('3. Filler (2010)')]);
  assert.deepEqual(numbersIn(out.listText), [1, 2, 3, 4, 5]);
  assert.deepEqual(out.totals, NONE);
  assert.deepEqual(out.ratings, { 4: 'C' });
});

check('Original numbering styles ("2)" and "3 Title") survive a shift', () => {
  const styled = {
    ...state(),
    listText: '1. A (2001)\n2) B (2002)\n3 C (2003)',
    movies: MOVIES.slice(0, 3),
    overrides: {},
    ratings: {},
    batches: {},
  };
  const out = planInserts(styled, [one('2. Mid (2020)')]);
  assert.equal(out.listText, '1. A (2001)\n2. Mid (2020)\n3) B (2002)\n4 C (2003)');
});

console.log('\n--- REFUSING BAD REQUESTS ---');

check('A number that is too big, or zero, is refused and says the allowed range', () => {
  assert.throws(() => planInserts(state(), [one('9. Far (2020)')]), /anywhere from 1 to 6/);
  assert.throws(() => planInserts(state(), [{ ...one('1. Zero (2020)'), rank: 0 }]), /out of range/);
});

check('A movie already on the list is caught, unless you allow it', () => {
  assert.throws(() => planInserts(state(), [one('2. Charlie (2003)')]), /already on your list as #3/);
  assert.throws(() => planInserts(state(), [one('2. The Charlie')]), /already on your list as #3/);
  assert.doesNotThrow(() => planInserts(state(), [one('2. Charlie (1985)')])); // a different year is a different movie
  assert.doesNotThrow(() => planInserts(state(), [one('2. Charlie (2003)')], { allowDuplicate: true }));
});

check('A list and saved data that disagree are caught before anything moves', () => {
  assert.doesNotThrow(() => checkInStep(LIST, MOVIES));
  assert.throws(() => checkInStep(LIST, MOVIES.slice(1)), /on the list but not looked up yet: 1/);
  assert.throws(() => checkInStep(LIST, [...MOVIES, { number: 9 }]), /saved but no longer on the list: 9/);
});

check('Planning never changes the data you pass in', () => {
  const s = state();
  const before = JSON.stringify(s);
  planInserts(s, [one('2. X (2020)')]);
  assert.equal(JSON.stringify(s), before);
});

console.log('\n--- YOUR REAL DATA ---');

const real = {
  listText: readFileSync('data/movies.txt', 'utf8'),
  movies: JSON.parse(readFileSync('src/data/movies.json', 'utf8')),
  overrides: JSON.parse(readFileSync('data/overrides.json', 'utf8')),
  batches: Object.fromEntries(
    readdirSync('data')
      .filter((f) => /^batch-fixes.*\.txt$/.test(f))
      .map((f) => [f, readFileSync(`data/${f}`, 'utf8')]),
  ),
};
const N = real.movies.length;
// Your real ratings file may be empty today, so give every 7th movie a made-up grade (in memory only).
const GRADE_CYCLE = ['S+', 'B', 'C-', 'A', 'D+', 'B-', 'F'];
real.ratings = Object.fromEntries(
  real.movies.filter((m) => m.number % 7 === 0).map((m) => [m.number, GRADE_CYCLE[(m.number / 7) % GRADE_CYCLE.length]]),
);

for (const rank of [1, 2, 53, 400, 624, N, N + 1]) {
  check(`Inserting at #${rank}: everything stays attached to the right movie`, () => {
    const out = planInserts(real, [one(`${rank}. Brand New Test Movie (2031)`)]);
    const shift = (n) => (rank <= N && n >= rank ? n + 1 : n);

    // the list is whole and in order, with the new movie exactly where asked
    const entries = parseList(out.listText);
    assert.deepEqual([entries.unparsed.length, entries.duplicates.length], [0, 0]);
    assert.deepEqual(entries.entries.map((e) => e.number), Array.from({ length: N + 1 }, (_, i) => i + 1));
    assert.equal(entries.entries[rank - 1].title, 'Brand New Test Movie');

    // every saved movie moved to exactly shift(old number) and is still the same movie
    assert.equal(out.movies.length, N);
    for (const old of real.movies) {
      const now = out.movies.find((m) => m.tmdbId === old.tmdbId && m.myTitle === old.myTitle && m.number === shift(old.number));
      assert.ok(now, `#${old.number} ${old.myTitle} should now be #${shift(old.number)}`);
      assert.equal(entries.entries[now.number - 1].title, old.myTitle, 'list line and saved movie agree');
    }

    // every override still belongs to its own movie
    assert.equal(Object.keys(out.overrides).length, Object.keys(real.overrides).length);
    for (const [k, v] of Object.entries(real.overrides)) assert.deepEqual(out.overrides[shift(Number(k))], v);

    // every grade is still on its own movie, and none were lost or invented
    assert.equal(Object.keys(out.ratings).length, Object.keys(real.ratings).length);
    for (const [k, grade] of Object.entries(real.ratings)) {
      const movie = real.movies.find((m) => m.number === Number(k));
      const now = out.movies.find((m) => m.tmdbId === movie.tmdbId && m.myTitle === movie.myTitle);
      assert.equal(out.ratings[now.number], grade, `${movie.myTitle} keeps its ${grade}`);
    }

    // every fix-batch line still names the same movie as before
    for (const [name, text] of Object.entries(real.batches)) {
      const before = text.split('\n').filter((l) => /^\d+\s/.test(l));
      const after = out.batches[name].split('\n').filter((l) => /^\d+\s/.test(l));
      assert.equal(after.length, before.length);
      before.forEach((l, i) => {
        const [oldN, id] = l.split(/\s+/);
        const [newN, id2] = after[i].split(/\s+/);
        assert.equal(Number(newN), shift(Number(oldN)));
        assert.equal(id2, id);
      });
    }
  });
}

check('Inserting at #624 in the real list moves exactly the movies from 624 to the end', () => {
  const out = planInserts(real, [one('624. Brand New Test Movie (2031)')]);
  assert.equal(out.totals.movies, N - 624 + 1);
  assert.equal(out.steps[0].moved, N - 624 + 1);
  console.log(
    `      ${out.totals.movies} saved movies, ${out.totals.listLines} list lines, ${out.totals.overrides} overrides, ${out.totals.ratings} grades (test ones) and ${out.totals.batchLines} fix-file lines moved down by one`,
  );
});

console.log(`\nAll ${passed} checks passed.`);
