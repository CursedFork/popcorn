// The rating scale: S, A, B, C, D, E and F, each with a plus and a minus.
// Best to worst: S+, S, S-, A+, A, A-, B+, B, B-, ... F+, F, F-  (21 grades).

export const LETTERS = ['S', 'A', 'B', 'C', 'D', 'E', 'F'] as const;
export type Letter = (typeof LETTERS)[number];

const MODIFIERS = ['+', '', '-'] as const;

export const GRADES: string[] = LETTERS.flatMap((letter) => MODIFIERS.map((m) => `${letter}${m}`));

export const isGrade = (value: unknown): value is string =>
  typeof value === 'string' && GRADES.includes(value);

// Bigger is better, so S+ is 21 and F- is 1. Handy for sorting and averages.
export const gradeScore = (grade: string): number => GRADES.length - GRADES.indexOf(grade);

// Sort comparator: best grade first.
export const compareGrades = (a: string, b: string): number => GRADES.indexOf(a) - GRADES.indexOf(b);

export const letterOf = (grade: string): Letter => grade[0] as Letter;

// Typing a grade on the keyboard: press a letter, then "+", "-", or Enter for no sign.
//   b then +     -> B+          b then Enter -> B          b then -     -> B-
// `pending` is the letter waiting for its sign. Pressing a different letter swaps it.
// Returns the new pending letter and, once a grade is complete, the grade to save.
export function applyKey(pending: Letter | null, key: string): { pending: Letter | null; grade: string | null } {
  const upper = key.length === 1 ? key.toUpperCase() : key;

  if ((LETTERS as readonly string[]).includes(upper)) return { pending: upper as Letter, grade: null };
  if (key === 'Escape') return { pending: null, grade: null };
  if (!pending) return { pending: null, grade: null };

  if (key === '+' || key === '=') return { pending: null, grade: `${pending}+` };
  if (key === '-' || key === '_') return { pending: null, grade: `${pending}-` };
  if (key === 'Enter' || key === ' ') return { pending: null, grade: pending };
  return { pending, grade: null };
}
