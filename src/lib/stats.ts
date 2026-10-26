// Numbers for the Stats page, covering the whole list.
// Anything based on a release year leaves out movies that aren't released yet.
import { buildFacets, emptySelection, type FacetKey } from './filters.ts';
import { GRADES, gradeScore } from './grades.ts';
import type { GridMovie } from './movies';
import { writeState } from './urlstate.ts';

export interface Count {
  name: string;
  count: number;
  href: string; // the home page with this filter applied
}

export interface Stats {
  total: number;
  released: number;
  notReleased: number;
  byDecade: Count[];
  genres: Count[];
  stars: Count[];
  directors: Count[];
  studios: Count[];
  oldest: GridMovie | null;
  newest: GridMovie | null;
  averageYear: number | null;
  // Your grades, best to worst. Only grades you actually gave are listed.
  grades: Count[];
  graded: number;
  averageGrade: { grade: string; score: number } | null; // score runs 21 (S+) down to 1 (F-)
  commonGrade: { grade: string; count: number } | null;
  best: { grade: string; movies: GridMovie[] } | null; // every movie with your highest grade
  worst: { grade: string; movies: GridMovie[] } | null; // every movie with your lowest grade
}

// A link to the home page showing just this one filter. Decades link to release
// order, because that is what picking a decade does on the home page.
export function filterLink(key: FacetKey, name: string): string {
  const selected = emptySelection();
  selected[key] = [name];
  const query = writeState('', {
    selected,
    mode: 'loose',
    order: key === 'decade' ? 'release' : 'mine',
    query: '',
    movie: null,
  });
  return `/${query}`;
}

export const movieLink = (number: number) => `/?movie=${number}`;

const byDate = (a: GridMovie, b: GridMovie) =>
  a.releaseDate! < b.releaseDate! ? -1 : a.releaseDate! > b.releaseDate! ? 1 : a.number - b.number;

export function computeStats(movies: GridMovie[], top = 10): Stats {
  const released = movies.filter((m) => !m.comingSoon);
  const dated = released.filter((m) => m.releaseDate && m.year !== null).sort(byDate);

  const facets = buildFacets(movies); // most common first, ties A to Z
  const topOf = (key: FacetKey): Count[] =>
    facets[key].slice(0, top).map((o) => ({ name: o.name, count: o.count, href: filterLink(key, o.name) }));

  const decadeCounts = new Map<string, number>();
  for (const m of released) if (m.decade) decadeCounts.set(m.decade, (decadeCounts.get(m.decade) ?? 0) + 1);

  const graded = movies.filter((m) => m.rating);
  const gradeCounts = new Map<string, number>();
  for (const m of graded) gradeCounts.set(m.rating!, (gradeCounts.get(m.rating!) ?? 0) + 1);
  const grades = GRADES.filter((g) => gradeCounts.has(g)).map((g) => ({
    name: g,
    count: gradeCounts.get(g)!,
    href: filterLink('grade', g),
  }));
  const meanScore = graded.length ? graded.reduce((sum, m) => sum + gradeScore(m.rating!), 0) / graded.length : null;
  const common = [...grades].sort((a, b) => b.count - a.count || GRADES.indexOf(a.name) - GRADES.indexOf(b.name))[0];
  const pick = (grade: string | undefined) =>
    grade ? { grade, movies: graded.filter((m) => m.rating === grade) } : null;

  return {
    grades,
    graded: graded.length,
    averageGrade: meanScore === null ? null : { grade: GRADES[GRADES.length - Math.round(meanScore)], score: meanScore },
    commonGrade: common ? { grade: common.name, count: common.count } : null,
    best: pick(grades[0]?.name),
    worst: pick(grades.at(-1)?.name),
    total: movies.length,
    released: released.length,
    notReleased: movies.length - released.length,
    byDecade: [...decadeCounts]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count, href: filterLink('decade', name) })),
    genres: topOf('genre'),
    stars: topOf('star'),
    directors: topOf('director'),
    studios: topOf('studio'),
    oldest: dated[0] ?? null,
    newest: dated.at(-1) ?? null,
    averageYear: dated.length ? dated.reduce((sum, m) => sum + m.year!, 0) / dated.length : null,
  };
}
