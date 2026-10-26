// npm run test:ratings
// Checks the grade rules and the local saving service. It uses a temporary folder and
// never touches your real ratings.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GRADES, applyKey, compareGrades, gradeScore, isGrade } from '../src/lib/grades.ts';
import { validateRating, withRating } from '../src/lib/ratings.ts';
import { createRatingsHandler } from './dev-ratings.mjs';

let passed = 0;
async function check(name, run) {
  await run();
  passed++;
  console.log(`PASS  ${name}`);
}

console.log('--- THE SCALE ---');

await check('There are 21 grades, from S+ down to F-, and nothing else is a grade', () => {
  assert.equal(GRADES.length, 21);
  assert.deepEqual(GRADES.slice(0, 4), ['S+', 'S', 'S-', 'A+']);
  assert.deepEqual(GRADES.slice(-3), ['F+', 'F', 'F-']);
  for (const g of ['B-', 'B', 'B+', 'S', 'F-']) assert.ok(isGrade(g), g);
  for (const g of ['G', 'b', 'B++', 'A+-', '', null, undefined, 5, 'SS', 'E ']) assert.ok(!isGrade(g), String(g));
});

await check('Grades sort best first, and scores run 21 (S+) down to 1 (F-)', () => {
  const shuffled = ['C', 'S-', 'F+', 'A', 'B-', 'S+', 'B', 'D', 'B+'];
  assert.deepEqual([...shuffled].sort(compareGrades), ['S+', 'S-', 'A', 'B+', 'B', 'B-', 'C', 'D', 'F+']);
  assert.equal(gradeScore('S+'), 21);
  assert.equal(gradeScore('B+'), 15);
  assert.equal(gradeScore('B'), 14);
  assert.equal(gradeScore('B-'), 13);
  assert.equal(gradeScore('F-'), 1);
  assert.ok(gradeScore('B+') > gradeScore('B') && gradeScore('B') > gradeScore('B-') && gradeScore('B-') > gradeScore('C+'));
});

console.log('\n--- TYPING A GRADE ---');

function type(keys) {
  let pending = null;
  const grades = [];
  for (const key of keys) {
    const out = applyKey(pending, key);
    pending = out.pending;
    if (out.grade) grades.push(out.grade);
  }
  return { grades, pending };
}

await check('Letter then +, - or Enter gives the grade (any case)', () => {
  assert.deepEqual(type(['b', '+']).grades, ['B+']);
  assert.deepEqual(type(['B', '-']).grades, ['B-']);
  assert.deepEqual(type(['s', 'Enter']).grades, ['S']);
  assert.deepEqual(type(['f', ' ']).grades, ['F']);
  assert.deepEqual(type(['a', '=']).grades, ['A+']); // "=" is "+" without holding shift
});

await check('Pressing another letter swaps the waiting letter, and Escape cancels it', () => {
  assert.deepEqual(type(['b', 'c', '+']).grades, ['C+']);
  assert.deepEqual(type(['b', 'Escape', '+']).grades, []);
  assert.equal(type(['b']).pending, 'B');
  assert.equal(type(['b', 'Escape']).pending, null);
});

await check('Signs and Enter on their own do nothing, and unrelated keys leave the waiting letter alone', () => {
  assert.deepEqual(type(['+', '-', 'Enter']).grades, []);
  assert.deepEqual(type(['b', 'x', 'ArrowLeft', '+']).grades, ['B+']);
  assert.deepEqual(type(['g', '+']).grades, []);
});

await check('Several grades in a row come out in order', () => {
  assert.deepEqual(type(['b', '+', 'a', 'Enter', 'd', '-']).grades, ['B+', 'A', 'D-']);
});

console.log('\n--- THE RATINGS FILE ---');

const NUMBERS = new Set([1, 2, 3, 10]);

await check('Only real movies and real grades are accepted (or null to clear)', () => {
  assert.doesNotThrow(() => validateRating(NUMBERS, 3, 'B+'));
  assert.doesNotThrow(() => validateRating(NUMBERS, 3, null));
  assert.throws(() => validateRating(NUMBERS, 4, 'B'), /not a movie on your list/);
  assert.throws(() => validateRating(NUMBERS, '3', 'B'), /not a movie on your list/);
  assert.throws(() => validateRating(NUMBERS, 3, 'G'), /not a grade/);
  assert.throws(() => validateRating(NUMBERS, 3, 'b'), /not a grade/);
});

await check('Setting, changing and clearing a rating keeps the file in number order', () => {
  let r = {};
  r = withRating(r, 10, 'A');
  r = withRating(r, 2, 'B-');
  r = withRating(r, 1, 'S+');
  assert.deepEqual(Object.keys(r), ['1', '2', '10']);
  assert.deepEqual(r, { 1: 'S+', 2: 'B-', 10: 'A' });
  r = withRating(r, 2, 'B+');
  assert.equal(r[2], 'B+');
  r = withRating(r, 10, null);
  assert.deepEqual(Object.keys(r), ['1', '2']);
  const before = { 5: 'C' };
  withRating(before, 6, 'A');
  assert.deepEqual(before, { 5: 'C' }); // the original is never changed
});

console.log('\n--- THE SAVING SERVICE ---');

