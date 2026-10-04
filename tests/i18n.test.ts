import { test } from "node:test";
import assert from "node:assert/strict";
import { dictionaries, formatCalendarDate, formatMonth, formatNumber, formatRange, isLanguage } from "../src/i18n/index";

test("language dictionaries cover locale-sensitive dates, numbers, and ranges", () => {
  assert.equal(formatCalendarDate("2026-10-03", dictionaries.en), "Oct 3, 2026");
  assert.match(formatCalendarDate("2026-10-03", dictionaries.id), /3 Okt 2026/);
  assert.equal(formatNumber(4.5, dictionaries.en, 1), "4.5");
  assert.equal(formatNumber(4.5, dictionaries.id, 1), "4,5");
  assert.equal(formatMonth("2026-10", dictionaries.en), "October 2026");
  assert.match(formatMonth("2026-10", dictionaries.id), /Oktober 2026/);
  assert.match(formatRange([{ watchedDate: "2026-10-03" }, { watchedDate: "2026-09-30" }], dictionaries.en), /Sep 30, 2026 — Oct 3, 2026/);
});

test("only supported persisted language values are accepted", () => {
  assert.equal(isLanguage("id"), true);
  assert.equal(isLanguage("en"), true);
  assert.equal(isLanguage("fr"), false);
  assert.equal(isLanguage(null), false);
});

test("both dictionaries provide every parser and RSS recovery message used by the UI", () => {
  const codes = ["too-large", "csv-corrupt", "csv-columns", "no-dates", "zip-corrupt", "zip-ambiguous", "zip-missing", "zip-unsupported", "zip-encrypted", "file-type", "file-corrupt", "username", "rss-not-found", "rss-unavailable", "rss-upstream", "rss-large", "rss-empty", "rss-format", "rss-no-diary", "rss-timeout", "rss-network", "rss-disabled"];
  for (const language of ["id", "en"] as const) for (const code of codes) assert.ok(dictionaries[language].errors[code], `${language}.${code}`);
});
