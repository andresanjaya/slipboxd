import test from "node:test";
import assert from "node:assert/strict";
import { enrichTmdbMovies } from "../src/lib/tmdb-server";
import { buildViewingProfile, tmdbCacheKey, type TmdbMovieMetadata } from "../src/lib/tmdb";
import type { WatchEntry } from "../src/lib/model";

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

test("TMDB enrichment matches exact translated/original title and year", async () => {
  const calls: URL[] = [];
  const authorizations: string[] = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push(url);
    authorizations.push(new Headers(init?.headers).get("Authorization") ?? "");
    if (url.pathname === "/3/search/movie") return json({ results: [{ id: 42, title: "Spirited Away", original_title: "千と千尋の神隠し", release_date: "2001-07-20" }] });
    return json({ title: "Spirited Away", release_date: "2001-07-20", runtime: 125, genres: [{ id: 16, name: "Animation" }, { id: 10751, name: "Family" }] });
  }) as typeof fetch;
  const [result] = await enrichTmdbMovies([{ key: "spirited-away::2001", title: "Spirited Away", releaseYear: 2001 }], "secret", fetcher);
  assert.equal(result.status, "matched");
  assert.equal(result.runtime, 125);
  assert.deepEqual(result.genres.map(genre => genre.name), ["Animation", "Family"]);
  assert.equal(calls[0].origin, "https://api.themoviedb.org");
  assert.equal(calls[0].searchParams.get("year"), "2001");
  assert.ok(authorizations.every(value => value === "Bearer secret"));
});

test("TMDB matching considers the original title", async () => {
  const fetcher = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    return url.pathname === "/3/search/movie"
      ? json({ results: [{ id: 42, title: "Spirited Away", original_title: "千と千尋の神隠し", release_date: "2001-07-20" }] })
      : json({ title: "Spirited Away", release_date: "2001-07-20", runtime: 125, genres: [] });
  }) as typeof fetch;
  const [result] = await enrichTmdbMovies([{ key: "original::2001", title: "千と千尋の神隠し", releaseYear: 2001 }], "secret", fetcher);
  assert.equal(result.status, "matched");
  assert.equal(result.tmdbId, 42);
});

test("TMDB enrichment leaves ambiguous and missing films unmatched", async () => {
  let searches = 0;
  const fetcher = (async () => {
    searches++;
    return searches === 1
      ? json({ results: [{ id: 1, title: "Crash", release_date: "1996-01-01" }, { id: 2, title: "Crash", release_date: "1996-05-01" }] })
      : json({ results: [] });
  }) as typeof fetch;
  const [ambiguous, missing] = await enrichTmdbMovies([
    { key: "crash::1996", title: "Crash", releaseYear: 1996 },
    { key: "fictional::2026", title: "Entirely Fictional", releaseYear: 2026 },
  ], "secret", fetcher);
  assert.equal(ambiguous.status, "ambiguous");
  assert.equal(missing.status, "unmatched");
  assert.equal(ambiguous.runtime, undefined);
});

test("viewing profile is deterministic and counts partial matches", () => {
  const entries: WatchEntry[] = [
    { source: "export", filmKey: "1", title: "One", releaseYear: 2020, watchedDate: "2026-09-01" },
    { source: "export", filmKey: "2", title: "Two", releaseYear: 2021, watchedDate: "2026-09-02" },
    { source: "export", filmKey: "3", title: "Three", releaseYear: 2022, watchedDate: "2026-09-03" },
    { source: "export", filmKey: "4", title: "Missing", releaseYear: 2023, watchedDate: "2026-09-04" },
  ];
  const metadata = new Map<string, TmdbMovieMetadata>();
  const matched = (entry: WatchEntry, genres: TmdbMovieMetadata["genres"]): TmdbMovieMetadata => ({
    key: tmdbCacheKey(entry.title, entry.releaseYear), title: entry.title, releaseYear: entry.releaseYear, genres, runtime: 100, status: "matched",
  });
  metadata.set(tmdbCacheKey("One", 2020), matched(entries[0], [{ id: 18, name: "Drama" }, { id: 10749, name: "Romance" }]));
  metadata.set(tmdbCacheKey("Two", 2021), matched(entries[1], [{ id: 18, name: "Drama" }]));
  metadata.set(tmdbCacheKey("Three", 2022), matched(entries[2], [{ id: 53, name: "Thriller" }]));
  metadata.set(tmdbCacheKey("Missing", 2023), { key: tmdbCacheKey("Missing", 2023), title: "Missing", releaseYear: 2023, genres: [], status: "unmatched" });
  const profile = buildViewingProfile(entries, metadata);
  assert.equal(profile.analyzed, 4);
  assert.equal(profile.matched, 3);
  assert.equal(profile.reliable, true);
  assert.equal(profile.rule, "drama-romance");
  assert.deepEqual(profile.topGenres.map(genre => [genre.name, genre.percentage]), [["Drama", 50], ["Thriller", 25], ["Romance", 25]]);
});
