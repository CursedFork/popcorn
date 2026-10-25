// Turns command-line words into options. Numbers pick movies; flags change behavior.
// --list and --out exist so a test list can be run without touching the real files.
export function parseArgs(argv) {
  const opts = { numbers: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') opts.all = true;
    else if (a === '--dry') opts.dry = true;
    else if (a === '--list') opts.listPath = argv[++i];
    else if (a === '--out') opts.outPath = argv[++i];
    else if (a === '--file') opts.batchFile = argv[++i];
    else if (/^\d+$/.test(a)) opts.numbers.push(Number(a));
    else throw new Error(`I don't understand "${a}".`);
  }
  return opts;
}
