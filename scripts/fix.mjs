// npm run fix 123 603      use TMDB movie 603 for list number 123
// npm run fix 123 manual   type the details yourself (adds a template to overrides.json)
// npm run fix 123 clear    remove the override and go back to automatic matching
// Overrides always win over automatic matching. Find TMDB ids in data/review-report.md
// or in the address of a movie page on themoviedb.org (themoviedb.org/movie/603).
import { run, paths, readJson, writeJson } from './lib/run.mjs';
import { parseArgs } from './lib/args.mjs';
import { parseList } from './lib/parse.mjs';
import { getDetails } from './lib/tmdb.mjs';
import { readFile } from 'node:fs/promises';

async function main() {
  const [numberArg, action, ...rest] = process.argv.slice(2);
  if (!/^\d+$/.test(numberArg ?? '') || !action) {
    throw new Error('Usage: npm run fix <list number> <TMDB id | manual | clear>');
  }
  const number = Number(numberArg);
  const flags = parseArgs(rest);
  const p = paths(flags);

  const { entries } = parseList(await readFile(p.list, 'utf8'));
  const entry = entries.find((e) => e.number === number);
  if (!entry) throw new Error(`Number ${number} is not in ${p.list}`);

  const overrides = await readJson(p.overrides, {});

  if (action === 'clear') {
    delete overrides[number];
    console.log(`Removed the override for #${number}.`);
  } else if (action === 'manual') {
    overrides[number] = typeof overrides[number] === 'object' ? overrides[number] : {
      officialTitle: entry.title,
      releaseDate: null,
      genres: [],
      overview: '',
      posterPath: null,
      stars: [],
      directors: [],
      studios: [],
    };
    console.log(`Added a manual template for #${number} in ${p.overrides}. Fill in what you know there.`);
  } else if (/^\d+$/.test(action)) {
    const id = Number(action);
    let found;
    try {
      found = await getDetails(id);
    } catch (error) {
      if (error.notFound) throw new Error(`TMDB has no movie with id ${id}.`);
      throw error;
    }
    console.log(`TMDB ${id} is "${found.title}" (${(found.release_date ?? '').slice(0, 4) || 'no date'}).`);
    overrides[number] = id;
  } else {
    throw new Error(`"${action}" is not a TMDB id, "manual", or "clear".`);
  }

  await writeJson(p.overrides, overrides);
  await run({ ...flags, numbers: [number] });
}

try {
  await main();
} catch (error) {
  console.error(`\nStopped: ${error.message}`);
  process.exit(1);
}
