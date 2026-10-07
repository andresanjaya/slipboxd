import { calendarDate, releaseYearValue, type WatchEntry } from "@/lib/model";
import { metadataFor, type TmdbMovieMetadata } from "@/lib/tmdb";

export type ChartPeriod = "all" | "weeks4" | "months6" | "current" | `year:${string}`;
export type ChartCount = { id: number; name: string; count: number };

function localToday(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function rollingStart(period: "weeks4" | "months6", today: string): string {
  const [year, month, day] = today.split("-").map(Number);
  const start = period === "weeks4" ? new Date(Date.UTC(year, month - 1, day - 27)) : new Date(Date.UTC(year, month - 6, 1));
  return start.toISOString().slice(0, 10);
}

export function chartEntries(entries: WatchEntry[], period: ChartPeriod, currentYear: number, today = localToday()): WatchEntry[] {
  const year = period === "current" ? String(currentYear) : period.startsWith("year:") ? period.slice(5) : undefined;
  const start = period === "weeks4" || period === "months6" ? rollingStart(period, today) : undefined;
  return entries.filter(entry => {
    const date = calendarDate(entry.watchedDate);
    return date && (!year || date.startsWith(`${year}-`)) && (!start || (date >= start && date <= today));
  });
}

export function buildCharts(entries: WatchEntry[], metadata: ReadonlyMap<string, TmdbMovieMetadata>, period: ChartPeriod, currentYear: number, today = localToday()) {
  const selected = chartEntries(entries, period, currentYear, today);
  const genres = new Map<number, ChartCount>();
  const directors = new Map<number, ChartCount>();
  const months = new Map<string, number>();
  const decades = new Map<number, number>();
  const ratings = Array.from({ length: 10 }, (_, index) => ({ rating: (index + 1) / 2, count: 0 }));
  let genreCoverage = 0;
  let directorCoverage = 0;
  let ratedEntries = 0;

  for (const entry of selected) {
    const month = entry.watchedDate.slice(0, 7);
    months.set(month, (months.get(month) ?? 0) + 1);

    if (entry.rating !== undefined) {
      const bucket = ratings.find(item => item.rating === entry.rating);
      if (bucket) { bucket.count++; ratedEntries++; }
    }

    const releaseYear = releaseYearValue(entry.releaseYear);
    if (releaseYear !== undefined) {
      const decade = Math.floor(releaseYear / 10) * 10;
      decades.set(decade, (decades.get(decade) ?? 0) + 1);
    }

    const movie = metadataFor(entry, metadata);
    if (movie?.status !== "matched") continue;
    if (movie.genres.length) {
      genreCoverage++;
      for (const genre of new Map(movie.genres.map(item => [item.id, item])).values()) {
        const current = genres.get(genre.id);
        genres.set(genre.id, { id: genre.id, name: genre.name, count: (current?.count ?? 0) + 1 });
      }
    }
    if (movie.directors?.length) {
      directorCoverage++;
      for (const director of new Map(movie.directors.map(item => [item.id, item])).values()) {
        const current = directors.get(director.id);
        directors.set(director.id, { id: director.id, name: director.name, count: (current?.count ?? 0) + 1 });
      }
    }
  }

  if (period === "current" || period.startsWith("year:")) {
    const year = period === "current" ? String(currentYear) : period.slice(5);
    for (let month = 1; month <= 12; month++) {
      const key = `${year}-${String(month).padStart(2, "0")}`;
      if (!months.has(key)) months.set(key, 0);
    }
  }
  if (period === "months6") {
    const start = rollingStart("months6", today);
    const [year, month] = start.split("-").map(Number);
    for (let offset = 0; offset < 6; offset++) {
      const date = new Date(Date.UTC(year, month - 1 + offset, 1));
      const key = date.toISOString().slice(0, 7);
      if (!months.has(key)) months.set(key, 0);
    }
  }

  const top = (counts: Map<number, ChartCount>) => [...counts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name) || a.id - b.id).slice(0, 5);

  return {
    entries: selected.length,
    genreCoverage,
    directorCoverage,
    ratedEntries,
    topGenres: top(genres),
    topDirectors: top(directors),
    activity: [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })),
    ratings,
    decades: [...decades.entries()].sort(([a], [b]) => a - b).map(([decade, count]) => ({ decade, count })),
  };
}
