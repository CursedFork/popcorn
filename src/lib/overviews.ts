// Descriptions are long, so they are not in the page itself. They load once, from
// /overviews.json, the first time they are needed, and are kept for the rest of the visit.
let cache: Promise<Record<string, string>> | null = null;

export function getOverviews(): Promise<Record<string, string>> {
  if (!cache) {
    cache = fetch('/overviews.json')
      .then((response) => {
        if (!response.ok) throw new Error(`overviews.json returned ${response.status}`);
        return response.json() as Promise<Record<string, string>>;
      })
      .catch((error) => {
        cache = null; // let the next try start fresh
        throw error;
      });
  }
  return cache;
}
