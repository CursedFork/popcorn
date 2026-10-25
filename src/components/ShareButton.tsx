import { useEffect, useRef, useState } from 'react';

interface Props {
  getLink: () => string; // builds the link at the moment you press the button
  title: string;
  className?: string;
}

// Copies text without needing the newer clipboard API (which some browsers hide on
// non-secure pages). The temporary box goes inside an open dialog if there is one,
// because everything outside a dialog is locked while it is open.
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fall through to the older way
  }
  try {
    const box = document.createElement('textarea');
    box.value = text;
    box.setAttribute('readonly', '');
    box.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    (document.querySelector('dialog[open]') ?? document.body).appendChild(box);
    box.select();
    const ok = document.execCommand('copy');
    box.remove();
    return ok;
  } catch {
    return false;
  }
}

// On a phone this opens the share sheet. Everywhere else, it copies the link.
export default function ShareButton({ getLink, title, className = '' }: Props) {
  const [message, setMessage] = useState('');
  const timer = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function flash(text: string) {
    setMessage(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(''), 3000);
  }

  async function share() {
    const url = getLink();
    const onPhone = window.matchMedia('(pointer: coarse)').matches;
    if (onPhone && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if ((error as Error).name === 'AbortError') return; // you closed the share sheet
        // anything else: fall back to copying
      }
    }
    flash((await copyText(url)) ? 'Link copied' : 'Could not copy. Copy the address bar instead.');
  }

  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={share}
        className={
          'inline-flex items-center gap-2 rounded-full border border-line bg-panel px-4 py-2.5 text-sm font-medium text-text hover:bg-panel-2 ' +
          className
        }
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10 13V3M6 6l4-4 4 4M4 11v5h12v-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Share
      </button>
      <span role="status" className="text-sm font-medium text-gold">
        {message}
      </span>
    </span>
  );
}
