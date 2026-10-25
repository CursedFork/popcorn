import { useEffect, useRef, useState } from 'react';
import type { GridMovie } from '../lib/movies';
import { POSTER_SIZES, posterSrc, posterSrcSet } from '../lib/poster';
import PosterPlaceholder from './PosterPlaceholder';

interface Props {
  movie: GridMovie;
  eager: boolean; // true for the first row, so the top of the page isn't blank
  priority: boolean; // the very first posters get the browser's top download priority
  onOpen: (number: number) => void;
}

export default function MovieCard({ movie, eager, priority, onOpen }: Props) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);

  // If the poster failed before the page came alive, onError never ran. Catch that here.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  const showPoster = movie.posterPath && !failed;
  const label = movie.year ? `${movie.title} (${movie.year})` : movie.title;

  return (
    <li className="card-item">
      <button
        type="button"
        onClick={() => onOpen(movie.number)}
        aria-haspopup="dialog"
        aria-label={`${label}, list number ${movie.number}. Open details`}
        className="group block w-full rounded-xl text-left"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-line bg-panel-2 shadow-lg shadow-black/40 transition-colors group-hover:border-gold">
          {showPoster ? (
            <img
              ref={img}
              src={posterSrc(movie.posterPath!)}
              srcSet={posterSrcSet(movie.posterPath!)}
              sizes={POSTER_SIZES}
              alt={`Poster for ${label}`}
              width="342"
              height="513"
              loading={eager ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : undefined}
              decoding="async"
              onError={() => setFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <PosterPlaceholder title={movie.title} />
          )}

          <span className="absolute left-2 top-2 rounded-full bg-gold px-2.5 py-1 text-sm font-bold leading-none text-[#1a1204] shadow-md shadow-black/50">
            <span aria-hidden="true">{movie.number}</span>
          </span>

          {movie.comingSoon && (
            <span className="absolute inset-x-2 bottom-2 rounded-md bg-ink/85 px-2 py-1 text-center text-xs font-semibold uppercase tracking-wider text-gold">
              Coming soon
            </span>
          )}
        </div>

        <span className="mt-2 block text-sm font-semibold leading-snug text-text">{movie.title}</span>
        <span className="block text-sm text-muted">{movie.year ?? 'Date to be announced'}</span>
      </button>
    </li>
  );
}
