import type { Language } from "@/i18n";
import type { WatchEntry } from "@/lib/model";

export type TmdbMatchStatus = "matched" | "unmatched" | "ambiguous" | "error";
export type TmdbMovieQuery = { key: string; title: string; releaseYear?: number };
export type TmdbGenre = { id: number; name: string };
export type TmdbMovieMetadata = TmdbMovieQuery & {
  tmdbId?: number;
  matchedTitle?: string;
  matchedReleaseYear?: number;
  genres: TmdbGenre[];
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

export type ProfileRule = "drama-romance" | "drama-thriller" | "comedy-romance" | "speculative" | "documentary" | "animation-family" | "general";
export type ViewingProfileData = {
  analyzed: number;
  matched: number;
  reliable: boolean;
  topGenres: Array<{ id: number; name: string; percentage: number }>;
  rule: ProfileRule;
};

export function buildViewingProfile(entries: WatchEntry[], metadata: ReadonlyMap<string, TmdbMovieMetadata>): ViewingProfileData {
  const unique = new Map<string, WatchEntry>();
  for (const entry of entries) unique.set(tmdbCacheKey(entry.title, entry.releaseYear), entry);
  const matched = [...unique.values()].map(entry => metadataFor(entry, metadata)).filter((item): item is TmdbMovieMetadata => item?.status === "matched" && item.genres.length > 0);
  const counts = new Map<number, { name: string; count: number }>();
  let genreTotal = 0;
  for (const item of matched) for (const genre of item.genres) {
    const current = counts.get(genre.id);
    counts.set(genre.id, { name: genre.name, count: (current?.count ?? 0) + 1 });
    genreTotal++;
  }
  const topGenres = [...counts.entries()].sort((a, b) => b[1].count - a[1].count || a[0] - b[0]).slice(0, 3)
    .map(([id, value]) => ({ id, name: value.name, percentage: genreTotal ? Math.round(value.count / genreTotal * 100) : 0 }));
  const ids = new Set(topGenres.map(genre => genre.id));
  const rule: ProfileRule = ids.has(18) && ids.has(10749) ? "drama-romance"
    : ids.has(18) && ids.has(53) ? "drama-thriller"
    : ids.has(35) && ids.has(10749) ? "comedy-romance"
    : ids.has(878) || ids.has(14) ? "speculative"
    : ids.has(99) ? "documentary"
    : ids.has(16) && ids.has(10751) ? "animation-family"
    : "general";
  return { analyzed: unique.size, matched: matched.length, reliable: matched.length >= 3, topGenres, rule };
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
