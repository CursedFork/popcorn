import type { GridMovie } from './movies';

// "Surprise me": a random movie from what is currently showing.
//  - "Coming soon" movies are never picked.
//  - It won't repeat the last pick, unless that is the only choice left.
//  - It returns null when there is nothing to pick from.
// `random` can be swapped for a fixed one in tests.
export function pickSurprise(
  shown: GridMovie[],
  previous: number | null,
  random: () => number = Math.random,
): GridMovie | null {
  const candidates = shown.filter((m) => !m.comingSoon);
  if (candidates.length === 0) return null;
  const pool = candidates.length > 1 ? candidates.filter((m) => m.number !== previous) : candidates;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

export const canPickAnother = (shown: GridMovie[]) => shown.filter((m) => !m.comingSoon).length > 1;
