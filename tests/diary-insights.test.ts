import test from "node:test";
import assert from "node:assert/strict";
import { availableDiaryYears, buildAnnualRecap, buildViewingProfile } from "../src/lib/diary-insights";
import { tmdbCacheKey, type TmdbMovieMetadata } from "../src/lib/tmdb";
import type { WatchEntry } from "../src/lib/model";

function entry(filmKey: string, title: string, watchedDate: string, rating?: number, releaseYear = 2000): WatchEntry {
  return { source: "export", filmKey, title, watchedDate, rating, releaseYear };
}

const metadataFor = (title: string, year: number, genres: TmdbMovieMetadata["genres"], status: TmdbMovieMetadata["status"] = "matched"): TmdbMovieMetadata => ({
  key: tmdbCacheKey(title, year), title, releaseYear: year, genres, status,
});

test("Viewing Profile counts rewatches as sessions but genres once per unique film", () => {
  const diary = [
    entry("film-a", "Film A", "2025-02-01", 5, 1990),
    entry("film-a", "Film A", "2025-02-03", undefined, 1990),
    entry("film-b", "Film B", "2025-03-01", 3, 2020),
  ];
  const metadata = new Map([
    [tmdbCacheKey("Film A", 1990), metadataFor("Film A", 1990, [{ id: 18, name: "Drama" }, { id: 18, name: "Drama" }])],
    [tmdbCacheKey("Film B", 2020), metadataFor("Film B", 2020, [], "unmatched")],
  ]);
  const profile = buildViewingProfile(diary, metadata);
  assert.equal(profile.sessions, 3);
  assert.equal(profile.uniqueFilms, 2);
  assert.equal(profile.ratingsCount, 2);
  assert.equal(profile.averageRating, 4);
  assert.deepEqual(profile.ratingDistribution.filter(bucket => bucket.count), [{ rating: 3, count: 1 }, { rating: 5, count: 1 }]);
  assert.equal(profile.genresAvailable, 1);
  assert.deepEqual(profile.topGenres.map(genre => [genre.name, genre.count]), [["Drama", 1]]);
});

test("Annual Recap uses watched year, counts sessions and selects the busiest month by sessions", () => {
  const diary = [
    entry("film-a", "Film A", "2025-02-01", 5, 1990),
    entry("film-a", "Film A", "2025-02-03", undefined, 1990),
    entry("film-b", "Film B", "2025-03-01", 3, 2020),
    entry("film-c", "Film C", "2026-01-01", 1, 2025),
    entry("undated", "Undated", "", 4, 2025),
  ];
  const metadata = new Map([
    [tmdbCacheKey("Film A", 1990), metadataFor("Film A", 1990, [
      { id: 18, name: "Drama" }, { id: 28, name: "Action" }, { id: 12, name: "Adventure" }, { id: 878, name: "Science Fiction" }, { id: 35, name: "Comedy" },
    ])],
    [tmdbCacheKey("Film B", 2020), metadataFor("Film B", 2020, [], "unmatched")],
    [tmdbCacheKey("Film C", 2025), metadataFor("Film C", 2025, [{ id: 35, name: "Comedy" }])],
  ]);
  const recap = buildAnnualRecap(diary, metadata, "2025");
  assert.equal(recap.sessions, 3);
  assert.equal(recap.uniqueFilms, 2);
  assert.equal(recap.mostActiveMonth, "2025-02");
  assert.equal(recap.ratingsCount, 2);
  assert.equal(recap.averageRating, 4);
  assert.equal(recap.genresAvailable, 1);
  assert.deepEqual(recap.topGenres.map(genre => genre.name), ["Adventure", "Drama", "Action", "Comedy", "Science Fiction"]);
  assert.deepEqual(availableDiaryYears(diary), ["2026", "2025"]);
});

test("Annual Recap returns an empty state for a year with no dated diary entries", () => {
  const diary = [entry("missing-date", "Missing date", "", 5)];
  const recap = buildAnnualRecap(diary, new Map(), "2024");
  assert.equal(recap.sessions, 0);
  assert.equal(recap.uniqueFilms, 0);
  assert.equal(recap.mostActiveMonth, undefined);
  assert.equal(recap.averageRating, undefined);
  assert.equal(recap.genresAvailable, 0);
  assert.deepEqual(availableDiaryYears(diary), []);
});
