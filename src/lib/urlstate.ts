// The page address holds the whole view, so a link reproduces it exactly.
//   ?q=scream&genre=Drama&star=Tom+Hanks&decade=1990s&match=strict&sort=release&movie=55
// Every option repeats its own parameter, because names can contain commas.
// Parameters this file doesn't own are left alone.
import { FACETS, emptySelection, type MatchMode, type Selected } from './filters.ts';
import { isGrade } from './grades.ts';
import type { SortOrder } from './order.ts';

export interface ViewState {
  selected: Selected;
  mode: MatchMode;
  order: SortOrder;
  query: string; // the search box
  movie: number | null; // the open detail view, by your list number
}

const OWNED = [...FACETS.map((f) => f.key as string), 'match', 'sort', 'q', 'movie'];

export function readState(search: string): ViewState {
  const params = new URLSearchParams(search);
  const selected = emptySelection();
  for (const { key } of FACETS) selected[key] = [...new Set(params.getAll(key))];
  // In an address a bare "+" means a space, so a hand-typed ?grade=B+ arrives as "B ".
  // Read that as B+, and ignore anything that is not a real grade.
  selected.grade = [
    ...new Set(selected.grade.map((g) => (g.endsWith(' ') ? `${g.trimEnd()}+` : g)).filter(isGrade)),
  ];
  const movie = Number(params.get('movie'));
  const sort = params.get('sort');
  return {
    selected,
    mode: params.get('match') === 'strict' ? 'strict' : 'loose',
    order: sort === 'release' ? 'release' : sort === 'grade' ? 'rating' : 'mine',
    query: params.get('q') ?? '',
    movie: Number.isInteger(movie) && movie > 0 ? movie : null,
  };
}

// A complete link someone can open to see exactly this view, such as
// https://popcorn.example/?genre=Horror&sort=release&movie=43
export function shareLink(base: string, state: ViewState): string {
  return base + writeState('', state);
}

// Returns the new query string (with its "?"), or "" if there is nothing to say.
export function writeState(search: string, state: ViewState): string {
  const params = new URLSearchParams(search);
  for (const name of OWNED) params.delete(name);
  if (state.query.trim()) params.set('q', state.query.trim());
  for (const { key } of FACETS) for (const name of state.selected[key]) params.append(key, name);
  if (state.mode === 'strict') params.set('match', 'strict');
  if (state.order === 'release') params.set('sort', 'release');
  if (state.order === 'rating') params.set('sort', 'grade');
  if (state.movie !== null) params.set('movie', String(state.movie));
  const text = params.toString();
  return text ? `?${text}` : '';
}
