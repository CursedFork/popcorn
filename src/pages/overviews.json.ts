// Built into /overviews.json: { "12": "description...", ... }. Only the detail view loads it.
import raw from '../data/movies.json';

export function GET() {
  const overviews = Object.fromEntries(
    (raw as { number: number; overview: string }[]).map((m) => [m.number, m.overview]),
  );
  return new Response(JSON.stringify(overviews), {
    headers: { 'Content-Type': 'application/json' },
  });
}
