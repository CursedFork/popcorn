import { useId } from 'react';
import { LETTERS } from '../lib/grades';
import { FACETS, type FacetKey, type Facets, type MatchMode, type Selected } from '../lib/filters';
import FilterSection from './FilterSection';

interface Props {
  facets: Facets;
  selected: Selected;
  mode: MatchMode;
  onToggle: (key: FacetKey, name: string) => void;
  onSetGroup: (key: FacetKey, names: string[], on: boolean) => void;
  onModeChange: (mode: MatchMode) => void;
}

const MODES: { value: MatchMode; label: string }[] = [
  { value: 'loose', label: 'Loose' },
  { value: 'strict', label: 'Strict' },
];

export default function FilterPanel({ facets, selected, mode, onToggle, onSetGroup, onModeChange }: Props) {
  const labelId = useId();

  // One button per letter that selects or clears all of its grades at once (S+, S and S-).
  const gradeQuickPicks = (
    <div role="group" aria-label="Pick a whole letter" className="mb-3 flex flex-wrap gap-1.5">
      {LETTERS.map((letter) => {
        const names = facets.grade.map((o) => o.name).filter((n) => n.startsWith(letter));
        if (names.length === 0) return null;
        const all = names.every((n) => selected.grade.includes(n));
        return (
          <button
            key={letter}
            type="button"
            aria-pressed={all}
            aria-label={`All ${letter} grades`}
            onClick={() => onSetGroup('grade', names, !all)}
            className={
              'h-10 w-10 rounded-lg border text-base font-bold transition-colors ' +
              (all ? 'border-gold bg-gold text-[#1a1204]' : 'border-line bg-panel text-text hover:border-gold hover:bg-panel-2')
            }
          >
            {letter}
          </button>
        );
      })}
    </div>
  );

  return (
    <div>
      <div className="border-b border-line pb-4">
        <p id={labelId} className="mb-2 font-semibold text-text">
          Match
        </p>
        <div
          role="group"
          aria-labelledby={labelId}
          className="inline-flex rounded-full border border-line bg-panel p-1"
        >
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={mode === m.value}
              onClick={() => onModeChange(m.value)}
              className={
                'rounded-full px-4 py-2 text-sm font-medium transition-colors ' +
                (mode === m.value ? 'bg-gold text-[#1a1204]' : 'text-muted hover:bg-panel-2 hover:text-text')
              }
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">
          {mode === 'loose'
            ? 'Loose: a movie can match any one of your genre, star, director or studio picks.'
            : 'Strict: a movie must match every one of your genre, star, director and studio picks.'}{' '}
          Decades and grades always narrow the list.
        </p>
      </div>

      {FACETS.map((facet) => (
        <FilterSection
          key={facet.key}
          label={facet.label}
          noun={facet.noun}
          options={facets[facet.key]}
          selected={selected[facet.key]}
          showAll={facet.key === 'decade' || facet.key === 'grade'}
          onToggle={(name) => onToggle(facet.key, name)}
          header={facet.key === 'grade' ? gradeQuickPicks : undefined}
        />
      ))}
    </div>
  );
}
