import { calendarDate, type WatchEntry } from "@/lib/model";
import { metadataFor, type TmdbMovieMetadata } from "@/lib/tmdb";

export type RatingBucket = { rating: number; count: number };
export type GenreCount = { id: number; name: string; count: number };

export type ViewingProfileData = {
  sessions: number;
  uniqueFilms: number;
  ratingsCount: number;
  averageRating?: number;
  ratingDistribution: RatingBucket[];
  genresAvailable: number;
  topGenres: GenreCount[];
};

export type AnnualRecapData = ViewingProfileData & {
  year: string;
  mostActiveMonth?: string;
};

function uniqueFilms(entries: WatchEntry[]) {
  const unique = new Map<string, WatchEntry>();
  for (const entry of entries) unique.set(entry.filmKey, entry);
  return [...unique.values()];
}

function buildGenreCounts(entries: WatchEntry[], metadata: ReadonlyMap<string, TmdbMovieMetadata>, limit = 3) {
  const counts = new Map<number, { name: string; count: number }>();
  let genresAvailable = 0;
  for (const entry of uniqueFilms(entries)) {
    const movie = metadataFor(entry, metadata);
    if (movie?.status !== "matched" || !movie.genres.length) continue;
    genresAvailable++;
    for (const genre of new Map(movie.genres.map(item => [item.id, item])).values()) {
      const existing = counts.get(genre.id);
      counts.set(genre.id, { name: genre.name, count: (existing?.count ?? 0) + 1 });
    }
  }
  const topGenres = [...counts.entries()].sort((a, b) => b[1].count - a[1].count || a[0] - b[0])
    .slice(0, limit).map(([id, value]) => ({ id, name: value.name, count: value.count }));
  return { genresAvailable, topGenres };
}

function ratingStats(entries: WatchEntry[]) {
  const ratings = entries.map(entry => entry.rating).filter((rating): rating is number => rating !== undefined);
  const ratingDistribution = Array.from({ length: 10 }, (_, index) => ({
    rating: (index + 1) / 2,
    count: ratings.filter(rating => rating === (index + 1) / 2).length,
  }));
  return {
    ratingsCount: ratings.length,
    averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : undefined,
    ratingDistribution,
  };
}

export function availableDiaryYears(entries: WatchEntry[]): string[] {
  return [...new Set(entries.map(entry => calendarDate(entry.watchedDate)?.slice(0, 4)).filter((year): year is string => !!year))]
    .sort((a, b) => b.localeCompare(a));
}

export function buildViewingProfile(entries: WatchEntry[], metadata: ReadonlyMap<string, TmdbMovieMetadata>): ViewingProfileData {
  const distinct = uniqueFilms(entries);
  return {
    sessions: entries.length,
    uniqueFilms: distinct.length,
    ...ratingStats(entries),
    ...buildGenreCounts(distinct, metadata),
  };
}

export function buildAnnualRecap(entries: WatchEntry[], metadata: ReadonlyMap<string, TmdbMovieMetadata>, year: string): AnnualRecapData {
  const yearEntries = entries.filter(entry => calendarDate(entry.watchedDate)?.startsWith(`${year}-`));
  const monthCounts = new Map<string, number>();
  for (const entry of yearEntries) {
    const month = entry.watchedDate.slice(0, 7);
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
  }
  const mostActiveMonth = [...monthCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  return {
    year,
    sessions: yearEntries.length,
    uniqueFilms: uniqueFilms(yearEntries).length,
    ...ratingStats(yearEntries),
    ...buildGenreCounts(yearEntries, metadata, 5),
    mostActiveMonth,
  };
}
