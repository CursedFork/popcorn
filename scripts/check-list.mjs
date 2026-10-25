// npm run check-list   reads data/movies.txt and reports problems. No internet needed.
import { readFile } from 'node:fs/promises';
import { parseList, describeProblems } from './lib/parse.mjs';
import { paths } from './lib/run.mjs';
import { parseArgs } from './lib/args.mjs';

const p = paths(parseArgs(process.argv.slice(2)));
for (const line of describeProblems(parseList(await readFile(p.list, 'utf8')))) console.log(line);
