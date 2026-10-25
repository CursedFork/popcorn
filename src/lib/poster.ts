// TMDB serves posters at several widths. The grid uses the mid-size ones.
const BASE = 'https://image.tmdb.org/t/p';

export const posterSrc = (path: string) => `${BASE}/w342${path}`;

export const posterSrcSet = (path: string) =>
  `${BASE}/w185${path} 185w, ${BASE}/w342${path} 342w, ${BASE}/w500${path} 500w`;

// Matches the grid: 2 columns on phones, up to 6 on wide screens.
export const POSTER_SIZES =
  '(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 46vw';
