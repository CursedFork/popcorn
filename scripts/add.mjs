// npm run add -- "210. The Batman (2022)"            insert a movie at rank 210
// npm run add -- "210. The Batman (2022)" "305. Heat (1995)"    several at once
// npm run add -- --file new-movies.txt               read the lines from a file
// npm run add -- --dry ...                           show the plan, change nothing
//
// Everything from the new rank onward moves down by one, and the numbers are updated in
// the list, the saved data, overrides.json, ratings.json and the fix-batch files together. A backup of
// each file is kept in data/backups/ first. Then the lookup runs for the new movie.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { paths, readJson, run } from './lib/run.mjs';
import { checkInStep, parseNewMovies, planInserts } from './lib/insert.mjs';

function readArgs(argv) {
  const opts = { texts: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') opts.dry = true;
    else if (a === '--allow-duplicate') opts.allowDuplicate = true;
    else if (a === '--file') opts.texts.push(readFileSync(argv[++i], 'utf8'));
    else if (a === '--list') opts.listPath = argv[++i];
    else if (a === '--out') opts.outPath = argv[++i];
    else if (a.startsWith('--')) throw new Error(`I don't understand "${a}".`);
    else opts.texts.push(a);
  }
  return opts;
}

const write = (file, text) => writeFileSync(file, text);
const json = (data) => JSON.stringify(data, null, 2) + '\n';

async function main() {
  const opts = readArgs(process.argv.slice(2));
  if (opts.texts.length === 0) {
    throw new Error('Tell me what to add, like: npm run add -- "210. The Batman (2022)"  (add --dry to preview)');
  }
  const p = paths(opts);
  const dataDir = dirname(p.list);

  const { inserts, problems } = parseNewMovies(opts.texts);
  if (problems.length) throw new Error(problems.join('\n'));
  if (inserts.length === 0) throw new Error('I did not find any movie lines to add.');

  const ratingsPath = join(dataDir, 'ratings.json');
  const batchNames = readdirSync(dataDir).filter((f) => /^batch-fixes.*\.txt$/.test(f)).sort();
  const state = {
    listText: readFileSync(p.list, 'utf8'),
    movies: await readJson(p.out, []),
    overrides: await readJson(p.overrides, {}),
    ratings: await readJson(ratingsPath, {}),
    batches: Object.fromEntries(batchNames.map((f) => [f, readFileSync(join(dataDir, f), 'utf8')])),
  };

  checkInStep(state.listText, state.movies);
  const plan = planInserts(state, inserts, { allowDuplicate: opts.allowDuplicate });

  console.log(opts.dry ? 'DRY RUN. Nothing will be changed.\n' : 'Plan:\n');
  for (const s of plan.steps) {
    console.log(`  Add  ${s.line}`);
    console.log(
      s.pushes
        ? `       ${s.moved} later movies move down by one (old #${s.firstOld} to #${s.lastOld} become #${s.firstOld + 1} to #${s.lastOld + 1}).`
        : '       It goes at the end, so no other movie changes number.',
    );
  }
  const t = plan.totals;
  console.log(
    `\n  Number changes: ${t.listLines} lines in movies.txt, ${t.movies} saved movies, ${t.overrides} overrides, ${t.ratings} ratings, ${t.batchLines} lines in fix files.`,
  );
  console.log(`  The lookup will make about ${inserts.length * 2} TMDB requests for the new movie${inserts.length > 1 ? 's' : ''}.`);
  console.log(`  After this the list has ${plan.movies.length + inserts.length} movies.`);
  if (opts.dry) {
    console.log('\nLooks fine? Run the same command without --dry to do it.');
    return;
  }

  // Backups first, so any change can be undone by copying the files back.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = join(dataDir, 'backups', stamp);
  mkdirSync(backup, { recursive: true });
  for (const file of [p.list, p.overrides, p.out, ratingsPath, ...batchNames.map((f) => join(dataDir, f))]) {
    try {
      copyFileSync(file, join(backup, basename(file)));
    } catch {
      // a file that doesn't exist yet needs no backup
    }
  }

  write(p.list, plan.listText);
  write(p.out, json(plan.movies));
  write(p.overrides, json(plan.overrides));
  if (existsSync(ratingsPath)) write(ratingsPath, json(plan.ratings));
  for (const [name, text] of Object.entries(plan.batches)) write(join(dataDir, name), text);
  console.log(`\nRenumbered. Backup of the old files: ${backup}\n`);

  // Look up only the new movies. If this fails (no internet, say), the renumbering is
  // already done, and `npm run lookup` finishes the job later.
  const numbers = inserts.map((i) => i.rank);
  try {
    await run({ ...opts, numbers });
  } catch (error) {
    console.error(`\nThe numbers are updated, but the lookup stopped: ${error.message}`);
    console.error('Run  npm run lookup  to finish looking up the new movie.');
    process.exitCode = 1;
    return;
  }

  console.log('\nWhat it matched:');
  const saved = await readJson(p.out, []);
  for (const n of numbers) {
    const m = saved.find((x) => x.number === n);
    if (!m) continue;
    if (m.status === 'needs review') {
      console.log(`  #${n} ${m.myTitle}: NEEDS REVIEW. ${m.reason}`);
      for (const c of m.candidates) console.log(`      TMDB ${c.id}: ${c.title} (${c.year ?? '?'}) ${c.description}`);
      console.log(`      Pick the right one with:  npm run fix ${n} <TMDB id>`);
    } else {
      console.log(`  #${n} ${m.myTitle} -> ${m.officialTitle} (${m.year ?? 'no date'}), ${m.status}`);
      console.log(`      directed by ${m.directors.join(', ') || 'unknown'}; stars ${m.stars.slice(0, 3).join(', ') || 'unknown'}`);
    }
  }
  console.log('\nCheck the match above. If it is right, commit and push to update the live site.');
}

try {
  await main();
} catch (error) {
  console.error(`\nStopped: ${error.message}`);
  process.exit(1);
}
