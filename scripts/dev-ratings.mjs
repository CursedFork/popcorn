// The rating tool's behind-the-scenes parts. Both pieces only exist while you run
// `npm run dev` on your own computer. Neither is part of the website you deploy.
//
//   devRatings()    a small saving service at /__ratings that reads and writes data/ratings.json
//   devRateRoute()  adds the /rate page, in development only
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateRating, withRating } from '../src/lib/ratings.ts';

// Builds the request handler. Kept separate from the plugin so it can be tested on its own.
export function createRatingsHandler({ ratingsPath, moviesPath }) {
  const readMovies = () => JSON.parse(readFileSync(moviesPath, 'utf8'));
  const listNumbers = () => new Set(readMovies().map((m) => m.number));
  const readRatings = () => (existsSync(ratingsPath) ? JSON.parse(readFileSync(ratingsPath, 'utf8')) : {});

  return (req, res) => {
    const send = (status, body) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(body));
    };

    // Only the rating page may use this. Browsers make other websites ask permission before
    // sending a custom header like this one, and they are never granted it, so a random
    // website you visit cannot change your ratings.
    if (req.headers['x-popcorn-rate'] !== '1') return send(403, { error: 'Not allowed.' });
    const origin = req.headers.origin;
    if (origin) {
      let sameHost = false;
      try {
        sameHost = new URL(origin).host === req.headers.host;
      } catch {
        // an unreadable origin counts as foreign
      }
      if (!sameHost) return send(403, { error: 'Not allowed.' });
    }

    if (req.method === 'GET') {
      try {
        return send(200, readRatings());
      } catch {
        return send(500, { error: 'data/ratings.json could not be read. Is it valid JSON?' });
      }
    }
    if (req.method !== 'POST') return send(405, { error: 'Use GET or POST.' });

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2000) req.destroy();
    });
    req.on('end', () => {
      let request;
      try {
        request = JSON.parse(body);
      } catch {
        return send(400, { error: 'That request was not readable.' });
      }
      try {
        if (!request || request.grade === undefined) throw new Error('Say which grade to save, or null to remove it.');
        validateRating(listNumbers(), request.number, request.grade);

        // The rating page says which title it is showing. If the list has changed since the page
        // opened (a movie fixed, replaced or renumbered), refuse, so a grade can never land on a
        // different movie than the one you were looking at.
        if (typeof request.expect === 'string') {
          const movie = readMovies().find((m) => m.number === request.number);
          const current = movie.officialTitle ?? movie.myTitle;
          if (current !== request.expect) {
            return send(409, {
              error: `#${request.number} is now "${current}", not "${request.expect}". Your list changed while this page was open. Reload the page, then grade it again.`,
            });
          }
        }

        const next = withRating(readRatings(), request.number, request.grade);
        // Write a temporary file and then swap it in, so a crash can never leave half a file.
        const temp = `${ratingsPath}.tmp`;
        writeFileSync(temp, JSON.stringify(next, null, 2) + '\n');
        renameSync(temp, ratingsPath);
        return send(200, { ok: true, number: request.number, grade: request.grade, rated: Object.keys(next).length });
      } catch (error) {
        return send(400, { error: error.message });
      }
    });
  };
}

export function devRatings() {
  return {
    name: 'popcorn-dev-ratings',
    apply: 'serve', // development only: never part of a build
    configureServer(server) {
      const root = server.config.root;
      server.middlewares.use(
        '/__ratings',
        createRatingsHandler({
          ratingsPath: join(root, 'data', 'ratings.json'),
          moviesPath: join(root, 'src', 'data', 'movies.json'),
        }),
      );
    },
  };
}

export function devRateRoute() {
  return {
    name: 'popcorn-dev-rate-route',
    hooks: {
      'astro:config:setup': ({ command, injectRoute }) => {
        if (command === 'dev') injectRoute({ pattern: '/rate', entrypoint: './src/dev/rate.astro' });
      },
    },
  };
}
