import type { GridMovie } from './movies';

export type SortOrder = 'mine' | 'release';

// "mine" is exactly your numbering. "release" is oldest first, and movies
// released on the same date stay in your number order.
export function sortMovies(movies: GridMovie[], order: SortOrder): GridMovie[] {
  const copy = [...movies];
  if (order === 'mine') return copy.sort((a, b) => a.number - b.number);
  return copy.sort((a, b) => {
    if (a.releaseDate === b.releaseDate) return a.number - b.number;
    if (!a.releaseDate) return 1; // no date goes last
    if (!b.releaseDate) return -1;
    return a.releaseDate < b.releaseDate ? -1 : 1;
  });
}
