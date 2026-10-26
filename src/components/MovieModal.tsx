import { useEffect, useRef, useState } from 'react';
import type { GridMovie } from '../lib/movies';
import type { FacetKey } from '../lib/filters';
import { getOverviews } from '../lib/overviews';
import { shortDescription } from '../lib/text';
import { posterSrc, posterSrcSet } from '../lib/poster';
import IconButton from './IconButton';
import PosterPlaceholder from './PosterPlaceholder';
import ShareButton from './ShareButton';
import GradeBadge from './GradeBadge';

type NameKey = Extract<FacetKey, 'grade' | 'genre' | 'star' | 'director' | 'studio'>;

interface Props {
  movie: GridMovie | null;
  onClose: () => void;
  onFilter: (key: NameKey, name: string) => void;
  getShareLink: () => string; // a link that includes this movie
  shareTitle: string;
  surprise: boolean; // opened by "Surprise me", so "Pick another" shows
  canPickAnother: boolean;
  onPickAnother: () => void;
}

const GROUPS: { key: NameKey; label: string; pick: (m: GridMovie) => string[] }[] = [
  { key: 'genre', label: 'Genres', pick: (m) => m.genres },
  { key: 'star', label: 'Stars', pick: (m) => m.stars },
  { key: 'director', label: 'Directors', pick: (m) => m.directors },
  { key: 'studio', label: 'Studios', pick: (m) => m.studios },
];

function Description({ number }: { number: number }) {
  const [overviews, setOverviews] = useState<Record<string, string> | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getOverviews().then(
      (data) => !cancelled && setOverviews(data),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (failed) {
    return (
      <p className="text-muted">
        The description didn't load.{' '}
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            setAttempt(attempt + 1);
          }}
          className="text-gold underline underline-offset-4"
        >
          Try again
        </button>
      </p>
    );
  }

  if (!overviews) {
    // Placeholder lines shaped like a short paragraph, so nothing jumps when the text arrives.
    return (
      <div role="status" aria-label="Loading description…" className="space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-panel-2" />
        <div className="h-4 w-11/12 animate-pulse rounded bg-panel-2" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-panel-2" />
      </div>
    );
  }

  const { short, full, hasMore } = shortDescription(overviews[String(number)] ?? '');
  if (!full) return <p className="text-muted">No description is available for this movie.</p>;

  return (
    <div>
      <p className="leading-relaxed text-text">{expanded ? full : short}</p>
      {hasMore && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-sm font-medium text-gold underline underline-offset-4"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

function ModalPoster({ movie }: { movie: GridMovie }) {
  const [failed, setFailed] = useState(false);
  const label = movie.year ? `${movie.title} (${movie.year})` : movie.title;
  return (
    <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-line bg-panel-2 shadow-lg shadow-black/50">
      {movie.posterPath && !failed ? (
        <img
          src={posterSrc(movie.posterPath)}
          srcSet={posterSrcSet(movie.posterPath)}
          sizes="(min-width: 640px) 13rem, 12rem"
          alt={`Poster for ${label}`}
          width="342"
          height="513"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <PosterPlaceholder title={movie.title} />
      )}
      <span className="absolute left-2 top-2 rounded-full bg-gold px-3 py-1.5 text-base font-bold leading-none text-[#1a1204] shadow-md shadow-black/50">
        <span className="sr-only">List number </span>
        {movie.number}
      </span>
    </div>
  );
}

function Detail({ movie, onClose, onFilter, getShareLink, shareTitle, surprise, canPickAnother, onPickAnother }: Props & { movie: GridMovie }) {
  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 id="movie-title" className="font-display text-2xl font-bold leading-tight sm:text-3xl">
            {movie.title}
          </h2>
          <p className="mt-1 text-muted">
            {movie.year ?? 'Date to be announced'}
            {movie.comingSoon && (
              <span className="ml-3 rounded-md bg-ink px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-gold">
                Coming soon
              </span>
            )}
          </p>
          {movie.rating && (
            <p className="mt-2 flex items-center gap-2 text-sm text-muted">
              My grade
              <button
                type="button"
                onClick={() => onFilter('grade', movie.rating!)}
                aria-label={`Show movies graded ${movie.rating}`}
                className="rounded-full transition-transform hover:scale-105"
              >
                <GradeBadge grade={movie.rating} large />
              </button>
            </p>
          )}
        </div>
        <IconButton label="Close details" onClick={onClose}>
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
          </svg>
        </IconButton>
      </div>

      <div className="grid gap-6 sm:grid-cols-[13rem_minmax(0,1fr)]">
        <div className="mx-auto w-48 sm:w-full">
          <ModalPoster key={movie.number} movie={movie} />
        </div>

        <div className="min-w-0 space-y-5">
          <Description key={movie.number} number={movie.number} />

          <div className="flex flex-wrap items-center gap-3">
            <ShareButton getLink={getShareLink} title={shareTitle} />
            {surprise && (
              <button
                type="button"
                onClick={onPickAnother}
                disabled={!canPickAnother}
                className="rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-[#1a1204] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Pick another
              </button>
            )}
          </div>
          {surprise && !canPickAnother && (
            <p className="text-sm text-muted">That's the only movie in these results to pick from.</p>
          )}

          {GROUPS.map((group) => {
            const names = group.pick(movie);
            if (names.length === 0) return null;
            return (
              <section key={group.key} aria-label={group.label}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">{group.label}</h3>
                <ul className="flex flex-wrap gap-2">
                  {names.map((name) => (
                    <li key={name}>
                      <button
                        type="button"
                        onClick={() => onFilter(group.key, name)}
                        aria-label={`Show movies with ${name}`}
                        className="rounded-full border border-line bg-ink px-3 py-2 text-sm text-text transition-colors hover:border-gold hover:text-gold"
                      >
                        {name}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      {/* Tells screen readers a new movie has appeared when "Pick another" swaps it. */}
      <p aria-live="polite" className="sr-only">
        {surprise ? `Now showing ${movie.title}` : ''}
      </p>
    </div>
  );
}

// A native <dialog>: Escape closes it, focus stays inside while it is open, and
// focus goes back to the card you opened it from when it closes.
export default function MovieModal(props: Props) {
  const { movie, onClose } = props;
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (movie && !el.open) el.showModal();
    if (!movie && el.open) el.close();
  }, [movie]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={movie ? 'movie-title' : undefined}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose(); // a click on the dimmed area
      }}
      className="m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-3xl overflow-y-auto rounded-2xl border border-line bg-panel p-0 text-text backdrop:bg-black/80"
    >
      {movie && <Detail {...props} movie={movie} />}
    </dialog>
  );
}
