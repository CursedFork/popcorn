import { useEffect, useRef, type ReactNode } from 'react';
import IconButton from './IconButton';

interface Props {
  open: boolean;
  onClose: () => void;
  resultCount: number;
  children: ReactNode;
}

// The phone version of the filters. A native <dialog> gives us Escape to close,
// a focus trap, and a dimmed backdrop without extra code.
export default function FilterDrawer({ open, onClose, resultCount, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-label="Filters"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose(); // a click on the dimmed area
      }}
      className="m-0 h-full max-h-none w-[min(24rem,92vw)] border-r border-line bg-ink p-0 text-text backdrop:bg-black/70 lg:hidden"
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <h2 className="font-display text-xl font-bold">Filters</h2>
            <IconButton label="Close filters" onClick={onClose}>
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              </svg>
            </IconButton>
          </div>
          <div className="flex-1 overflow-y-auto px-4">{children}</div>
          <div className="border-t border-line p-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full bg-gold px-4 py-3 font-semibold text-[#1a1204]"
            >
              Show {resultCount} {resultCount === 1 ? 'movie' : 'movies'}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
