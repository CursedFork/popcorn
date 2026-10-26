// Filter rules. Filtering only ever hides movies; it never changes their order.
import type { GridMovie } from './movies';
import type { SortOrder } from './order';
import { filterByTitle } from './search.ts';
import { GRADES } from './grades.ts';

export type FacetKey = 'decade' | 'grade' | 'genre' | 'star' | 'director' | 'studio';
export type MatchMode = 'loose' | 'strict';

export const FACETS: { key: FacetKey; label: string; noun: string }[] = [
  { key: 'decade', label: 'Decade', noun: 'decades' },
  { key: 'grade', label: 'Grade', noun: 'grades' },
  { key: 'genre', label: 'Genre', noun: 'genres' },
  { key: 'star', label: 'Stars', noun: 'stars' },
  { key: 'director', label: 'Directors', noun: 'directors' },
  { key: 'studio', label: 'Studio', noun: 'studios' },
];

export type Selected = Record<FacetKey, string[]>;
export interface FacetOption {
  name: string;
  count: number;
}
export type Facets = Record<FacetKey, FacetOption[]>;

export const emptySelection = (): Selected => ({
  decade: [],
  grade: [],
  genre: [],
  star: [],
  director: [],
  studio: [],
});

export const selectedCount = (selected: Selected) =>
  FACETS.reduce((total, f) => total + selected[f.key].length, 0);

const OTHER_KEYS = ['genre', 'star', 'director', 'studio'] as const;

function valuesOf(movie: GridMovie, key: FacetKey): string[] {
  switch (key) {
    case 'decade':
      return movie.decade ? [movie.decade] : [];
    case 'grade':
      return movie.rating ? [movie.rating] : [];
    case 'genre':
      return movie.genres;
    case 'star':
      return movie.stars;
    case 'director':
      return movie.directors;
    case 'studio':
      return movie.studios;
  }
}

// Counts always come from the whole list, so they don't change as you filter.
export function buildFacets(movies: GridMovie[]): Facets {
  const facets = {} as Facets;
  for (const { key } of FACETS) {
    const counts = new Map<string, number>();
    for (const movie of movies) {
      for (const name of new Set(valuesOf(movie, key))) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    const options = [...counts].map(([name, count]) => ({ name, count }));
    // Decades read oldest to newest, and grades read best to worst (S+ down to F-).
    // Everything else: most common first, then A to Z.
    options.sort(
      key === 'decade'
        ? (a, b) => a.name.localeCompare(b.name)
        : key === 'grade'
          ? (a, b) => GRADES.indexOf(a.name) - GRADES.indexOf(b.name)
          : (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    );
    facets[key] = options;
  }
  return facets;
}

// The search box narrows by title. Decade and grade narrow too: a movie must be in ANY of
// the chosen decades, and have ANY of the chosen grades (a movie only has one grade, so
// "all of" would never make sense). Genres, stars, directors and studios are pooled together:
//   loose  = the movie matches ANY of the picks
//   strict = the movie matches EVERY one of the picks
export function filterMovies(
  movies: GridMovie[],
  selected: Selected,
  mode: MatchMode = 'loose',
  query = '',
): GridMovie[] {
  const picks = OTHER_KEYS.flatMap((key) => selected[key].map((name) => ({ key, name })));
  const hit = (movie: GridMovie) => (p: { key: FacetKey; name: string }) =>
    valuesOf(movie, p.key).includes(p.name);

  return filterByTitle(movies, query).filter((movie) => {
    if (selected.decade.length && !(movie.decade && selected.decade.includes(movie.decade))) {
      return false;
    }
    if (selected.grade.length && !(movie.rating && selected.grade.includes(movie.rating))) {
      return false;
    }
    if (picks.length === 0) return true;
    return mode === 'strict' ? picks.every(hit(movie)) : picks.some(hit(movie));
  });
}

const joinOr = (items: string[]) =>
  items.length <= 2 ? items.join(' or ') : `${items.slice(0, -1).join(', ')}, or ${items.at(-1)}`;

// The one plain sentence shown above the results.
export function describeResults(args: {
  shown: number;
  total: number;
  selected: Selected;
  mode: MatchMode;
  order: SortOrder;
  query?: string;
}): string {
  const { shown, total, selected, mode, order } = args;
  const query = (args.query ?? '').trim();
  const picks = OTHER_KEYS.flatMap((key) => selected[key]);
  const noun = shown === 1 ? 'movie' : 'movies';
  const orderText =
    order === 'mine' ? "in Andrew's order" : order === 'rating' ? 'best grade first' : 'oldest release first';

  if (picks.length === 0 && selected.decade.length === 0 && selected.grade.length === 0 && !query) {
    return `Showing all ${total} movies, ${orderText}.`;
  }

  let sentence = `Showing ${shown} of ${total} ${noun}`;
  if (query) sentence += ` with “${query}” in the title`;
  if (selected.grade.length) {
    sentence += `${query ? ',' : ''} graded ${joinOr(selected.grade)}`;
  }
  if (selected.decade.length) {
    sentence += `${query || selected.grade.length ? ',' : ''} released in the ${joinOr(selected.decade)}`;
  }
  if (picks.length) {
    sentence += ` that match ${mode === 'strict' ? 'ALL' : 'ANY'} of: ${picks.join(', ')}`;
  }
  return `${sentence}, ${orderText}.`;
}
