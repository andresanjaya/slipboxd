import test from "node:test";
import assert from "node:assert/strict";
import { buildCharts, chartEntries } from "../src/lib/charts";
import { tmdbCacheKey, type TmdbMovieMetadata } from "../src/lib/tmdb";
import type { WatchEntry } from "../src/lib/model";
import { importExportFile } from "../src/lib/import-export";
import { strToU8, zipSync } from "fflate";

const entries: WatchEntry[] = [
  { source: "export", filmKey: "a", title: "Film A", releaseYear: 1999, watchedDate: "2026-01-02", rating: 4 },
  { source: "export", filmKey: "a", title: "Film A", releaseYear: 1999, watchedDate: "2026-02-03", rating: 4.5, rewatch: true },
  { source: "export", filmKey: "b", title: "Film B", releaseYear: 2021, watchedDate: "2025-08-04" },
  { source: "export", filmKey: "c", title: "Film C", watchedDate: "2026-02-20", rating: 0.5 },
  { source: "export", filmKey: "d", title: "Film D", releaseYear: 2020, watchedDate: "bad-date", rating: 5 },
];

const metadata = new Map<string, TmdbMovieMetadata>([
  [tmdbCacheKey("Film A", 1999), { key: tmdbCacheKey("Film A", 1999), title: "Film A", releaseYear: 1999, genres: [{ id: 18, name: "Drama" }], directors: [{ id: 1, name: "Director One" }, { id: 2, name: "Director Two" }], status: "matched" }],
  [tmdbCacheKey("Film B", 2021), { key: tmdbCacheKey("Film B", 2021), title: "Film B", releaseYear: 2021, genres: [{ id: 35, name: "Comedy" }], directors: [{ id: 1, name: "Director One" }], status: "matched" }],
]);

test("Charts filter by valid watched date and count rewatches as diary entries", () => {
  assert.equal(chartEntries(entries, "all", 2026).length, 4);
  assert.equal(chartEntries(entries, "current", 2026).length, 3);
  assert.equal(chartEntries(entries, "year:2025", 2026).length, 1);
  const charts = buildCharts(entries, metadata, "all", 2026);
  assert.equal(charts.entries, 4);
  assert.deepEqual(charts.topGenres.map(item => [item.name, item.count]), [["Drama", 2], ["Comedy", 1]]);
  assert.deepEqual(charts.topDirectors.map(item => [item.name, item.count]), [["Director One", 3], ["Director Two", 2]]);
  assert.equal(charts.genreCoverage, 3);
  assert.equal(charts.directorCoverage, 3);
  assert.deepEqual(charts.activity.map(item => [item.month, item.count]), [["2025-08", 1], ["2026-01", 1], ["2026-02", 2]]);
  assert.deepEqual(charts.decades.map(item => [item.decade, item.count]), [[1990, 2], [2020, 1]]);
  assert.equal(charts.ratedEntries, 3);
  assert.equal(charts.ratings.find(item => item.rating === 5)?.count, 0);
});

test("A selected year includes all twelve months, excludes unrated entries, and handles missing metadata", () => {
  const charts = buildCharts(entries, new Map(), "year:2025", 2026);
  assert.equal(charts.entries, 1);
  assert.equal(charts.activity.length, 12);
  assert.equal(charts.activity.find(item => item.month === "2025-08")?.count, 1);
  assert.equal(charts.activity.find(item => item.month === "2025-01")?.count, 0);
  assert.equal(charts.ratedEntries, 0);
  assert.equal(charts.genreCoverage, 0);
  assert.equal(charts.directorCoverage, 0);
  assert.deepEqual(charts.decades, [{ decade: 2020, count: 1 }]);
});

test("Rolling chart periods use watched dates and include their boundary days", () => {
  const watched = ["2026-04-30", "2026-05-01", "2026-09-09", "2026-09-10", "2026-10-07", "2026-10-08"]
    .map((watchedDate, index): WatchEntry => ({ source: "export", filmKey: String(index), title: `Film ${index}`, watchedDate }));
  assert.deepEqual(chartEntries(watched, "weeks4", 2026, "2026-10-07").map(entry => entry.watchedDate), ["2026-09-10", "2026-10-07"]);
  assert.deepEqual(chartEntries(watched, "months6", 2026, "2026-10-07").map(entry => entry.watchedDate), ["2026-05-01", "2026-09-09", "2026-09-10", "2026-10-07"]);
  const charts = buildCharts(watched, new Map(), "months6", 2026, "2026-10-07");
  assert.deepEqual(charts.activity.map(item => item.month), ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
  assert.equal(charts.entries, 4);
});

test("Charts calculations accept the existing CSV and single-diary ZIP parser results", async () => {
  const csv = "Name,Year,Watched Date,Rating\nFilm A,1999,2026-01-02,4\nFilm A,1999,2026-02-03,4.5";
  const direct = await importExportFile(new File([csv], "diary.csv"));
  const zip = zipSync({ "export/diary.csv": strToU8(csv) });
  const archived = await importExportFile(new File([Uint8Array.from(zip)], "export.zip"));
  assert.deepEqual(buildCharts(direct.entries, metadata, "all", 2026), buildCharts(archived.entries, metadata, "all", 2026));
  assert.equal(buildCharts(archived.entries, metadata, "all", 2026).topDirectors[0].count, 2);
});
