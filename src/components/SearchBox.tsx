import { useEffect, useId, useState } from 'react';
import { KIND_LABEL, type Suggestion } from '../lib/search';

interface Props {
  value: string;
  onChange: (text: string) => void;
  suggestions: Suggestion[];
  isChosen: (s: Suggestion) => boolean; // already added as a filter
  onChoose: (s: Suggestion) => void;
}

// A search box that narrows the grid by title as you type, and offers matching
// people and studios you can add as filters. It follows the standard "combobox"
// pattern, so arrow keys, Enter and Escape work and screen readers can follow along.
export default function SearchBox({ value, onChange, suggestions, isChosen, onChoose }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const [dismissed, setDismissed] = useState(false); // Escape closed the list

  const open = focused && !dismissed && suggestions.length > 0;
  useEffect(() => {
    setActive(-1);
    setDismissed(false); // typing brings the list back
  }, [value]);

  function choose(s: Suggestion) {
    onChoose(s);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault();
      setActive((active + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length) {
      e.preventDefault();
      setActive(active <= 0 ? suggestions.length - 1 : active - 1);
    } else if (e.key === 'Enter' && open && active >= 0) {
      e.preventDefault();
      choose(suggestions[active]);
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setDismissed(true); // close the list, keep the text
        setActive(-1);
      } else if (value) {
        onChange('');
      }
    }
  }

  return (
    <div className="relative mb-5">
      <label htmlFor={`${id}-input`} className="sr-only">
        Search titles, actors, directors and studios
      </label>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="8.5" cy="8.5" r="5.5" />
        <path d="M13 13l4 4" strokeLinecap="round" />
      </svg>
      <input
        id={`${id}-input`}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        value={value}
        name="search"
        placeholder="Search titles, actors, directors, studios…"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        className="w-full rounded-full border border-field bg-panel py-3 pl-12 pr-4 text-text placeholder:text-muted"
      />

      <ul
        id={listId}
        role="listbox"
        aria-label="Suggested people and studios"
        hidden={!open}
        className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-line bg-panel shadow-xl shadow-black/60"
      >
        {suggestions.map((s, i) => (
          <li
            key={`${s.kind}:${s.name}`}
            id={`${id}-opt-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => e.preventDefault()} // keep focus in the box
            onClick={() => choose(s)}
            onMouseEnter={() => setActive(i)}
            className={
              'flex cursor-pointer items-center gap-3 px-4 py-2.5 ' + (i === active ? 'bg-panel-2' : '')
            }
          >
            <span className="min-w-0 flex-1 truncate text-text">{s.name}</span>
            <span className="rounded-md bg-ink px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-gold">
              {KIND_LABEL[s.kind]}
            </span>
            <span className="w-20 text-right text-sm text-muted">
              {isChosen(s) ? 'Added' : `${s.count} ${s.count === 1 ? 'movie' : 'movies'}`}
            </span>
          </li>
        ))}
      </ul>

      <p aria-live="polite" className="sr-only">
        {open ? `${suggestions.length} suggestions. Use the arrow keys, then Enter, to add one as a filter.` : ''}
      </p>
    </div>
  );
}
