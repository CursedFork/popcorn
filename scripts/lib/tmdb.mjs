// Small TMDB client: one request at a time, a short pause between requests,
// and a few retries. It never prints the request URL, because that holds the key.

const BASE = 'https://api.themoviedb.org/3';
const DELAY_MS = 250;

let lastRequestAt = 0;
export let requestCount = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fatal(message) {
  const error = new Error(message);
  error.fatal = true;
  return error;
}

export async function tmdb(path, params = {}) {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw fatal('TMDB_API_KEY is missing. Copy .env.example to .env and add your key.');

  const url = new URL(BASE + path);
  url.searchParams.set('api_key', key);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(name, String(value));
  }

  for (let attempt = 1; attempt <= 4; attempt++) {
    const wait = lastRequestAt + DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    requestCount++;

    let response;
    try {
      response = await fetch(url);
    } catch (error) {
      if (attempt === 4) {
        throw new Error(`Network problem talking to TMDB (${error.cause?.code ?? error.message})`);
      }
      await sleep(1000 * attempt);
      continue;
    }

    if (response.status === 429) {
      await sleep((Number(response.headers.get('retry-after')) || 2) * 1000);
      continue;
    }
    if (response.status === 401) {
      throw fatal('TMDB rejected the API key (401). Check TMDB_API_KEY in your .env file.');
    }
    if (response.status >= 500 && attempt < 4) {
      await sleep(1000 * attempt);
      continue;
    }
    if (response.status === 404) {
      const error = new Error(`TMDB has nothing at ${path} (404)`);
      error.notFound = true;
      throw error;
    }
    if (!response.ok) throw new Error(`TMDB error ${response.status} for ${path}`);
    return response.json();
  }
  throw new Error(`Gave up on ${path} after several tries`);
}

export const searchMovies = (query, year) =>
  tmdb('/search/movie', { query, year, include_adult: 'false', language: 'en-US' });

export const getDetails = (id) =>
  tmdb(`/movie/${id}`, { append_to_response: 'credits', language: 'en-US' });
