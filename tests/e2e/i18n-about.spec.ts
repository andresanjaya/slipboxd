import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

const csvPath = fileURLToPath(new URL("../fixtures/diary.csv", import.meta.url));

test("navigator language default, manual choice, document lang, and persistence", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await expect(page.getByRole("heading", { name: "Ubah diary Letterboxd-mu menjadi struk." })).toBeVisible();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Turn your Letterboxd diary into a receipt." })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("slipboxd-language"))).toBe("en");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Turn your Letterboxd diary into a receipt." })).toBeVisible();
  await expect(page.getByRole("button", { name: "EN", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("language changes after import without losing diary or editor state", async ({ page }) => {
  await page.route("**/api/tmdb", async route => {
    const request = route.request().postDataJSON() as { movies: Array<{ key: string; title: string; releaseYear?: number }> };
    await route.fulfill({ status: 200, json: { results: request.movies.map((movie, index) => ({
      ...movie, tmdbId: index + 1, matchedTitle: movie.title, matchedReleaseYear: movie.releaseYear,
      genres: [{ id: 18, name: "Drama" }], status: "matched",
    })) } });
  });
  await page.goto("/");
  await page.getByLabel("Pilih diary.csv").setInputFiles(csvPath);
  await expect(page.getByRole("heading", { name: "Atur strukmu." })).toBeVisible();
  await page.getByLabel("Nama pada struk").fill("State Keeper");
  await page.getByLabel("Jumlah baris").selectOption("20");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Set up your receipt." })).toBeVisible();
  await expect(page.getByLabel("Name on receipt")).toHaveValue("State Keeper");
  await expect(page.getByLabel("Number of rows")).toHaveValue("20");
  await expect(page.getByTestId("receipt")).toHaveAttribute("aria-label", /5 rows, 5 sessions.*4 unique films/);
  await expect(page.getByTestId("receipt")).toContainText("ORDER #003 FOR STATE KEEPER");
  await expect(page.getByTestId("receipt")).toContainText("OCTOBER 2026");
  await expect(page.getByTestId("receipt")).toContainText("2024");
  await expect(page.getByRole("heading", { name: "Viewing Profile" })).toBeVisible();
  await expect(page.getByText("5 viewing sessions")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Annual Recap" })).toBeVisible();
  await expect(page.getByLabel("Diary year")).toHaveValue("2026");
  await expect(page.getByTestId("annual-recap-artwork")).not.toContainText("Genres available for");
  await expect(page.getByTestId("annual-recap-artwork")).not.toContainText("Genre metadata is incomplete");
  await expect(page.locator(".annual-recap-card .annual-recap-note").first()).toHaveText("Genres available for 4 of 4 films.");
  await page.getByRole("button", { name: "ID", exact: true }).click();
  await expect(page.getByLabel("Nama pada struk")).toHaveValue("State Keeper");
  await expect(page.getByTestId("receipt")).toContainText("ORDER #003 UNTUK STATE KEEPER");
  await expect(page.getByTestId("receipt")).toContainText("OKTOBER 2026");
  await expect(page.getByTestId("receipt")).toContainText("2024");
  await expect(page.getByRole("heading", { name: "Profil Menonton" })).toBeVisible();
  await expect(page.getByText("5 sesi menonton")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rekap Tahunan" })).toBeVisible();
  await expect(page.getByLabel("Tahun diary")).toHaveValue("2026");
  await expect(page.locator(".annual-recap-card .annual-recap-note").first()).toHaveText("Genre tersedia untuk 4 dari 4 film.");
  await expect(page.locator(".annual-recap-canvas")).toBeVisible();
});

test("About and FAQ are bilingual; accordion works with keyboard", async ({ page }, testInfo) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "Tentang Slipboxd" })).toBeVisible();
  await expect(page.locator("#main .about-disclaimer")).toContainText("Slipboxd adalah proyek independen dan tidak berafiliasi, didukung, atau disponsori");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("heading", { name: "About Slipboxd" })).toBeVisible();
  await expect(page.getByText("This product uses the TMDB API but is not endorsed or certified by TMDB.")).toBeVisible();
  await expect(page.getByRole("link", { name: /The Movie Database/ })).toHaveAttribute("href", "https://www.themoviedb.org/");
  const accordion = page.getByRole("button", { name: /Show answer: What is Slipboxd/ });
  await accordion.focus();
  await page.keyboard.press("Enter");
  await expect(accordion).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("region", { name: "What is Slipboxd?" })).toBeVisible();
  await page.keyboard.press("Space");
  await expect(accordion).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("heading", { name: "Credits" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Receiptify", exact: true }).last()).toHaveAttribute("href", "https://receiptify.herokuapp.com/");
  await expect(page.getByRole("link", { name: "Michelle Liu" })).toHaveAttribute("href", "https://www.liumichelle.com/");
  await expect(page.getByRole("main").getByRole("link", { name: "Andre Sanjaya" })).toHaveAttribute("href", "https://www.instagram.com/skinnydookie/");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Andre Sanjaya" })).toHaveAttribute("href", "https://www.instagram.com/skinnydookie/");
  await page.screenshot({ path: testInfo.outputPath("about-en.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
