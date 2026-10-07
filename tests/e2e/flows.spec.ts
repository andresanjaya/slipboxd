import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { parseRss } from "../../src/lib/rss";

const csvPath = fileURLToPath(new URL("../fixtures/diary.csv", import.meta.url));
const xmlPath = fileURLToPath(new URL("../fixtures/public-rss.xml", import.meta.url));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("slipboxd-language", "id"));
  await page.route("**/api/tmdb", async route => {
    const body = route.request().postDataJSON() as { movies: Array<{ key: string; title: string; releaseYear?: number }> };
    await route.fulfill({ status: 200, json: { results: body.movies.map((movie, index) => ({
      ...movie,
      tmdbId: 1000 + index,
      matchedTitle: movie.title,
      matchedReleaseYear: movie.releaseYear,
      genres: index % 3 === 0 ? [{ id: 18, name: "Drama" }, { id: 10749, name: "Romance" }] : index % 3 === 1 ? [{ id: 53, name: "Thriller" }] : [{ id: 35, name: "Comedy" }],
      runtime: movie.title.includes("Film 03") ? undefined : 90 + index,
      status: movie.title.includes("Unmatched") ? "unmatched" : "matched",
    })) } });
  });
});

test("Mobile receipt editor shows preview, settings, profile, then annual recap", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "This ordering applies only to the mobile layout.");
  await page.goto("/");
  await page.getByLabel("Pilih diary.csv").setInputFiles(csvPath);
  await expect(page.locator(".preview-stage")).toBeVisible();
  await expect(page.locator(".controls")).toBeVisible();
  await expect(page.locator(".viewing-profile")).toBeVisible();
  await expect(page.locator(".annual-recap-card")).toBeVisible();
  const [preview, settings, profile, recap] = await Promise.all([
    page.locator(".preview-stage").boundingBox(),
    page.locator(".controls").boundingBox(),
    page.locator(".viewing-profile").boundingBox(),
    page.locator(".annual-recap-card").boundingBox(),
  ]);
  expect(preview?.y).toBeLessThan(settings?.y ?? 0);
  expect(settings?.y).toBeLessThan(profile?.y ?? 0);
  expect(profile?.y).toBeLessThan(recap?.y ?? 0);
});

