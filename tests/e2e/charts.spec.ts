import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseRss } from "../../src/lib/rss";

const xmlPath = fileURLToPath(new URL("../fixtures/public-rss.xml", import.meta.url));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("slipboxd-language", "id"));
  await page.route("**/api/tmdb", async route => {
    const body = route.request().postDataJSON() as { movies: Array<{ key: string; title: string; releaseYear?: number }> };
    await route.fulfill({ status: 200, json: { results: body.movies.map(movie => ({
      ...movie, tmdbId: 100, matchedTitle: movie.title, matchedReleaseYear: movie.releaseYear,
      genres: [{ id: 18, name: "Drama" }],
      directors: movie.title === "Film A" ? [{ id: 1, name: "Director One" }, { id: 2, name: "Director Two" }] : [{ id: 1, name: "Director One" }],
      status: "matched",
    })) } });
  });
});

test("Charts has its own navigation state and an import empty state", async ({ page }) => {
  await page.goto("/charts");
  await expect(page.locator(".site-nav").getByRole("link", { name: "Grafik" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Impor diary-mu untuk melihat grafik.")).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Buat struk" }).click();
  await expect(page.getByRole("heading", { name: "Mulai dari diary-mu" })).toBeVisible();
});

test("Charts keeps imported diary across routes and filters all five cards", async ({ page }, testInfo) => {
  const year = new Date().getFullYear();
  const older = year - 1;
  await page.goto("/");
  await page.getByLabel("Pilih diary.csv").setInputFiles({ name: "diary.csv", mimeType: "text/csv", buffer: Buffer.from(
    `Name,Year,Watched Date,Rating\nFilm A,1999,${year}-01-02,4\nFilm A,1999,${year}-02-03,4.5\nFilm B,2021,${older}-08-04,`
  ) });
  await expect(page.getByRole("heading", { name: "Atur strukmu." })).toBeVisible();
  await page.locator(".site-nav").getByRole("link", { name: "Grafik" }).click();
  await expect(page.getByRole("heading", { name: "Grafik", exact: true })).toBeVisible();
  await expect(page.locator(".charts-grid .chart-card")).toHaveCount(5);
  await expect(page.locator(".charts-grid .chart-card h2")).toHaveText(["Genre Terbanyak", "Aktivitas Diary", "Dekade Rilis", "Distribusi Rating", "Sutradara Paling Banyak Ditonton"]);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(245, 245, 245)");
  await expect(page.locator(".charts-page")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".chart-card-body").first()).toHaveCSS("background-color", "rgb(250, 250, 250)");
  await expect(page.getByText("3 entri diary pada periode ini")).toBeVisible();
  await expect(page.locator("#top-genres").locator("..", { })).toContainText("Genre Terbanyak");
  await expect(page.locator(".chart-card").filter({ has: page.locator("#top-genres") }).locator(".chart-bar-list li")).toContainText(["Drama3"]);
  await expect(page.locator(".chart-card").filter({ has: page.locator("#most-watched-directors") }).locator(".chart-directors")).toContainText("Director One3");
  await expect(page.getByText("Berdasarkan 2 entri diary yang diberi rating.")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("charts-id.png"), fullPage: true });
  await page.getByRole("button", { name: "Tahun ini" }).click();
  await expect(page.getByText("2 entri diary pada periode ini")).toBeVisible();
  await expect(page.locator(".chart-card").filter({ has: page.locator("#release-decades") })).toContainText("1990-an");
  await expect(page.locator(".chart-card").filter({ has: page.locator("#release-decades") })).not.toContainText("2020-an");
  await page.getByLabel("Pilih tahun").selectOption(String(older));
  await expect(page.getByRole("button", { name: "Tahun ini" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("1 entri diary pada periode ini")).toBeVisible();
  await expect(page.getByText("Tidak ada entri diary yang diberi rating pada periode ini.")).toBeVisible();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Most Watched Directors" })).toBeVisible();
  await expect(page.getByText("Based on 0 rated diary entries.")).toBeVisible();
  await expect(page.getByText("Data sutradara tersedia", { exact: false })).toHaveCount(0);
  await page.locator(".site-nav").getByRole("link", { name: "Create Receipt" }).click();
  await expect(page.getByRole("heading", { name: "Set up your receipt." })).toBeVisible();
  await expect(page.getByTestId("receipt")).toHaveAttribute("aria-label", /3 rows, 3 sessions/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Charts rolling period controls filter diary entries", async ({ page }) => {
  const today = new Date();
  const date = (offset: number) => {
    const value = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  };
  await page.goto("/");
  await page.getByLabel("Pilih diary.csv").setInputFiles({ name: "diary.csv", mimeType: "text/csv", buffer: Buffer.from(
    `Name,Year,Watched Date,Rating\nFilm A,1999,${date(0)},4\nFilm B,2000,${date(-40)},3\nFilm C,2001,${date(-220)},2`
  ) });
  await page.locator(".site-nav").getByRole("link", { name: "Grafik" }).click();
  await page.getByRole("button", { name: "4 Minggu" }).click();
  await expect(page.getByText("1 entri diary pada periode ini")).toBeVisible();
  await page.getByRole("button", { name: "6 Bulan" }).click();
  await expect(page.getByText("2 entri diary pada periode ini")).toBeVisible();
  await page.getByRole("button", { name: "Semua diary" }).click();
  await expect(page.getByText("3 entri diary pada periode ini")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Charts marks username data as recent public RSS activity", async ({ page }) => {
  const parsed = parseRss(await readFile(xmlPath, "utf8"));
  await page.route("**/api/rss?*", route => route.fulfill({ status: 200, json: { ...parsed, username: "fictional" } }));
  await page.goto("/");
  await page.getByRole("tab", { name: /Letterboxd username/ }).click();
  await page.getByLabel("Username Letterboxd").fill("fictional");
  await page.getByRole("button", { name: "Muat aktivitas terbaru" }).click();
  await page.locator(".site-nav").getByRole("link", { name: "Grafik" }).click();
  await expect(page.getByText(/Grafik hanya mencerminkan entri publik terbaru/)).toBeVisible();
  await expect(page.getByText("3 entri diary pada periode ini")).toBeVisible();
});

test("Charts shows empty period and missing metadata states without invented values", async ({ page }) => {
  const older = new Date().getFullYear() - 1;
  await page.route("**/api/tmdb", async route => {
    const body = route.request().postDataJSON() as { movies: Array<{ key: string; title: string; releaseYear?: number }> };
    await route.fulfill({ status: 200, json: { results: body.movies.map(movie => ({ ...movie, genres: [], directors: [], status: "unmatched" })) } });
  });
  await page.goto("/");
  await page.getByLabel("Pilih diary.csv").setInputFiles({ name: "diary.csv", mimeType: "text/csv", buffer: Buffer.from(
    `Name,Year,Watched Date,Rating\nFilm A,1999,${older}-03-02,`
  ) });
  await page.locator(".site-nav").getByRole("link", { name: "Grafik" }).click();
  await expect(page.getByText("Data genre tidak tersedia untuk periode ini.")).toBeVisible();
  await expect(page.getByText("Data sutradara tidak tersedia untuk periode ini.")).toBeVisible();
  await expect(page.getByText("Data genre tersedia untuk 0 entri diary.")).toBeVisible();
  await page.getByRole("button", { name: "Tahun ini" }).click();
  await expect(page.getByText("Tidak ada entri diary pada periode ini.")).toBeVisible();
  await expect(page.locator(".charts-grid")).toHaveCount(0);
});
