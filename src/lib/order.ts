import { gradeScore } from './grades.ts';
import type { GridMovie } from './movies';

export type SortOrder = 'mine' | 'release' | 'rating';

// "mine" is exactly your numbering. "release" is oldest first, and movies released on the
// same date stay in your number order. "rating" is your best grade first, with movies that
// share a grade in your number order, and movies without a grade at the end.
export function sortMovies(movies: GridMovie[], order: SortOrder): GridMovie[] {
  const copy = [...movies];
  if (order === 'mine') return copy.sort((a, b) => a.number - b.number);
  if (order === 'rating') {
    const score = (m: GridMovie) => (m.rating ? gradeScore(m.rating) : 0);
    return copy.sort((a, b) => score(b) - score(a) || a.number - b.number);
  }
  return copy.sort((a, b) => {
    if (a.releaseDate === b.releaseDate) return a.number - b.number;
    if (!a.releaseDate) return 1; // no date goes last
    if (!b.releaseDate) return -1;
    return a.releaseDate < b.releaseDate ? -1 : 1;
  });
}