const dir = mkdtempSync(join(tmpdir(), 'popcorn-ratings-'));
const ratingsPath = join(dir, 'ratings.json');
const moviesPath = join(dir, 'movies.json');
writeFileSync(moviesPath, JSON.stringify([1, 2, 3, 10].map((number) => ({ number, myTitle: `My ${number}`, officialTitle: number === 3 ? null : `Movie ${number}` }))));
writeFileSync(ratingsPath, '{}\n');
const server = createServer(createRatingsHandler({ ratingsPath, moviesPath }));
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const host = `127.0.0.1:${server.address().port}`;
const call = (method, body, headers = { 'X-Popcorn-Rate': '1' }) =>
  fetch(`http://${host}/`, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const onDisk = () => JSON.parse(readFileSync(ratingsPath, 'utf8'));

await check('A valid rating is saved to the file, and can be read back', async () => {
  const res = await call('POST', { number: 3, grade: 'B+' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, number: 3, grade: 'B+', rated: 1 });
  assert.deepEqual(onDisk(), { 3: 'B+' });
  await call('POST', { number: 1, grade: 'S' });
  assert.deepEqual(await (await call('GET')).json(), { 1: 'S', 3: 'B+' });
  assert.deepEqual(Object.keys(onDisk()), ['1', '3']);
});

await check('Changing and clearing work', async () => {
  await call('POST', { number: 3, grade: 'A-' });
  assert.equal(onDisk()[3], 'A-');
  await call('POST', { number: 3, grade: null });
  assert.deepEqual(onDisk(), { 1: 'S' });
});

await check('A grade is refused if the movie at that number has changed since the page opened', async () => {
  const before = readFileSync(ratingsPath, 'utf8');
  // the page thinks #2 is "Old Title", but the list now says "Movie 2"
  const stale = await call('POST', { number: 2, grade: 'B', expect: 'Old Title' });
  assert.equal(stale.status, 409);
  assert.match((await stale.json()).error, /#2 is now "Movie 2", not "Old Title".*Reload the page/);
  assert.equal(readFileSync(ratingsPath, 'utf8'), before, 'nothing was saved');
  // when the page and the list agree, it saves
  assert.equal((await call('POST', { number: 2, grade: 'B', expect: 'Movie 2' })).status, 200);
  assert.equal(onDisk()[2], 'B');
  // a movie with no official title falls back to your own title, the same way the site does
  assert.equal((await call('POST', { number: 3, grade: 'C', expect: 'My 3' })).status, 200);
  assert.equal((await call('POST', { number: 3, grade: 'C', expect: 'Movie 3' })).status, 409);
  await call('POST', { number: 2, grade: null });
  await call('POST', { number: 3, grade: null });
  assert.deepEqual(onDisk(), { 1: 'S' });
});

await check('Bad movie numbers, bad grades and bad requests are refused and change nothing', async () => {
  const before = readFileSync(ratingsPath, 'utf8');
  for (const bad of [{ number: 99, grade: 'B' }, { number: 3, grade: 'Z' }, { number: 3, grade: 'b' }, { number: 'x', grade: 'B' }, { number: 3 }, {}, null]) {
    const res = await call('POST', bad);
    assert.equal(res.status, 400, JSON.stringify(bad));
    assert.ok((await res.json()).error);
  }
  const garbage = await fetch(`http://${host}/`, { method: 'POST', headers: { 'X-Popcorn-Rate': '1' }, body: '{not json' });
  assert.equal(garbage.status, 400);
  assert.equal(readFileSync(ratingsPath, 'utf8'), before);
});

await check('Requests without the Popcorn header, or from another website, are refused', async () => {
  const before = readFileSync(ratingsPath, 'utf8');
  assert.equal((await call('POST', { number: 2, grade: 'A' }, {})).status, 403);
  assert.equal((await call('GET', undefined, {})).status, 403);
  assert.equal((await call('POST', { number: 2, grade: 'A' }, { 'X-Popcorn-Rate': '1', Origin: 'https://evil.example' })).status, 403);
  assert.equal((await call('POST', { number: 2, grade: 'A' }, { 'X-Popcorn-Rate': '1', Origin: `http://${host}` })).status, 200); // the real page is allowed
  assert.equal((await call('PUT', { number: 2, grade: 'A' })).status, 405);
  assert.deepEqual(onDisk(), { 1: 'S', 2: 'A' });
  assert.notEqual(readFileSync(ratingsPath, 'utf8'), before);
  assert.ok(!existsSync(`${ratingsPath}.tmp`), 'no temporary file is left behind');
});

await check('A missing ratings file is treated as empty and then created, and an enormous request is cut off', async () => {
  rmSync(ratingsPath);
  assert.deepEqual(await (await call('GET')).json(), {});
  assert.equal((await call('POST', { number: 1, grade: 'A+' })).status, 200);
  assert.deepEqual(onDisk(), { 1: 'A+' });
  writeFileSync(ratingsPath, '{}\n');
  const huge = await fetch(`http://${host}/`, { method: 'POST', headers: { 'X-Popcorn-Rate': '1' }, body: JSON.stringify({ number: 1, grade: 'B', pad: 'x'.repeat(10000) }) }).catch(() => null);
  assert.ok(!huge || huge.status !== 200);
  assert.deepEqual(onDisk(), {});
});

server.close();
console.log(`\nAll ${passed} checks passed.`);
