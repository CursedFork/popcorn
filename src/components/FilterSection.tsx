import { useId, useMemo, useState } from 'react';
import type { FacetOption } from '../lib/filters';

const FIRST_SHOWN = 8; // the most common options, before you search or press "Show more"
const SEARCH_SHOWN = 30; // how many search matches to list at first
const STEP = 25;

interface Props {
  label: string;
  noun: string; // "genres", used in the search box label
  options: FacetOption[]; // already sorted
  selected: string[];
  showAll: boolean; // decades are few, so they always list in full
  onToggle: (name: string) => void;
}

export default function FilterSection({ label, noun, options, selected, showAll, onToggle }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false); // sections start closed
  const [query, setQuery] = useState('');
  const [extra, setExtra] = useState(0);

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => (q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options),
    [options, q],
  );

  const limit = (q ? SEARCH_SHOWN : FIRST_SHOWN) + extra;
  let visible = showAll ? matches : matches.slice(0, limit);
  if (!showAll && !q) {
    // Keep chosen options visible even if they aren't among the most common.
    const shown = new Set(visible.map((o) => o.name));
    visible = [...visible, ...options.filter((o) => selected.includes(o.name) && !shown.has(o.name))];
  }
  const remaining = showAll ? 0 : matches.length - Math.min(matches.length, limit);

  return (
    <div className="border-b border-line">
      <h3>
        <button
          type="button"
          id={`${id}-button`}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between gap-2 px-1 py-3 text-left font-semibold text-text"
        >
          <span>
            {label}
            {selected.length > 0 && (
              <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-[#1a1204]">
                {selected.length}
                <span className="sr-only"> selected</span>
              </span>
            )}
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className={'h-5 w-5 shrink-0 text-muted transition-transform ' + (open ? 'rotate-180' : '')}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </h3>

      <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-button`} hidden={!open} className="pb-4">
        <label htmlFor={`${id}-search`} className="sr-only">
          Search {noun}
        </label>
        <input
          id={`${id}-search`}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setExtra(0);
          }}
          name={`search-${noun}`}
          placeholder={`Search ${noun}…`}
          autoComplete="off"
          spellCheck={false}
          className="mb-2 w-full rounded-lg border border-field bg-panel px-3 py-2 text-sm text-text placeholder:text-muted"
        />

        <ul>
          {visible.map((option) => {
            const checkboxId = `${id}-${option.name}`;
            return (
              <li key={option.name}>
                <label
                  htmlFor={checkboxId}
                  className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 text-sm text-text hover:bg-panel-2"
                >
                  <input
                    id={checkboxId}
                    type="checkbox"
                    checked={selected.includes(option.name)}
                    onChange={() => onToggle(option.name)}
                    className="h-4 w-4 shrink-0 accent-[#f2b134]"
                  />
                  <span className="min-w-0 flex-1 break-words">{option.name}</span>
                  <span className="tabular-nums text-muted">{option.count}</span>
                </label>
              </li>
            );
          })}
        </ul>

        <p aria-live="polite" className="px-1 py-2 text-sm text-muted">
          {visible.length === 0 ? `No ${noun} match "${query.trim()}".` : ''}
        </p>

        {!showAll && (remaining > 0 || extra > 0) && (
          <div className="flex gap-4 px-1">
            {remaining > 0 && (
              <button
                type="button"
                onClick={() => setExtra(extra + STEP)}
                className="min-h-10 text-sm font-medium text-gold underline underline-offset-4"
              >
                Show more ({remaining} left)
              </button>
            )}
            {extra > 0 && (
              <button
                type="button"
                onClick={() => setExtra(0)}
                className="min-h-10 text-sm font-medium text-muted underline underline-offset-4"
              >
                Show fewer
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
