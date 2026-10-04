import { enrichTmdbMovies } from "@/lib/tmdb-server";
import type { TmdbMovieQuery } from "@/lib/tmdb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BATCH = 25;

function movieQuery(value: unknown): TmdbMovieQuery | undefined {
  if (!value || typeof value !== "object") return;
  const item = value as { key?: unknown; title?: unknown; releaseYear?: unknown };
  if (typeof item.key !== "string" || item.key.length > 240 || typeof item.title !== "string" || !item.title.trim() || item.title.length > 200) return;
  const releaseYear = item.releaseYear === undefined ? undefined : Number(item.releaseYear);
  if (releaseYear !== undefined && (!Number.isInteger(releaseYear) || releaseYear < 1000 || releaseYear > 9999)) return;
  return { key: item.key, title: item.title.trim(), releaseYear };
}

export async function POST(request: Request) {
  const token = process.env.TMDB_API_READ_ACCESS_TOKEN;
  if (!token) return Response.json({ error: "TMDB enrichment is not configured.", code: "tmdb-disabled" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try {
    const body = await request.json() as { movies?: unknown };
    if (!Array.isArray(body.movies) || body.movies.length < 1 || body.movies.length > MAX_BATCH) throw new Error("invalid batch");
    const movies = body.movies.map(movieQuery);
    if (movies.some(movie => !movie)) throw new Error("invalid movie");
    return Response.json({ results: await enrichTmdbMovies(movies as TmdbMovieQuery[], token) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Invalid TMDB enrichment request.", code: "tmdb-request" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
