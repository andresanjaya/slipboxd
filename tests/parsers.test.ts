import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { strToU8, zipSync } from "fflate";
import { calendarDate, defaultSettings, filmIdentity, ratingValue, safeFilename, selectEntries, availablePeriods, availableReleaseYears, ImportError } from "../src/lib/model";
import { extractDiaryZip, importExportFile, MAX_DIARY_BYTES, MAX_FILE_BYTES, parseDiaryCsv } from "../src/lib/import-export";
import { parseRss } from "../src/lib/rss";
import { tmdbCacheKey } from "../src/lib/tmdb";

const csv = await readFile(new URL("./fixtures/diary.csv", import.meta.url), "utf8");
const xml = await readFile(new URL("./fixtures/public-rss.xml", import.meta.url), "utf8");

test("CSV handles quoted commas, newlines, spaced headers, rewatch and missing ratings", () => {
  const result = parseDiaryCsv(csv);
  assert.equal(result.entries.length, 5);
  assert.equal(result.skipped, 2);
  assert.equal(result.entries[0].title, "Somewhere, After Midnight");
  assert.equal(result.entries[0].watchedDate, "2026-10-03");
  assert.equal(result.entries[1].rewatch, true);
  assert.equal(result.entries[2].rating, undefined);
  assert.equal(result.entries[3].title, "A Film with\nTwo Lines");
  assert.equal(selectEntries(result.entries, defaultSettings).unique, 4);
  assert.equal(selectEntries(result.entries, defaultSettings).sessions, 5);
});

test("calendar dates validate leap days without UTC or Date fallback", () => {
  assert.equal(calendarDate("2024-02-29"), "2024-02-29");
  for (const invalid of ["2026-02-29", "1900-02-29", "2026-04-31", "2026-00-02", "2026-10-03T00:00:00Z", "0000-01-01"]) assert.equal(calendarDate(invalid), undefined);
  assert.equal(calendarDate("2000-02-29"), "2000-02-29");
  assert.throws(() => parseDiaryCsv("Date,Name,Watched Date\n2026-10-01,Undated,"), /Belum ada entri/);
  assert.throws(() => parseDiaryCsv("Date,Name\n2026-10-01,Undated"), /Format kolom/);
});

test("invalid ratings stay missing and identical CSV sessions are not deleted", () => {
  for (const value of ["", "0", "-1", "6", "3.7", "NaN"]) assert.equal(ratingValue(value), undefined);
  assert.equal(ratingValue("0.5"), 0.5);
  const entries = parseDiaryCsv("Name,Year,Watched Date\nSame,2026,2026-10-01\nSame,2026,2026-10-01").entries;
  assert.equal(entries.length, 2);
  assert.equal(selectEntries(entries, defaultSettings).unique, 1);
});

test("ZIP extracts only nested diary.csv and leaves unrelated private data unused", async () => {
  const zip = zipSync({ "export/diary.csv": strToU8(csv), "reviews.csv": strToU8("ignored private review") });
  const result = await importExportFile(new File([Uint8Array.from(zip)], "fixture.zip"));
  assert.equal(result.entries.length, 5);
  assert.equal(JSON.stringify(result).includes("ignored private review"), false);
  assert.deepEqual(parseDiaryCsv(new TextDecoder().decode(extractDiaryZip(zip))), parseDiaryCsv(csv));
  assert.equal((await importExportFile(new File(["\uFEFF" + csv], "diary.csv"))).entries.length, 5);
});

test("bad file types, oversized, broken, missing and ambiguous ZIPs give recoverable errors", async () => {
  await assert.rejects(importExportFile(new File([csv], "watched.csv")), /Pilih ZIP/);
  await assert.rejects(importExportFile(new File([new Uint8Array(MAX_FILE_BYTES + 1)], "large.zip")), /terlalu besar/);
  assert.throws(() => extractDiaryZip(strToU8("not a zip")), /ZIP rusak/);
  assert.throws(() => extractDiaryZip(zipSync({ "watched.csv": strToU8(csv) })), /tidak menemukan diary.csv/);
  assert.throws(() => extractDiaryZip(zipSync({ "a/diary.csv": strToU8(csv), "b/diary.csv": strToU8(csv) })), /lebih dari satu/);
  assert.throws(() => extractDiaryZip(zipSync({ "diary.csv": new Uint8Array(MAX_DIARY_BYTES + 1) })), /terlalu besar/);
  const stored = zipSync({ "diary.csv": strToU8(csv) }, { level: 0 });
  assert.throws(() => extractDiaryZip(stored.subarray(0, stored.length - 12)), /ZIP rusak/);
  stored[50] ^= 1;
  assert.throws(() => extractDiaryZip(stored), /Isi diary.csv.*rusak/);
  assert.throws(() => parseDiaryCsv('Name,Watched Date\n"unclosed,2026-10-01'), /CSV rusak/);
});

