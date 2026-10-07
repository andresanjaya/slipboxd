import test from "node:test";
import assert from "node:assert/strict";
import { enrichTmdbMovies } from "../src/lib/tmdb-server";
import { tmdbCacheKey, type TmdbMovieMetadata } from "../src/lib/tmdb";

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

test("TMDB movie details include Director crew credits without counting other jobs", async () => {
  const calls: URL[] = [];
  const fetcher = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(url);
    return url.pathname === "/3/search/movie"
      ? json({ results: [{ id: 42, title: "Film A", release_date: "1999-01-01" }] })
      : json({ title: "Film A", release_date: "1999-01-01", genres: [], credits: { crew: [
        { id: 1, name: "Director One", job: "Director" }, { id: 2, name: "Director Two", job: "Director" },
        { id: 1, name: "Director One", job: "Director" }, { id: 3, name: "Editor", job: "Editor" },
      ] } });
  }) as typeof fetch;
  const [result] = await enrichTmdbMovies([{ key: tmdbCacheKey("Film A", 1999), title: "Film A", releaseYear: 1999 }], "secret", fetcher);
  assert.equal(calls[1].searchParams.get("append_to_response"), "credits");
  assert.deepEqual(result.directors, [{ id: 1, name: "Director One" }, { id: 2, name: "Director Two" }]);
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
