// LOCAL ONLY. This page exists while you run `npm run dev` and is never part of the live site.
// One movie at a time: pick a grade with a click or the keyboard, and it saves and moves on.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GridMovie } from '../../lib/movies';
import { LETTERS, applyKey, type Letter } from '../../lib/grades';
import { withRating, type Ratings } from '../../lib/ratings';
import { getOverviews } from '../../lib/overviews';
import { shortDescription } from '../../lib/text';
import { posterSrcSet } from '../../lib/poster';
import PosterPlaceholder from '../PosterPlaceholder';

const HEADERS = { 'Content-Type': 'application/json', 'X-Popcorn-Rate': '1' };

// `expect` is the title this page is showing for that number. The saving service refuses the
// grade if the list has changed since the page opened, so a grade can't land on the wrong movie.
async function saveRating(number: number, grade: string | null, expect: string) {
  const response = await fetch('/__ratings', { method: 'POST', headers: HEADERS, body: JSON.stringify({ number, grade, expect }) });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? `The save failed (${response.status}).`);
}

const nextIn = (list: GridMovie[], after: number) => list.find((m) => m.number > after) ?? list[0] ?? null;
const prevIn = (list: GridMovie[], before: number) => [...list].reverse().find((m) => m.number < before) ?? list.at(-1) ?? null;

function Blurb({ number }: { number: number }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setText(null);
    getOverviews().then(
      (all) => !cancelled && setText(shortDescription(all[String(number)] ?? '').short),
      () => !cancelled && setText(''),
    );
    return () => {
      cancelled = true;
    };
  }, [number]);
  if (text === null) return <div className="h-12 animate-pulse rounded bg-panel-2" aria-hidden="true" />;
  return <p className="leading-relaxed text-muted">{text}</p>;
}