test("RSS uses watchedDate, never pubDate; only stable GUIDs deduplicate", () => {
  const result = parseRss(xml);
  assert.equal(result.entries.length, 3);
  assert.equal(result.skipped, 3);
  assert.equal(result.duplicates, 1);
  assert.equal(result.entries[0].watchedDate, "2026-10-03");
  assert.equal(result.entries[1].rating, undefined);
  assert.equal(result.entries[0].rewatch, true);
  assert.equal(result.entries[2].title, "Paper & Moonlight");
  assert.equal(selectEntries(result.entries, defaultSettings).unique, 2);
  assert.equal(parseRss(xml.replace(/<guid[^>]*>.*?<\/guid>/g, "")).entries.length, 4);
});

test("RSS rejects non-RSS, empty, undated, malformed and entity-bearing XML", () => {
  for (const value of ["<html><body>Blocked</body></html>", "<rss><channel/></rss>", "<rss><channel><item><title>list</title></item></channel></rss>", "<rss>", '<!DOCTYPE rss [<!ENTITY x "abc">]><rss><channel/></rss>']) assert.throws(() => parseRss(value), ImportError);
});

test("periods and sorting count the whole period before limiting rows", () => {
  const entries = parseDiaryCsv(csv).entries;
  assert.deepEqual(availablePeriods(entries), { years: ["2026"], months: ["2026-10", "2026-09"] });
  const september = selectEntries(entries, { ...defaultSettings, period: "2026-09", sort: "rating" });
  assert.equal(september.sessions, 3);
  assert.equal(september.rows.at(-1)?.rating, undefined);
  assert.equal(selectEntries(entries, { ...defaultSettings, period: "2025" }).rows.length, 0);
  assert.equal(selectEntries(entries, { ...defaultSettings, sort: "oldest" }).rows[0].watchedDate, "2026-09-28");
  const many = Array.from({ length: 25 }, (_, i) => ({ ...entries[0], title: `Film ${i}` }));
  assert.equal(selectEntries(many, defaultSettings).rows.length, 10);
  assert.equal(selectEntries(many, { ...defaultSettings, count: 20 }).rows.length, 20);
  assert.equal(selectEntries(many, defaultSettings).sessions, 25);
});

test("release year filter extracts available years and selects matching films", () => {
  const entries = parseDiaryCsv(csv).entries;
  assert.deepEqual(availableReleaseYears(entries), ["2026", "2025", "2024", "1990"]);
  const only2026 = selectEntries(entries, { ...defaultSettings, period: "2026", releaseYear: "2026" });
  assert.equal(only2026.rows.length, 2);
  assert.ok(only2026.rows.every(r => r.releaseYear === 2026));
  const only1990 = selectEntries(entries, { ...defaultSettings, releaseYear: "1990" });
  assert.equal(only1990.rows.length, 1);
  assert.equal(only1990.rows[0].title, "The Last Matinee");
  assert.equal(only1990.rows[0].releaseYear, 1990);
  const nonExistent = selectEntries(entries, { ...defaultSettings, releaseYear: "1980" });
  assert.equal(nonExistent.rows.length, 0);
  assert.equal(nonExistent.sessions, 0);

  const tmdbMeta = new Map([
    [tmdbCacheKey("A Film with\nTwo Lines", 2025), {
      key: tmdbCacheKey("A Film with\nTwo Lines", 2025),
      title: "A Film with\nTwo Lines",
      releaseYear: 2025,
      matchedReleaseYear: 2026,
      genres: [],
      status: "matched" as const,
    }],
  ]);
  assert.deepEqual(availableReleaseYears(entries, tmdbMeta), ["2026", "2025", "2024", "1990"]);
  const matchedWithTmdb = selectEntries(entries, { ...defaultSettings, releaseYear: "2026" }, tmdbMeta);
  assert.equal(matchedWithTmdb.rows.length, 3);
  assert.ok(matchedWithTmdb.rows.some(r => r.title === "A Film with\nTwo Lines"));
});

test("film identity handles diary rewatch paths, same-title remakes, and safe filenames", () => {
  assert.equal(filmIdentity("https://letterboxd.com/user/film/title/3/", "Title", 2026), filmIdentity("https://letterboxd.com/film/title/", "Title", 2026));
  assert.notEqual(filmIdentity("", "Title", 2026), filmIdentity("", "Title", 1990));
  assert.match(safeFilename({ ...defaultSettings, name: "../../unsafe:<>/名", period: "2026-10" }), /^slipboxd-[\w-]+-2026-10\.png$/);
});
