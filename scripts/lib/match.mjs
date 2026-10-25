// Picks the best TMDB match for one line of the list, or says why it can't.
import { searchMovies } from './tmdb.mjs';

export const MIN_VOTES = 25; // fewer votes than this and we ask Andrew to look
export const DOMINANCE = 5; // the top result needs 5x the votes of the runner-up
export const MIN_UPCOMING_POPULARITY = 20; // an unreleased match must be a real, talked-about film

// Lowercase, no accents, no punctuation or spaces, so "Spider-Man" equals "Spider Man".
// A leading "The", "A" or "An" is ignored too, so "Blair Witch Project" finds "The Blair Witch Project".
export const normalize = (text) =>
  (text ?? '')
    .normalize('NFKD')
    .replace(/^\s*(the|an|a)\s+/i, '')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');

export const yearOf = (date) => (date ? Number(date.slice(0, 4)) : null);

function describe(result) {
  const first = (result.overview ?? '').split(/(?<=[.!?])\s/)[0].trim();
  const short = first.length > 140 ? first.slice(0, 137) + '...' : first;
  return {
    id: result.id,
    title: result.title,
    year: yearOf(result.release_date),
    votes: result.vote_count ?? 0,
    description: short || '(no description on TMDB)',
  };
}

// Returns { id } on a clear match, or { flag, candidates } when a person should look.
export async function findMatch({ title, year }, today) {
  let results = (await searchMovies(title, year)).results ?? [];
  const closeEnough = (r) => yearOf(r.release_date) !== null && Math.abs(yearOf(r.release_date) - year) <= 1;

  let pool = year ? results.filter(closeEnough) : results;
  if (year && pool.length === 0) {
    // TMDB's year filter is strict, so try once more without it and allow one year off.
    results = (await searchMovies(title)).results ?? [];
    pool = results.filter(closeEnough);
  }

  if (results.length === 0) return { flag: 'Nothing was found on TMDB.', candidates: [] };

  const candidates = (pool.length ? pool : results).slice(0, 3).map(describe);

  const wanted = normalize(title);
  let exact = pool.filter(
    (r) => normalize(r.title) === wanted || normalize(r.original_title) === wanted,
  );
  if (year) {
    const sameYear = exact.filter((r) => yearOf(r.release_date) === year);
    if (sameYear.length) exact = sameYear;
  }
  if (exact.length === 0) {
    return { flag: 'No result has exactly this title (and year, if you gave one).', candidates };
  }

  exact.sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0));
  const [best, runnerUp] = exact;
  if (runnerUp && (best.vote_count ?? 0) < DOMINANCE * (runnerUp.vote_count ?? 0)) {
    return {
      flag: `Several movies share this exact title and none clearly stands out (${best.vote_count} votes vs ${runnerUp.vote_count}).`,
      candidates: exact.slice(0, 3).map(describe),
    };
  }

  const notOutYet = !best.release_date || best.release_date > today;
  if (notOutYet && (best.popularity ?? 0) < MIN_UPCOMING_POPULARITY) {
    return {
      flag: 'The best match is not out yet and nobody is paying attention to it, so it may be a placeholder and not the movie you meant.',
      candidates,
    };
  }
  if (!notOutYet && (best.vote_count ?? 0) < MIN_VOTES) {
    return {
      flag: `The best match has very few votes (${best.vote_count}), so it may be the wrong movie.`,
      candidates,
    };
  }
  return { id: best.id };
}
