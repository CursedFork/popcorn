import { useEffect, useMemo, useRef, useState } from 'react';
import type { GridMovie } from '../lib/movies';
import { sortMovies, type SortOrder } from '../lib/order';
import {
  buildFacets,
  describeResults,
  emptySelection,
  filterMovies,
  selectedCount,
  type FacetKey,
  type MatchMode,
  type Selected,
} from '../lib/filters';
import { buildSearchIndex, suggest, type Suggestion } from '../lib/search';
import { getOverviews } from '../lib/overviews';
import { canPickAnother, pickSurprise } from '../lib/surprise';
import { readState, shareLink, writeState } from '../lib/urlstate';
import { site } from '../config/site';
import MovieCard from './MovieCard';
import MovieModal from './MovieModal';
import SearchBox from './SearchBox';
import ShareButton from './ShareButton';
import FilterPanel from './FilterPanel';
import FilterDrawer from './FilterDrawer';
import FilterChips from './FilterChips';

const OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'mine', label: 'My order' },
  { value: 'release', label: 'Release order' },
  { value: 'rating', label: 'Best rated' },
];

export default function MovieGrid({ movies }: { movies: GridMovie[] }) {
  const [order, setOrder] = useState<SortOrder>('mine');
  const [selected, setSelected] = useState<Selected>(emptySelection);
  const [mode, setMode] = useState<MatchMode>('loose');
  const [query, setQuery] = useState('');
  const [openNumber, setOpenNumber] = useState<number | null>(null); // the open detail view
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ready, setReady] = useState(false); // true once the page address has been read
  const [surprise, setSurprise] = useState(false); // the open detail view came from "Surprise me"
  const [lastPick, setLastPick] = useState<number | null>(null);
  const [surpriseNote, setSurpriseNote] = useState('');

  const chipsRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLParagraphElement>(null);

  const facets = useMemo(() => buildFacets(movies), [movies]);
  const searchIndex = useMemo(() => buildSearchIndex(facets), [facets]);
  const suggestions = useMemo(() => suggest(searchIndex, query), [searchIndex, query]);
  const shown = useMemo(
    () => sortMovies(filterMovies(movies, selected, mode, query), order),
    [movies, selected, mode, query, order],
  );
  const openMovie = useMemo(
    () => (openNumber === null ? null : (movies.find((m) => m.number === openNumber) ?? null)),
    [movies, openNumber],
  );
  const chosen = selectedCount(selected) + (query.trim() ? 1 : 0);

  // On load, pick up the view stored in the page address (a shared link).
  useEffect(() => {
    const state = readState(window.location.search);
    setSelected(state.selected);
    setMode(state.mode);
    setOrder(state.order);
    setQuery(state.query);
    setOpenNumber(movies.some((m) => m.number === state.movie) ? state.movie : null);
    setReady(true);
  }, [movies]);

  // Afterwards, keep the address in step with the view.
  useEffect(() => {
    if (!ready) return;
    const text = writeState(window.location.search, { selected, mode, order, query, movie: openNumber });
    window.history.replaceState(null, '', window.location.pathname + text + window.location.hash);
  }, [ready, selected, mode, order, query, openNumber]);

  // The browser tab names the open movie, and goes back to the page title when it closes.
  const pageTitle = useRef('');
  useEffect(() => {
    if (!pageTitle.current) pageTitle.current = document.title;
    document.title = openMovie
      ? `${openMovie.title}${openMovie.year ? ` (${openMovie.year})` : ''} | ${site.name}`
      : pageTitle.current;
  }, [openMovie]);

  // Quietly fetch the descriptions once the page is idle, so the detail view opens instantly.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((run: () => void) => window.setTimeout(run, 1500));
    idle(() => void getOverviews().catch(() => {}));
  }, []);

  // If the window grows past phone size while the drawer is open, close it.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)');
    const close = () => wide.matches && setDrawerOpen(false);
    wide.addEventListener('change', close);
    return () => wide.removeEventListener('change', close);
  }, []);

  // Choosing the first decade switches to release order, and clearing the last one
  // switches back. The toggle still lets you flip it whenever you like.
  function applySelection(next: Selected) {
    // (Only between my order and release order. If you chose "Best rated", it stays.)
    if (selected.decade.length === 0 && next.decade.length > 0 && order === 'mine') setOrder('release');
    if (selected.decade.length > 0 && next.decade.length === 0 && order === 'release') setOrder('mine');
    setSelected(next);
  }

  function toggle(key: FacetKey, name: string) {
    const has = selected[key].includes(name);
    applySelection({
      ...selected,
      [key]: has ? selected[key].filter((n) => n !== name) : [...selected[key], name],
    });
  }

  // Turns a whole group on or off in one step (the "S" button picks S+, S and S-).
  function setGroup(key: FacetKey, names: string[], on: boolean) {
    const without = selected[key].filter((n) => !names.includes(n));
    applySelection({ ...selected, [key]: on ? [...without, ...names] : without });
  }

  // Adds a filter, and does nothing if it is already on (unlike toggle).
  function addFilter(key: FacetKey, name: string) {
    if (!selected[key].includes(name)) toggle(key, name);
  }

  function focusAfterChange() {
    requestAnimationFrame(() => {
      const next = chipsRef.current?.querySelector<HTMLElement>('button');
      (next ?? summaryRef.current)?.focus();
    });
  }

  function removeChip(key: FacetKey, name: string) {
    toggle(key, name);
    focusAfterChange();
  }

  function clearQuery() {
    setQuery('');
    focusAfterChange();
  }

  function clearAll() {
    applySelection(emptySelection());
    setQuery('');
    requestAnimationFrame(() => summaryRef.current?.focus());
  }

  function chooseSuggestion(s: Suggestion) {
    addFilter(s.kind, s.name);
    setQuery(''); // the name is now a filter, so the box is free for the next search
  }

  // A name in the detail view: add it as a filter, close the view, and land on the results.
  function filterFromModal(key: FacetKey, name: string) {
    addFilter(key, name);
    closeDetail();
    window.setTimeout(() => summaryRef.current?.focus(), 50);
  }

  function openCard(number: number) {
    setSurprise(false); // a card you chose yourself, not a surprise
    setOpenNumber(number);
  }

  function closeDetail() {
    setOpenNumber(null);
    setSurprise(false);
  }

  // Picks from what is showing right now, and opens it.
  function pickSurpriseMovie() {
    const pick = pickSurprise(shown, lastPick);
    if (!pick) {
      setSurpriseNote(
        'Nothing to pick from here. Either no movies match, or the only ones left are Coming soon. Try loosening a filter.',
      );
      return;
    }
    setSurpriseNote('');
    setLastPick(pick.number);
    setSurprise(true);
    setOpenNumber(pick.number);
  }

  // The current view as a link anyone can open. Inside the detail view it includes that movie.
  function getLink(includeMovie: boolean) {
    return shareLink(window.location.origin + window.location.pathname, {
      selected,
      mode,
      order,
      query,
      movie: includeMovie ? openNumber : null,
    });
  }

  // The old "nothing to pick" message no longer applies once the results change.
  useEffect(() => setSurpriseNote(''), [shown]);

  const panel = (
    <FilterPanel
      facets={facets}
      selected={selected}
      mode={mode}
      onToggle={toggle}
      onSetGroup={setGroup}
      onModeChange={setMode}
    />
  );

  return (
    <section aria-label="Movies">
      <SearchBox
        value={query}
        onChange={setQuery}
        suggestions={suggestions}
        isChosen={(s) => selected[s.kind].includes(s.name)}
        onChoose={chooseSuggestion}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p ref={summaryRef} tabIndex={-1} aria-live="polite" className="max-w-prose text-muted">
          {describeResults({ shown: shown.length, total: movies.length, selected, mode, order, query })}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setDrawerOpen(true)}
            className="rounded-full border border-line bg-panel px-4 py-2.5 text-sm font-medium text-text hover:bg-panel-2 lg:hidden"
          >
            Filters{chosen > 0 && ` (${chosen})`}
          </button>

          <button
            type="button"
            onClick={pickSurpriseMovie}
            className="rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-[#1a1204] hover:brightness-110"
          >
            Surprise me
          </button>

          <ShareButton getLink={() => getLink(false)} title={site.name} />

          <div
            role="group"
            aria-label="Sort order"
            className="inline-flex rounded-full border border-line bg-panel p-1"
          >
            {OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={order === option.value}
                onClick={() => setOrder(option.value)}
                className={
                  'rounded-full px-4 py-2 text-sm font-medium transition-colors ' +
                  (order === option.value
                    ? 'bg-gold text-[#1a1204]'
                    : 'text-muted hover:bg-panel-2 hover:text-text')
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p role="status" className={surpriseNote ? 'mb-4 rounded-xl border border-line bg-panel p-4 text-muted' : 'sr-only'}>
        {surpriseNote}
      </p>

      <FilterChips
        ref={chipsRef}
        selected={selected}
        query={query}
        onRemove={removeChip}
        onClearQuery={clearQuery}
        onClearAll={clearAll}
      />

      <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <aside
          aria-label="Filters"
          className="sticky top-20 hidden max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 lg:block"
        >
          {panel}
        </aside>

        {shown.length === 0 ? (
          <p className="rounded-xl border border-line bg-panel p-6 text-muted">
            No movies match that yet. Try changing the search, removing a filter, or switching Match
            to Loose, and the list will fill back in.
          </p>
        ) : (
          <div>
            {/* With nearly a thousand cards, keyboard users need a way past them. */}
            <a href="#site-footer" className="skip-inline">
              Skip the movie list
            </a>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {shown.map((movie, index) => (
                <MovieCard
                  key={movie.number}
                  movie={movie}
                  eager={index < 6}
                  priority={index < 2}
                  onOpen={openCard}
                />
              ))}
            </ul>
          </div>
        )}
      </div>

      <FilterDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} resultCount={shown.length}>
        {panel}
      </FilterDrawer>

      <MovieModal
        movie={openMovie}
        onClose={closeDetail}
        onFilter={filterFromModal}
        getShareLink={() => getLink(true)}
        shareTitle={site.name}
        surprise={surprise}
        canPickAnother={canPickAnother(shown)}
        onPickAnother={pickSurpriseMovie}
      />
    </section>
  );
}
