import type { TmdbMovieMetadata } from "./tmdb";

export type ViewingProfile = {
  reliable: boolean;
  analyzed: number;
  matched: number;
  genres: { name: string; percentage: number }[];
  characteristic: "heartfelt" | "tense" | "imaginative" | "wide-ranging" | "genre-led";
};

export function buildLegacyViewingProfile(metadata: TmdbMovieMetadata[], analyzed: number): ViewingProfile {
  const matched = metadata.filter(movie => movie.status === "matched" && movie.genres.length > 0);
  const counts = new Map<string, number>();
  for (const movie of matched) for (const genre of movie.genres) counts.set(genre.name, (counts.get(genre.name) ?? 0) + 1);
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const genres = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3).map(([name, count]) => ({ name, percentage: total ? Math.round(count / total * 100) : 0 }));
  const names = new Set(genres.map(genre => genre.name));
  const characteristic = names.has("Drama") && (names.has("Romance") || names.has("Family")) ? "heartfelt"
    : names.has("Thriller") || names.has("Horror") || names.has("Crime") ? "tense"
    : names.has("Science Fiction") || names.has("Fantasy") || names.has("Animation") ? "imaginative"
    : genres.length === 3 && genres[0].percentage - genres[2].percentage <= 10 ? "wide-ranging"
    : "genre-led";
  return { reliable: matched.length >= 3 && analyzed >= 3, analyzed, matched: matched.length, genres, characteristic };
}
