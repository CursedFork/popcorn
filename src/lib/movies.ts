// What the poster grid knows about each movie. This file has no data imports,
// so the logic can be tested from the command line. load.ts reads the real data.

export interface GridMovie {
  number: number; // your list number, never changed
  title: string;
  year: number | null;
  releaseDate: string | null; // YYYY-MM-DD
  decade: string | null; // like "1990s"
  posterPath: string | null;
  comingSoon: boolean;
  genres: string[];
  stars: string[];
  directors: string[];
  studios: string[]; // after your studio merges
}

export interface RawMovie {
  number: number;
  myTitle: string;
  officialTitle: string | null;
  year: number | null;
  releaseDate: string | null;
  decade: string | null;
  posterPath: string | null;
  status: string;
  genres: string[];
  stars: string[];
  directors: string[];
  studios: string[];
}

// data/aliases.json maps variant studio names to one display name.
export function toGridMovies(raw: RawMovie[], aliases: Record<string, string>): GridMovie[] {
  const merge = (names: string[]) => [...new Set(names.map((n) => aliases[n] ?? n))];
  return raw
    .map((m) => ({
      number: m.number,
      title: m.officialTitle ?? m.myTitle,
      year: m.year,
      releaseDate: m.releaseDate,
      decade: m.decade,
      posterPath: m.posterPath,
      comingSoon: m.status === 'unreleased',
      genres: m.genres,
      stars: m.stars,
      directors: m.directors,
      studios: merge(m.studios),
    }))
    .sort((a, b) => a.number - b.number);
}
