// Shown when a movie has no poster, or its poster fails to load.
export default function PosterPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-panel-2 to-ink p-4 text-center">
      <img src="/popcorn-bucket.svg" alt="" width="40" height="40" className="h-10 w-10 opacity-40" />
      <span className="font-display text-lg font-bold leading-tight text-text">{title}</span>
    </div>
  );
}
