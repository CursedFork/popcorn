import { forwardRef } from 'react';
import { FACETS, type FacetKey, type Selected } from '../lib/filters';

interface Props {
  selected: Selected;
  query: string;
  onRemove: (key: FacetKey, name: string) => void;
  onClearQuery: () => void;
  onClearAll: () => void;
}

const X = (
  <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5 text-gold" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
  </svg>
);

const chipClass =
  'inline-flex items-center gap-1.5 rounded-full border border-gold/60 bg-panel px-3 py-2 text-sm text-text transition-colors hover:bg-panel-2';

// One removable chip for the search text and for each chosen option, plus "Clear all".
const FilterChips = forwardRef<HTMLDivElement, Props>(function FilterChips(
  { selected, query, onRemove, onClearQuery, onClearAll },
  ref,
) {
  const chips = FACETS.flatMap((facet) =>
    selected[facet.key].map((name) => ({ key: facet.key, label: facet.label, name })),
  );
  const text = query.trim();
  if (chips.length === 0 && !text) return null;

  return (
    <div
      ref={ref}
      role="group"
      aria-label="Selected filters"
      tabIndex={-1}
      className="mb-5 flex flex-wrap items-center gap-2"
    >
      {text && (
        <button type="button" onClick={onClearQuery} aria-label={`Remove search: ${text}`} className={chipClass}>
          Title: “{text}”{X}
        </button>
      )}
      {chips.map((chip) => (
        <button
          key={`${chip.key}:${chip.name}`}
          type="button"
          onClick={() => onRemove(chip.key, chip.name)}
          aria-label={`Remove ${chip.label} filter: ${chip.name}`}
          className={chipClass}
        >
          {chip.name}
          {X}
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="px-2 py-1.5 text-sm font-medium text-gold underline underline-offset-4"
      >
        Clear all
      </button>
    </div>
  );
});

export default FilterChips;
