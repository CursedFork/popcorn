import { letterOf } from '../lib/grades';

// Your grade as a small pill. S grades get a thicker gold ring so your favorites stand out.
export default function GradeBadge({ grade, large = false }: { grade: string; large?: boolean }) {
  const top = letterOf(grade) === 'S';
  return (
    <span
      className={
        'rounded-full bg-ink/90 font-bold leading-none text-gold shadow-md shadow-black/50 ' +
        (top ? 'ring-2 ring-gold ' : 'ring-1 ring-gold/60 ') +
        (large ? 'px-3 py-1.5 text-base' : 'px-2.5 py-1 text-sm')
      }
    >
      <span className="sr-only">Your grade </span>
      {grade}
    </span>
  );
}