export default function RateStation({ movies }: { movies: GridMovie[] }) {
  const [ratings, setRatings] = useState<Ratings>({});
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [current, setCurrent] = useState<number>(movies[0]?.number ?? 1);
  const [mode, setMode] = useState<'unrated' | 'all'>('unrated');
  const [pending, setPending] = useState<Letter | null>(null);
  const [history, setHistory] = useState<{ number: number; previous: string | null }[]>([]);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const jumpRef = useRef<HTMLInputElement>(null);

  const byNumber = useMemo(() => new Map(movies.map((m) => [m.number, m])), [movies]);
  const movie = byNumber.get(current) ?? movies[0];
  const ratedCount = movies.filter((m) => ratings[m.number]).length;
  const unrated = useMemo(() => movies.filter((m) => !ratings[m.number]), [movies, ratings]);
  const list = mode === 'unrated' ? unrated : movies;
  const grade = ratings[current] ?? null;

  // Load what is already saved, and start on the first movie that has no grade.
  useEffect(() => {
    fetch('/__ratings', { headers: HEADERS })
      .then(async (response) => {
        if (!response.ok) throw new Error('The saving service did not answer.');
        const saved: Ratings = await response.json();
        setRatings(saved);
        const first = movies.find((m) => !saved[m.number]);
        if (first) setCurrent(first.number);
        setLoaded(true);
      })
      .catch((error) => setLoadError(`${error.message} Is "npm run dev" still running?`));
  }, [movies]);

  const rate = useCallback(
    async (next: string | null, advance: boolean) => {
      const previous = ratings[current] ?? null;
      setPending(null);
      if (previous === next) {
        if (advance) goTo(nextIn(list, current));
        return;
      }
      const updated = withRating(ratings, current, next);
      setRatings(updated); // show it at once, and take it back if the save fails
      setHistory((h) => [...h.slice(-49), { number: current, previous }]);
      setMessage({ kind: 'ok', text: next ? `Saved #${current} as ${next}` : `Cleared the grade for #${current}` });
      try {
        await saveRating(current, next, movie.title);
      } catch (error) {
        setRatings((r) => withRating(r, current, previous));
        setHistory((h) => h.slice(0, -1));
        setMessage({ kind: 'error', text: `Could not save: ${(error as Error).message}` });
        return;
      }
      if (advance && next) {
        const stillUnrated = movies.filter((m) => !updated[m.number]);
        goTo(nextIn(mode === 'unrated' ? stillUnrated : movies, current));
      }
    },
    [ratings, current, list, mode, movies, movie], // eslint-disable-line react-hooks/exhaustive-deps
  );

  function goTo(target: GridMovie | null) {
    if (target) setCurrent(target.number);
    setPending(null);
    setQuery('');
  }

  async function undo() {
    const last = history.at(-1);
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    const before = ratings[last.number] ?? null;
    setRatings((r) => withRating(r, last.number, last.previous));
    setCurrent(last.number);
    setMessage({ kind: 'ok', text: `Undid the grade for #${last.number}` });
    try {
      await saveRating(last.number, last.previous, byNumber.get(last.number)?.title ?? '');
    } catch (error) {
      setRatings((r) => withRating(r, last.number, before));
      setMessage({ kind: 'error', text: `Could not undo: ${(error as Error).message}` });
    }
  }

  // Keyboard: a letter then + / - / Enter picks a grade. Arrows move. Delete clears. Ctrl+Z undoes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') target.blur();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') return void (e.preventDefault(), undo());
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'ArrowRight') return void (e.preventDefault(), goTo(nextIn(list, current)));
      if (e.key === 'ArrowLeft') return void (e.preventDefault(), goTo(prevIn(list, current)));
      if (e.key === 'Delete' || e.key === 'Backspace') return void (e.preventDefault(), rate(null, false));
      if (e.key === '/') return void (e.preventDefault(), jumpRef.current?.focus());
      if (e.key === 'Enter' && target.tagName === 'BUTTON' && !pending) return; // let a focused button work
      const out = applyKey(pending, e.key);
      if (out.pending !== pending || out.grade) e.preventDefault();
      setPending(out.pending);
      if (out.grade) rate(out.grade, true);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return /^\d+$/.test(q)
      ? movies.filter((m) => String(m.number).startsWith(q)).slice(0, 6)
      : movies.filter((m) => m.title.toLowerCase().includes(q)).slice(0, 6);
  }, [query, movies]);

  if (loadError) return <p role="alert" className="rounded-xl border border-line bg-panel p-6 text-text">{loadError}</p>;
  if (!loaded || !movie) return <p className="text-muted">Loading your ratings…</p>;

  const percent = Math.round((ratedCount / movies.length) * 100);
  const allDone = unrated.length === 0;

  return (
    <div>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Rate your movies</h1>
      <p className="mt-2 text-sm text-muted">
        Local only. This page does not exist on the live site, and your grades save to <code>data/ratings.json</code> as you go.
      </p>

      <div className="mt-5 rounded-2xl border border-line bg-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold">
            {ratedCount} of {movies.length} rated <span className="font-normal text-muted">({percent}%)</span>
          </p>
          <div role="group" aria-label="Which movies to go through" className="inline-flex rounded-full border border-line bg-ink p-1">
            {(['unrated', 'all'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={'rounded-full px-4 py-2 text-sm font-medium ' + (mode === m ? 'bg-gold text-[#1a1204]' : 'text-muted hover:text-text')}
              >
                {m === 'unrated' ? `Unrated (${unrated.length})` : 'All movies'}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink" role="progressbar" aria-valuemin={0} aria-valuemax={movies.length} aria-valuenow={ratedCount} aria-label="Movies rated">
          <div className="h-full rounded-full bg-gold" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {allDone && mode === 'unrated' && (
        <p className="mt-4 rounded-xl border border-gold/60 bg-panel p-4 text-text">Every movie has a grade. Switch to "All movies" to review or change any of them.</p>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-[17rem_minmax(0,1fr)]">
        <div className="mx-auto w-56 md:w-full">
          <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-line bg-panel-2 shadow-lg shadow-black/50">
            {movie.posterPath ? (
              <img src={`https://image.tmdb.org/t/p/w500${movie.posterPath}`} srcSet={posterSrcSet(movie.posterPath)} sizes="17rem" alt={`Poster for ${movie.title}`} width="500" height="750" className="h-full w-full object-cover" />
            ) : (
              <PosterPlaceholder title={movie.title} />
            )}
            <span className="absolute left-2 top-2 rounded-full bg-gold px-3 py-1.5 text-base font-bold leading-none text-[#1a1204]">
              <span className="sr-only">List number </span>
              {movie.number}
            </span>
            {grade && (
              <span className="absolute right-2 top-2 rounded-full border-2 border-gold bg-ink px-3 py-1.5 text-base font-bold leading-none text-gold">
                <span className="sr-only">Your grade </span>
                {grade}
              </span>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div>
            <h2 className="font-display text-2xl font-bold leading-tight sm:text-3xl">{movie.title}</h2>
            <p className="text-muted">
              {movie.year ?? 'Date to be announced'}
              {movie.comingSoon && <span className="ml-3 rounded-md bg-ink px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-gold">Coming soon</span>}
              {movie.genres.length > 0 && ` · ${movie.genres.join(', ')}`}
            </p>
            {movie.directors.length > 0 && <p className="text-sm text-muted">Directed by {movie.directors.join(', ')}</p>}
            {movie.stars.length > 0 && <p className="text-sm text-muted">Starring {movie.stars.slice(0, 4).join(', ')}</p>}
          </div>
          <Blurb number={movie.number} />

          <div>
            <p aria-live="polite" className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">
              Your grade: {pending ? <span className="text-gold">{pending}… press + or - or Enter</span> : <span className="text-text">{grade ?? 'not rated yet'}</span>}
            </p>
            <div role="group" aria-label={`Grade for ${movie.title}`} className="space-y-1.5">
              {LETTERS.map((letter) => (
                <div key={letter} className={'grid grid-cols-[2rem_repeat(3,minmax(0,1fr))] items-center gap-1.5 rounded-xl p-1 ' + (pending === letter ? 'bg-panel-2 ring-2 ring-gold' : '')}>
                  <span className="text-center font-display text-xl font-bold text-gold" aria-hidden="true">{letter}</span>
                  {['+', '', '-'].map((sign) => {
                    const g = `${letter}${sign}`;
                    const selected = grade === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => rate(g, true)}
                        className={'min-h-11 rounded-lg border text-lg font-semibold transition-colors ' + (selected ? 'border-gold bg-gold text-[#1a1204]' : 'border-line bg-panel text-text hover:border-gold hover:bg-panel-2')}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => goTo(prevIn(list, current))} className="rounded-full border border-line bg-panel px-4 py-2.5 text-sm font-medium hover:bg-panel-2">Previous</button>
            <button type="button" onClick={() => goTo(nextIn(list, current))} className="rounded-full border border-line bg-panel px-4 py-2.5 text-sm font-medium hover:bg-panel-2">Skip this one</button>
            <button type="button" onClick={() => rate(null, false)} disabled={!grade} className="rounded-full border border-line bg-panel px-4 py-2.5 text-sm font-medium hover:bg-panel-2 disabled:opacity-40">Clear grade</button>
            <button type="button" onClick={undo} disabled={history.length === 0} className="rounded-full border border-line bg-panel px-4 py-2.5 text-sm font-medium hover:bg-panel-2 disabled:opacity-40">Undo ({history.length})</button>
          </div>

          <p role={message?.kind === 'error' ? 'alert' : 'status'} className={'min-h-6 text-sm font-medium ' + (message?.kind === 'error' ? 'text-red-300' : 'text-gold')}>
            {message?.text}
          </p>
        </div>
      </div>

      <section aria-label="Jump to a movie" className="mt-8 rounded-2xl border border-line bg-panel p-4">
        <label htmlFor="jump" className="font-semibold">Jump to a movie</label>
        <input
          id="jump"
          ref={jumpRef}
          type="search"
          name="jump"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && matches[0] && goTo(matches[0])}
          placeholder="A number or part of a title…"
          className="mt-2 w-full rounded-lg border border-field bg-ink px-3 py-2 text-text placeholder:text-muted"
        />
        {matches.length > 0 && (
          <ul className="mt-2 space-y-1">
            {matches.map((m) => (
              <li key={m.number}>
                <button type="button" onClick={() => goTo(m)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-panel-2">
                  <span className="w-12 font-bold text-gold">#{m.number}</span>
                  <span className="min-w-0 flex-1 truncate">{m.title} <span className="text-muted">({m.year ?? '?'})</span></span>
                  <span className="text-sm font-semibold text-text">{ratings[m.number] ?? ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="mt-4 text-sm text-muted">
        <summary className="cursor-pointer py-2 font-medium text-gold">Keyboard shortcuts</summary>
        <ul className="mt-1 space-y-1">
          <li>Type a letter (S A B C D E F), then <kbd>+</kbd>, <kbd>-</kbd> or <kbd>Enter</kbd> for no sign. It saves and goes to the next movie.</li>
          <li><kbd>←</kbd> and <kbd>→</kbd> move between movies without grading. <kbd>Delete</kbd> clears the grade. <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes.</li>
          <li><kbd>/</kbd> jumps to the search box. <kbd>Esc</kbd> cancels a half-typed grade.</li>
          <li>Best to worst: S+, S, S-, A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, E+, E, E-, F+, F, F-.</li>
        </ul>
      </details>
    </div>
  );
}
