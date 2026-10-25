# Popcorn

A personal movie list website. It shows my ranked list of movies as a poster grid that visitors can browse, search, filter, share and see stats for. My order is the ranking, and it never gets renumbered.

Built with Astro and React, hosted on Vercel. All movie details come from [TMDB](https://www.themoviedb.org/), but only while I run the lookup on my own computer. The live site never talks to TMDB for data and needs no database, login, or key.

## Contents

1. [Quick start](#quick-start)
2. [Adding movies](#adding-movies)
3. [Running the lookup](#running-the-lookup)
4. [Fixing a wrong match](#fixing-a-wrong-match)
5. [Refreshing the data (every few months)](#refreshing-the-data-every-few-months)
6. [Studio name merges](#studio-name-merges)
7. [Checking your work](#checking-your-work)
8. [Putting it on the web (GitHub and Vercel)](#putting-it-on-the-web-github-and-vercel)
9. [Updating the live site later](#updating-the-live-site-later)
10. [How it is organized](#how-it-is-organized)
11. [TMDB rules to remember](#tmdb-rules-to-remember)

## Quick start

You need Node.js 22 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:4321. The movie data is already in the project, so the site works right away. You only need a TMDB key when you want to look up new movies (see below).

## Adding movies

Your list lives in `data/movies.txt`. One movie per line: a number, the title, and optionally the release year in parentheses at the end.

```text
12. Halloween (1978)
7 Heat
30) Casablanca (1942)
```

- `1. Title`, `1 Title` and `1) Title` all work. Extra spaces and blank lines are ignored.
- **Your numbers are yours.** They are the ranking, and none of the scripts ever change or renumber them on their own. Right now they run from 1 to 993 with no gaps, and *Avengers: Doomsday* is the last line.
- A line that starts with `#` is a comment and is ignored. This is also how you drop a movie without losing its number: put a `#` in front of it.
- **Add the year whenever you can.** Titles like "Halloween" or "Carrie" belong to several movies, and the year picks the right one. Without it, the lookup may flag the movie for your review.
- The saved data, `data/overrides.json` and the fix files all refer to movies by these numbers. If you ever move or renumber lines, everything has to be renumbered together, so ask Claude to do it rather than editing by hand.

Check the file for typos before looking anything up (no internet needed):

```bash
npm run check-list
```

It reports lines it cannot read, duplicate numbers, and gaps in the numbering. Gaps are fine. They just mean a number has no movie yet.

## Running the lookup

The lookup reads `data/movies.txt`, asks TMDB about each movie, and saves the results to `src/data/movies.json`.

### One-time setup: get a free TMDB key

1. Make a free account at themoviedb.org and verify your email.
2. Go to Settings, then API, and request a key. Choose "Developer" and say it is a personal, non-commercial movie list.
3. Copy `.env.example` to a new file named `.env` and paste your **API Key** after `TMDB_API_KEY=`.

The `.env` file is ignored by git, so the key never gets committed. Do not paste it anywhere public. Vercel does not need it.

### The commands

```bash
npm run lookup -- --dry     # shows how many requests it would make, changes nothing
npm run lookup              # looks up only new or changed movies
npm run lookup 12 40        # looks up just those list numbers again
```

- It remembers earlier results, so running it again only fetches what is new or changed. Changing the title or year on a line makes that one movie get looked up again.
- It pauses a moment between requests to be polite to TMDB. Expect about 2 requests per movie, and roughly 15 minutes for a thousand.
- It saves as it goes. If it stops partway, run it again and it picks up where it left off.
- **Avengers: Doomsday and other unreleased movies** stay in their spot with a "Coming soon" tag. When more details appear on TMDB, run `npm run lookup 993` (its number in the list) to fill them in.

### The review report

Some movies cannot be matched with confidence: no exact title match, several movies sharing a title, very few votes, or nothing found. The lookup marks them "needs review" and writes `data/review-report.md`, which lists each one with TMDB's top three guesses. Fix them as described next.

Matching rules, in plain words: with a year, it accepts an exact year or one year off. Without one, it prefers an exact title match, ignoring capital letters, punctuation, accents and a leading "The", "A" or "An".

## Fixing a wrong match

Overrides always win over automatic matching. They are saved in `data/overrides.json`, and you never have to edit that file by hand.

**Point one movie at the right TMDB movie.** Find the number in the review report, or in the address of a movie page on themoviedb.org (`themoviedb.org/movie/603` means id 603):

```bash
npm run fix 123 603
```

That says "list number 123 is TMDB movie 603". It checks the movie exists, shows you its title, and re-fetches it.

**Undo an override:**

```bash
npm run fix 123 clear
```

**Enter a movie by hand** (for things TMDB does not have, like a TV miniseries):

```bash
npm run fix 123 manual
```

This adds a fill-in template to `data/overrides.json` with your title. Add whatever you know (release date, genres, description, a poster path, stars, directors, studios) and run `npm run lookup 123`. The 1990 *It* miniseries is set up this way as an example.

**Fix many at once.** Put one `number id` pair per line in a text file (see `data/batch-fixes.txt` for the format, where `#` starts a note), check it, then apply it:

```bash
npm run fix-batch -- --dry --file data/batch-fixes.txt   # checks the file, changes nothing
npm run fix-batch -- --file data/batch-fixes.txt         # applies it
```

**Drop a movie:** put a `#` in front of its line in `data/movies.txt`, then run `npm run lookup`. The movie disappears from the site, and its number is left empty as a gap. Gaps are fine for the site, but if you want the numbers to run 1 to the end again, ask Claude to renumber everything together (the list, the saved data, the overrides and the fix files).

## Refreshing the data (every few months)

TMDB's terms limit how long you may keep its data. **Refresh at least every 6 months, and sooner is better.** Put a reminder in your calendar.

```bash
npm run refresh
```

This looks up every movie again (about 2 requests each, so plan on 15 minutes or more). Then rebuild and redeploy, as described below. The About page shows a "Data last refreshed" date taken from the newest lookup, so visitors can see how fresh it is.

After a refresh, check `data/review-report.md` in case anything needs a new look.

## Studio name merges

Companies show up under many names ("Warner Bros. Pictures", "Warner Bros. Animation"). `data/aliases.json` maps variant names to one display name, and those merged names appear in the studio filter, the detail view and the Stats page.

```json
{
  "Warner Bros. Pictures": "Warner Bros.",
  "Warner Bros. Animation": "Warner Bros."
}
```

To merge two more names, add a line of `"Variant name": "Display name"` and rebuild. Look at the Studio filter or the Stats page to find names that should be merged. Nothing is ever merged without you adding it here.

## Checking your work

```bash
npm run test:filters   # 37 checks on filtering, ordering, search, sharing, stats and descriptions
npm run build          # makes the real site in the dist folder (this is what Vercel does)
npm run preview        # opens that built site so you can click around
```

Run all three before every deploy. If `test:filters` fails, something about the rules changed, and the message says which one.

## Putting it on the web (GitHub and Vercel)

Do these in order. Nothing here is automatic, and each step is yours to run.

### Step 1. Before the first commit, make sure no secret will be saved

```bash
git check-ignore .env
```

It should print `.env`. If it prints nothing, stop and fix `.gitignore` before going further.

### Step 2. Make the first commit

```bash
git add .
git status
```

Read the list that `git status` shows. You should see your source files, `data/`, `scripts/` and `public/`. You should **not** see `.env`, `node_modules/` or `dist/`. Then:

```bash
git commit -m "First version of Popcorn"
```

### Step 3. Put it on GitHub

1. On github.com, click New repository. Name it (for example `popcorn`), leave it empty (no README, no .gitignore), and create it.
2. GitHub shows two commands under "push an existing repository". They look like this, with your own username:

```bash
git remote add origin https://github.com/YOUR-USERNAME/popcorn.git
git push -u origin main
```

### Step 4. Connect it to Vercel

1. On vercel.com, sign in with GitHub and click Add New, then Project.
2. Pick the `popcorn` repository and click Import.
3. Vercel recognizes Astro on its own. Leave the build command (`npm run build`) and output folder (`dist`) as they are.
4. **Do not add the TMDB key.** The live site never needs it.
5. Click Deploy. In a minute or two you get an address like `popcorn-abc123.vercel.app`.

### Step 5. Tell the site its own address (recommended)

Search engines and link previews work best when the site knows its full address.

1. In Vercel, open the project, then Settings, then Environment Variables.
2. Add `SITE_URL` with your address, for example `https://popcorn-abc123.vercel.app` (no slash at the end). Use your custom domain once you have one.
3. Go to Deployments and redeploy the latest one.

This turns on the canonical links and the sitemap. Without it, both are simply left out, and nothing breaks.

### Step 6. A custom domain (optional)

In Vercel, open Settings, then Domains, and follow the steps there. Then update `SITE_URL` to match and redeploy.

### Step 7. After the first deploy, check these

- The home page loads, posters appear, and the filters and search work.
- Open a detail view, press Share, and open the copied link in a private window. It should show the same movie.
- **Try Share on your phone.** The native share sheet is the one thing that could not be tested on a computer.
- Open the About page and confirm the TMDB logo, the attribution sentence, and the "Data last refreshed" date.
- Open `/stats`, then `/some-page-that-does-not-exist` to see the friendly 404 page.

## Updating the live site later

```bash
# 1. edit data/movies.txt, then:
npm run lookup
# 2. fix anything flagged in data/review-report.md (see "Fixing a wrong match")
# 3. check it:
npm run test:filters
npm run build
# 4. save and publish:
git add .
git commit -m "Add more movies"
git push
```

Vercel notices the push and rebuilds the site on its own, usually within a minute or two.

## How it is organized

```text
data/
  movies.txt            your list (the only file you type your movies into)
  overrides.json        manual fixes, written by npm run fix
  aliases.json          studio name merges
  batch-fixes*.txt      fix lists you applied with npm run fix-batch (kept in step with the numbering)
scripts/                the lookup, fix and test commands
src/
  config/site.ts        the site name and small settings, in one place
  data/movies.json      the looked-up results (written by the lookup)
  lib/                  the rules: filtering, order, search, URLs, stats
  components/           the interactive parts (grid, filters, detail view)
  pages/                Home, Stats, About, 404, sitemap and robots.txt
public/                 the popcorn bucket and the TMDB logo
vercel.json             cache settings for faster repeat visits
```

The view is stored in the page address (filters, search, order, Strict or Loose, and the open movie), which is what makes every link shareable.

## TMDB rules to remember

- The About page must keep the TMDB logo (smaller than the Popcorn name) and TMDB's attribution sentence. Check TMDB's current wording at themoviedb.org before launch and now and then after.
- Do not keep TMDB data for more than 6 months without refreshing it.
- No ads, no affiliate links, and nothing that earns money. TMDB's free key is for non-commercial use.
- Posters are loaded straight from TMDB's image server (`image.tmdb.org`) while people browse. That is normal, and it is why the site stays small.

Movie data and images are provided by TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
