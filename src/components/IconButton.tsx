import { useId, type ReactNode } from 'react';

interface Props {
  label: string; // read out by screen readers AND shown as the tooltip
  onClick: () => void;
  children: ReactNode; // the icon
}

// Every icon-only button gets both an aria-label and a visible tooltip
// that appears on hover and on keyboard focus.
export default function IconButton({ label, onClick, children }: Props) {
  const tipId = useId();
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-describedby={tipId}
        onClick={onClick}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-panel-2 hover:text-text"
      >
        {children}
      </button>
      <span
        id={tipId}
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md border border-line bg-panel-2 px-2 py-1 text-xs text-text opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
