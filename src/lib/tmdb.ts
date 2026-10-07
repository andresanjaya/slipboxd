import type { Language } from "@/i18n";
import type { WatchEntry } from "@/lib/model";

export type TmdbMatchStatus = "matched" | "unmatched" | "ambiguous" | "error";
export type TmdbMovieQuery = { key: string; title: string; releaseYear?: number };
export type TmdbGenre = { id: number; name: string };
export type TmdbDirector = { id: number; name: string };
export type TmdbMovieMetadata = TmdbMovieQuery & {
  tmdbId?: number;
  matchedTitle?: string;
  matchedReleaseYear?: number;
  genres: TmdbGenre[];
  directors?: TmdbDirector[];
  runtime?: number;
  status: TmdbMatchStatus;
};

export function normalizeMovieTitle(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function tmdbCacheKey(title: string, releaseYear?: number): string {
  return `${normalizeMovieTitle(title)}::${releaseYear ?? "?"}`;
}

export function metadataFor(entry: Pick<WatchEntry, "title" | "releaseYear">, metadata: ReadonlyMap<string, TmdbMovieMetadata>): TmdbMovieMetadata | undefined {
  return metadata.get(tmdbCacheKey(entry.title, entry.releaseYear));
}

export function genreLabel(genre: TmdbGenre, language: Language): string {
  if (language === "en") return genre.name;
  const labels: Record<number, string> = {
    12: "Petualangan", 14: "Fantasi", 16: "Animasi", 18: "Drama", 27: "Horor", 28: "Aksi", 35: "Komedi",
    36: "Sejarah", 37: "Western", 53: "Thriller", 80: "Kriminal", 99: "Dokumenter", 878: "Fiksi Ilmiah",
    9648: "Misteri", 10402: "Musik", 10749: "Romansa", 10751: "Keluarga", 10752: "Perang", 10770: "Film TV",
  };
  return labels[genre.id] ?? genre.name;
}
