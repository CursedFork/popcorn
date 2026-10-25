// npm run fix-batch -- --dry   show what would change, change nothing
// npm run fix-batch            apply every line of data/batch-fixes.txt as an override
// Add --file data/other-file.txt to use a different file.
// Each line is: list number, then TMDB id. Anything after a # is a note for you.
//   30 566525   # Shang Chi => Shang-Chi and the Legend of the Ten Rings (2021)
// Delete a line to skip that movie. Overrides always win over automatic matching.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { run, paths, readJson, writeJson } from './lib/run.mjs';
import { parseArgs } from './lib/args.mjs';
import { parseList } from './lib/parse.mjs';

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const p = paths(flags);
  const file = flags.batchFile ?? join(dirname(p.list), 'batch-fixes.txt');

  const { entries } = parseList(await readFile(p.list, 'utf8'));
  const inList = new Set(entries.map((e) => e.number));
  const overrides = await readJson(p.overrides, {});

  const picks = new Map();
  (await readFile(file, 'utf8')).split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) return;
    const m = line.match(/^(\d+)\s+(\d+)$/);
    if (!m) throw new Error(`${file} line ${i + 1}: expected "number id", got "${raw.trim()}"`);
    const [number, id] = [Number(m[1]), Number(m[2])];
    if (!inList.has(number)) throw new Error(`${file} line ${i + 1}: number ${number} is not in your list`);
    if (picks.has(number)) throw new Error(`${file} line ${i + 1}: number ${number} appears twice`);
    picks.set(number, id);
  });

  const changes = [...picks].filter(([n, id]) => overrides[n] !== id);
  console.log(`${picks.size} line(s) in the file, ${changes.length} would change an override.`);
  if (flags.dry) {
    console.log('Dry run: nothing was changed.');
    return;
  }
  for (const [n, id] of changes) overrides[n] = id;
  await writeJson(p.overrides, overrides);
  await run({ ...flags, numbers: changes.map(([n]) => n) });
}

try {
  await main();
} catch (error) {
  console.error(`\nStopped: ${error.message}`);
  process.exit(1);
}
