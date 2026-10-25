// The one place the site name and basic facts live. Change them here only.
export const site = {
  name: 'Popcorn',
  tagline: "Andrew's personal movie list, in the exact order he ranks them.",
  // Used in the browser tab and in search results for the home page.
  titleTagline: 'A personal ranked movie list',
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Stats', href: '/stats' },
    { label: 'About', href: '/about' },
  ],
  themeColor: '#0b0a09',
  // Wording from TMDB's developer FAQ (checked 2026-10-25). Re-check before launch.
  tmdbNotice: 'This product uses the TMDB API but is not endorsed or certified by TMDB.',
};
