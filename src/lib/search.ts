// The top search box. Typing narrows the grid by title, and also suggests
// matching people and studios you can add as filters.
import type { FacetKey, Facets } from './filters';
import type { GridMovie } from './movies';

// Lowercase, no accents, punctuation turned into spaces: "Spider-Man" becomes "spider man".
export const normalizeText = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const compact = (normalized: string) => normalized.replace(/ /g, '');

// A title matches when every word you typed appears in it, or when what you typed
// run together appears in it ("spiderman" finds "Spider-Man").
export function titleMatches(title: string, query: string): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  const t = normalizeText(title);
  return q.split(' ').every((word) => t.includes(word)) || compact(t).includes(compact(q));
}

export const filterByTitle = (movies: GridMovie[], query: string) =>
  query.trim() ? movies.filter((m) => titleMatches(m.title, query)) : movies;

export type SuggestionKind = Extract<FacetKey, 'star' | 'director' | 'studio'>;

export interface Suggestion {
  kind: SuggestionKind;
  name: string;
  count: number;
}

export const KIND_LABEL: Record<SuggestionKind, string> = {
  star: 'Star',
  director: 'Director',
  studio: 'Studio',
};

interface Indexed extends Suggestion {
  norm: string;
}

export function buildSearchIndex(facets: Facets): Indexed[] {
  const kinds: SuggestionKind[] = ['star', 'director', 'studio'];
  return kinds.flatMap((kind) =>
    facets[kind].map((o) => ({ kind, name: o.name, count: o.count, norm: normalizeText(o.name) })),
  );
}

// People first (stars and directors), then studios. Names with a word that starts like
// what you typed come before names that merely contain it, and busier names come first
// within each group, so "disney" offers "Walt Disney" before a small channel.
export function suggest(index: Indexed[], query: string, limits = { people: 5, studios: 3 }): Suggestion[] {
  const q = normalizeText(query);
  if (q.length < 2) return [];
  const words = q.split(' ');
  const rank = (e: Indexed) => (e.norm.split(' ').some((w) => w.startsWith(words[0])) ? 0 : 1);

  const hits = index
    .filter((e) => words.every((w) => e.norm.includes(w)) || compact(e.norm).includes(compact(q)))
    .map((e) => ({ e, r: rank(e) }))
    .sort((a, b) => a.r - b.r || b.e.count - a.e.count || a.e.name.localeCompare(b.e.name));

  const people = hits.filter((h) => h.e.kind !== 'studio').slice(0, limits.people);
  const studios = hits.filter((h) => h.e.kind === 'studio').slice(0, limits.studios);
  return [...people, ...studios].map(({ e }) => ({ kind: e.kind, name: e.name, count: e.count }));
}
