// Your ratings live in data/ratings.json as { "12": "B+", "40": "S", ... }.
// The key is the movie's list number, the same way overrides.json works.
import { isGrade } from './grades.ts';

export type Ratings = Record<string, string>;

// Throws a plain-language Error if this rating can't be saved.
export function validateRating(listNumbers: Set<number>, number: unknown, grade: unknown): void {
  if (!Number.isInteger(number) || !listNumbers.has(number as number)) {
    throw new Error(`#${String(number)} is not a movie on your list.`);
  }
  if (grade !== null && !isGrade(grade)) {
    throw new Error(`"${String(grade)}" is not a grade. Use S, A, B, C, D, E or F, with an optional + or -.`);
  }
}

// Returns a new ratings object with this movie's grade set (or removed, if grade is null),
// with the keys in number order so the file stays tidy and easy to compare.
export function withRating(ratings: Ratings, number: number, grade: string | null): Ratings {
  const next: Ratings = { ...ratings };
  if (grade === null) delete next[number];
  else next[number] = grade;
  return Object.fromEntries(Object.entries(next).sort((a, b) => Number(a[0]) - Number(b[0])));
}

export const countRated = (ratings: Ratings, listNumbers: Set<number>): number =>
  Object.keys(ratings).filter((n) => listNumbers.has(Number(n))).length;
