// npm run lookup               only new or changed movies
// npm run lookup 12 40         re-run just those numbers
// npm run refresh              look up every movie again (do this every few months)
// Add --dry to see how many requests it would make without making any.
import { run } from './lib/run.mjs';
import { parseArgs } from './lib/args.mjs';

try {
  await run(parseArgs(process.argv.slice(2)));
} catch (error) {
  console.error(`\nStopped: ${error.message}`);
  process.exit(1);
}
