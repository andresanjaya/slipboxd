import { normalizeMovieTitle, type TmdbMovieMetadata, type TmdbMovieQuery } from "@/lib/tmdb";

const TMDB_ORIGIN = "https://api.themoviedb.org";
const REQUEST_TIMEOUT_MS = 7_000;
const PARALLEL_REQUESTS = 3;

type SearchResult = { id?: unknown; title?: unknown; original_title?: unknown; release_date?: unknown };
type DetailsResult = { title?: unknown; release_date?: unknown; runtime?: unknown; genres?: unknown };

function releaseYear(value: unknown): number | undefined {
  if (typeof value !== "string") return;
  const match = value.match(/^(\d{4})-/);
  return match ? Number(match[1]) : undefined;
}

async function tmdbJson(url: URL, token: string, fetcher: typeof fetch): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetcher(url, { headers: { accept: "application/json", Authorization: `Bearer ${token}` }, signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`TMDB ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timeout); }
}

function chooseMatch(query: TmdbMovieQuery, results: SearchResult[]): SearchResult | "ambiguous" | undefined {
  const normalized = normalizeMovieTitle(query.title);
  const exactTitles = results.filter(result => [result.title, result.original_title].some(title => typeof title === "string" && normalizeMovieTitle(title) === normalized));
  const candidates = query.releaseYear === undefined ? exactTitles : exactTitles.filter(result => releaseYear(result.release_date) === query.releaseYear);
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) return "ambiguous";
}

async function enrichOne(query: TmdbMovieQuery, token: string, fetcher: typeof fetch): Promise<TmdbMovieMetadata> {
  const fallback = { ...query, genres: [] };
  try {
    const searchUrl = new URL("/3/search/movie", TMDB_ORIGIN);
    searchUrl.searchParams.set("query", query.title);
    searchUrl.searchParams.set("include_adult", "false");
    searchUrl.searchParams.set("language", "en-US");
    searchUrl.searchParams.set("page", "1");
    if (query.releaseYear) searchUrl.searchParams.set("year", String(query.releaseYear));
    const payload = await tmdbJson(searchUrl, token, fetcher) as { results?: unknown };
    const results = Array.isArray(payload.results) ? payload.results as SearchResult[] : [];
    const match = chooseMatch(query, results);
    if (!match) return { ...fallback, status: "unmatched" };
    if (match === "ambiguous") return { ...fallback, status: "ambiguous" };
    if (!Number.isInteger(match.id)) return { ...fallback, status: "unmatched" };
    const detailsUrl = new URL(`/3/movie/${match.id}`, TMDB_ORIGIN);
    detailsUrl.searchParams.set("language", "en-US");
    const details = await tmdbJson(detailsUrl, token, fetcher) as DetailsResult;
    const genres = Array.isArray(details.genres) ? details.genres.flatMap(value => {
      if (!value || typeof value !== "object") return [];
      const genre = value as { id?: unknown; name?: unknown };
      return Number.isInteger(genre.id) && typeof genre.name === "string" ? [{ id: genre.id as number, name: genre.name }] : [];
    }) : [];
    const runtime = Number.isInteger(details.runtime) && Number(details.runtime) > 0 ? Number(details.runtime) : undefined;
    return { ...query, tmdbId: match.id as number, matchedTitle: typeof details.title === "string" ? details.title : typeof match.title === "string" ? match.title : query.title,
      matchedReleaseYear: releaseYear(details.release_date) ?? releaseYear(match.release_date), genres, runtime, status: "matched" };
  } catch { return { ...fallback, status: "error" }; }
}

export async function enrichTmdbMovies(queries: TmdbMovieQuery[], token: string, fetcher: typeof fetch = fetch): Promise<TmdbMovieMetadata[]> {
  const results = new Array<TmdbMovieMetadata>(queries.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(PARALLEL_REQUESTS, queries.length) }, async () => {
    while (cursor < queries.length) {
      const index = cursor++;
      results[index] = await enrichOne(queries[index], token, fetcher);
    }
  }));
  return results;
}