test("CSV → rating and minute receipt → four papers → PNG; local data stays off the network", async ({ page }, testInfo) => {
  const errors: string[] = [];
  const outgoing: { url: string; body: string | null }[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => outgoing.push({ url: request.url(), body: request.postData() }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Buat strukmu" })).toBeVisible();
  await page.getByRole("button", { name: "ID", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ubah diary Letterboxd-mu menjadi struk." })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("landing.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByLabel("Pilih diary.csv").setInputFiles(csvPath);
  await expect(page.getByRole("heading", { name: "Atur strukmu." })).toBeFocused();
  await expect(page.getByLabel("Judul struk")).toHaveCount(0);
  await expect(page.getByText("5 entri tersedia", { exact: false })).toBeVisible();
  await expect(page.getByText("2 baris tanpa", { exact: false })).toBeVisible();
  const receipt = page.getByTestId("receipt");
  await expect(page.locator(".receipt-paper")).toBeVisible();
  await expect(receipt.locator("image[data-receipt-background]")).toHaveAttribute("href", /paper-bg-2\.jpe?g/);
  await expect(page.getByRole("radiogroup", { name: "Ukuran ekspor" })).toHaveCount(0);
  await expect(receipt.locator('image[href="/assets/figma-letterboxd-logo.svg"]')).toHaveCount(1);
  await expect(receipt.locator('image[href="/assets/figma-barcode.svg"]')).toHaveCount(1);
  await expect(receipt.locator("rect")).toHaveCount(0);
  await expect(receipt.locator("g").first()).toHaveAttribute("font-family", /Merchant Copy/);
  expect(await page.evaluate(() => document.fonts.check('16px "Merchant Copy"'))).toBe(true);
  await expect(receipt).toHaveAttribute("aria-label", /5 baris, 5 sesi.*4 film unik/);
  await page.getByLabel("Nama pada struk").fill("Film Friend");
  await page.getByLabel("Periode", { exact: true }).selectOption("2026-10");
  await expect(page.getByText("Metadata TMDB:", { exact: false })).toContainText("2 cocok");
  await expect(receipt).toHaveAttribute("aria-label", /2 baris, 2 sesi.*2 film unik/);
  await expect(receipt).toContainText("ORDER #003 UNTUK FILM FRIEND");
  await expect(receipt).toContainText("AVERAGE RATING:");
  await page.getByLabel("Nilai pada struk").selectOption("minute");
  await expect(receipt).toContainText("TOTAL RUNTIME:");
  await page.getByLabel("Urutan").selectOption("rating");
  await page.getByLabel("Jumlah baris").selectOption("20");
  await page.locator(".paper-choice").nth(3).click();
  await expect(receipt.locator("image[data-receipt-background]")).toHaveAttribute("href", /paper-bg-4\.jpe?g/);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("slipboxd-Film-Friend-2026-10.png");
  const output = testInfo.outputPath("receipt-paper-4.png");
  await download.saveAs(output);
  const png = PNG.sync.read(await readFile(output));
  expect(png.width).toBe(1320);
  expect(png.height).toBe(Number(await receipt.getAttribute("height")) * 3);
  expect(png.data[3]).toBe(255);
  const topPaperColors = new Set(Array.from({ length: png.width }, (_, x) => {
    const offset = x * 4;
    return `${png.data[offset]},${png.data[offset + 1]},${png.data[offset + 2]}`;
  }));
  expect(topPaperColors.size).toBeGreaterThan(1);
  expect(png.data.some((value, i) => i % 4 < 3 && value < 100)).toBe(true);
  await page.locator(".paper-choice").first().click();
  await expect(receipt.locator("image[data-receipt-background]")).toHaveAttribute("href", /paper-bg-1\.jpe?g/);
  const classicDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  const classicPath = testInfo.outputPath("receipt-paper-1.png");
  await (await classicDownload).saveAs(classicPath);
  expect(PNG.sync.read(await readFile(classicPath)).data[3]).toBe(255);
  await page.screenshot({ path: testInfo.outputPath("editor.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(outgoing.some(r => r.body?.includes("Watched Date") || r.body?.includes("Letterboxd URI") || r.url.includes("/api/rss"))).toBe(false);
  expect(outgoing.some(r => r.url.includes("/api/tmdb") && r.body?.includes("Somewhere"))).toBe(true);
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Ganti sumber" }).click();
  await page.getByRole("button", { name: "Batal", exact: true }).click();
  await expect(page.getByLabel("Nama pada struk")).toHaveValue("Film Friend");
  await page.getByRole("button", { name: "Ganti sumber" }).click();
  await page.getByRole("button", { name: "Ya, ganti sumber" }).click();
  await expect(page.getByRole("heading", { name: "Mulai dari diary-mu" })).toBeFocused();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(["slipboxd-language"]);
});

test("receipt exports the configured texture and Merchant Copy with 10 and 20 entries", async ({ page }, testInfo) => {
  const rows = Array.from({ length: 20 }, (_, index) => `Film ${String(index + 1).padStart(2, "0")},2026,2026-10-${String((index % 20) + 1).padStart(2, "0")},${(index % 5) + 0.5}`);
  await page.goto("/");
  await page.getByLabel("Pilih diary.csv").setInputFiles({
    name: "diary.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`Name,Year,Watched Date,Rating\n${rows.join("\n")}`),
  });
  const receipt = page.getByTestId("receipt");
  await expect(page.getByText("Metadata TMDB:", { exact: false })).toContainText("20 cocok");
  await expect(receipt).toHaveAttribute("aria-label", /10 baris, 20 sesi.*20 film unik/);
  await expect(receipt.locator("image[data-receipt-background]")).toHaveAttribute("href", /paper-bg-2\.jpe?g/);
  const filmSpacing = await receipt.evaluate(svg => {
    const [first, second] = [...svg.querySelectorAll("g > g")];
    const firstTexts = [...first.querySelectorAll("text")];
    const title = firstTexts[1].getBBox();
    const year = firstTexts.at(-1)!.getBBox();
    const firstY = Number(firstTexts[1].getAttribute("y"));
    const secondY = Number(second.querySelectorAll("text")[1].getAttribute("y"));
    const movie = [...svg.querySelectorAll<SVGTextElement>("g > text")][6].getBBox();
    return { yearGap: (year.y - title.y - title.height) * 3, yearBaselineOffset: Number(firstTexts.at(-1)!.getAttribute("y")) - firstY, rowStep: secondY - firstY, headerTopGap: movie.y - 208, headerBottomGap: 243 - movie.y - movie.height };
  });
  expect(filmSpacing.yearBaselineOffset).toBe(15.5);
  expect(filmSpacing.yearGap).toBeGreaterThan(10);
  expect(filmSpacing.yearGap).toBeLessThan(22);
  expect(filmSpacing.rowStep).toBe(45);
  expect(Math.abs(filmSpacing.headerTopGap - filmSpacing.headerBottomGap)).toBeLessThan(3);
  const tenDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  const tenPath = testInfo.outputPath("receipt-10.png");
  await (await tenDownload).saveAs(tenPath);
  const ten = PNG.sync.read(await readFile(tenPath));
  expect(ten.width).toBe(1320);
  expect(ten.height).toBe(Number(await receipt.getAttribute("height")) * 3);

  await page.getByLabel("Jumlah baris").selectOption("20");
  await expect(receipt).toHaveAttribute("aria-label", /20 baris, 20 sesi.*20 film unik/);
  const twentyDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  const twentyPath = testInfo.outputPath("receipt-20.png");
  await (await twentyDownload).saveAs(twentyPath);
  const twenty = PNG.sync.read(await readFile(twentyPath));
  expect(twenty.width).toBe(1320);
  expect(twenty.height).toBe(Number(await receipt.getAttribute("height")) * 3);
  expect(twenty.height).toBeGreaterThan(ten.height);
});

test("Annual Recap exports the default card size with its paper background", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByLabel("Pilih diary.csv").setInputFiles(csvPath);
  await expect(page.getByRole("heading", { name: "Rekap Tahunan" })).toBeVisible();
  await expect(page.getByLabel("Tahun diary")).toHaveValue("2026");
  await expect(page.locator(".annual-recap-card .annual-recap-note").first()).toContainText(/Genre tersedia untuk \d dari 4 film/);
  const recapCanvas = page.locator(".annual-recap-canvas");
  await expect(recapCanvas).toBeVisible();
  await expect(page.getByTestId("annual-recap-artwork")).toContainText("REKAP TAHUNAN");
  await expect(page.getByTestId("annual-recap-artwork").locator("image[data-receipt-background]")).toHaveAttribute("href", /paper-bg-2\.jpe?g/);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh PNG rekap" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("slipboxd-annual-recap-2026.png");
  const path = testInfo.outputPath("annual-recap.png");
  await download.saveAs(path);
  const png = PNG.sync.read(await readFile(path));
  expect(png.width).toBe(1320);
  expect(png.height).toBe(2070);
  expect(png.data.some((value, index) => index % 4 < 3 && value < 100)).toBe(true);
});

test("diary.csv upload and bad-file recovery", async ({ page }) => {
  await page.goto("/");
  const input = page.getByLabel("Pilih diary.csv");
  await expect(input).toHaveAttribute("accept", ".csv,text/csv");
  await input.setInputFiles({ name: "watched.csv", mimeType: "text/csv", buffer: Buffer.from("Name,Watched Date\nExample,2026-10-01") });
  await expect(page.getByRole("main").getByRole("alert")).toContainText("pilih file bernama diary.csv");
  await input.setInputFiles(csvPath);
  await expect(page.getByRole("heading", { name: "Atur strukmu." })).toBeVisible();
  await expect(page.getByTestId("receipt")).toHaveAttribute("aria-label", /5 baris/);
});

test("ZIP dropped onto the CSV upload area is rejected with recovery guidance", async ({ page }) => {
  await page.goto("/");
  const input = page.getByLabel("Pilih diary.csv");
  await page.locator("#upload-title").evaluate(element => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["PK"], "letterboxd-export.zip", { type: "application/zip" }));
    element.closest("section")?.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  const alert = page.getByRole("main").getByRole("alert");
  await expect(alert).toContainText("Ekstrak ekspor Letterboxd lalu pilih file bernama diary.csv");
  await input.setInputFiles(csvPath);
  await expect(page.getByRole("heading", { name: "Atur strukmu." })).toBeVisible();
  await expect(page.getByTestId("receipt")).toHaveAttribute("aria-label", /5 baris/);
});

test("RSS fixture → editor → PNG, with source limitations and recovery", async ({ page }) => {
  const parsed = parseRss(await readFile(xmlPath, "utf8"));
  let calls = 0;
  await page.route("**/api/rss?*", async route => {
    calls++;
    if (calls === 1) await route.fulfill({ status: 504, json: { error: "Aktivitas publik terlalu lama merespons. Coba lagi atau upload ekspor." } });
    else await route.fulfill({ status: 200, json: { ...parsed, username: "fictional" } });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: /Letterboxd username/ }).click();
  await expect(page.getByLabel("Username Letterboxd")).toHaveAttribute("data-slot", "input");
  const loadButton = page.getByRole("button", { name: "Muat aktivitas terbaru" });
  await expect(loadButton).toHaveAttribute("data-slot", "button");
  await expect(loadButton.locator("svg")).toHaveCount(1);
  await page.getByLabel("Username Letterboxd").fill("https://invalid.test");
  await page.getByRole("button", { name: "Muat aktivitas terbaru" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Masukkan username, bukan URL");
  expect(calls).toBe(0);
  await page.getByLabel("Username Letterboxd").fill("fictional");
  await page.getByRole("button", { name: "Coba lagi" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("terlalu lama");
  await expect(page.getByRole("button", { name: "Unggah diary.csv", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Coba lagi" }).click();
  await expect(page.getByRole("heading", { name: "Atur strukmu." })).toBeVisible();
  await expect(page.getByLabel("Nama pada struk")).toHaveValue("fictional");
  await expect(page.getByText("Dari aktivitas publik terbaru")).toBeVisible();
  await expect(page.getByText(/Hanya entri RSS publik terbaru/)).toBeVisible();
  await expect(page.getByTestId("receipt")).toHaveAttribute("aria-label", /3 baris, 3 sesi.*2 film unik/);
  await expect(page.getByLabel("Periode", { exact: true }).locator("option")).toHaveCount(4);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  expect((await downloaded).suggestedFilename()).toBe("slipboxd-fictional-semua.png");
});

test("missing ratings disable sorting, long titles wrap, export failure preserves controls", async ({ page }) => {
  await page.goto("/");
  const title = "A very long fictional film title with no rating and a much longer name than a single line can hold";
  await page.getByLabel("Pilih diary.csv").setInputFiles({ name: "diary.csv", mimeType: "text/csv", buffer: Buffer.from(`Name,Watched Date\n${title},2026-10-03`) });
  await expect(page.getByRole("option", { name: "Rating tertinggi (tidak tersedia)" })).toBeDisabled();
  const receipt = page.getByTestId("receipt");
  await expect(receipt).toContainText("—");
  const titleRightEdges = await receipt.locator("g > g").first().locator("text").evaluateAll(elements =>
    elements.slice(1, -2).map(element => {
      const box = (element as SVGTextElement).getBBox();
      return box.x + box.width;
    }),
  );
  expect(titleRightEdges.length).toBeGreaterThan(1);
  expect(Math.max(...titleRightEdges)).toBeLessThan(390);
  await page.getByLabel("Nama pada struk").fill("Keep this name");
  await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = function(callback) { callback(null); }; });
  await page.getByRole("button", { name: "Download PNG" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Gambar belum berhasil dibuat");
  await expect(page.getByLabel("Nama pada struk")).toHaveValue("Keep this name");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("keyboard reaches source actions and editor controls", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Lewati ke konten" })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByRole("tab", { name: /Unggah ekspor/ }).focus();
  await expect(page.getByRole("tab", { name: /Unggah ekspor/ })).toBeFocused();
  await page.getByLabel("Pilih diary.csv").setInputFiles(csvPath);
  await expect(page.getByRole("heading", { name: "Atur strukmu." })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Ganti sumber" })).toBeFocused();
  const nameInput = page.getByLabel("Nama pada struk");
  for (let index = 0; index < 4 && !(await nameInput.evaluate(element => element === document.activeElement)); index++) await page.keyboard.press("Tab");
  await expect(nameInput).toBeFocused();
  await page.keyboard.type("Keyboard user");
  await expect(page.getByTestId("receipt")).toContainText("KEYBOARD USER");
});

test("real API rejects URLs without proxying them", async ({ request }) => {
  const response = await request.get("/api/rss?username=https://example.com");
  expect(response.status()).toBe(400);
  expect((await response.json()).code).toBe("username");
});
