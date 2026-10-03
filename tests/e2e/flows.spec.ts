import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { zipSync, strToU8 } from "fflate";
import { PNG } from "pngjs";
import { parseRss } from "../../src/lib/rss";

const csvPath = fileURLToPath(new URL("../fixtures/diary.csv", import.meta.url));
const xmlPath = fileURLToPath(new URL("../fixtures/public-rss.xml", import.meta.url));

test("CSV → edit both templates → PNG; local data stays off the network", async ({ page }, testInfo) => {
  const errors: string[] = [];
  const outgoing: { url: string; body: string | null }[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => outgoing.push({ url: request.url(), body: request.postData() }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your films. Your receipt." })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("landing.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByLabel("Pilih ZIP / diary.csv").setInputFiles(csvPath);
  await expect(page.getByRole("heading", { name: "Make it yours." })).toBeFocused();
  await expect(page.getByText("5 entri tersedia", { exact: false })).toBeVisible();
  await expect(page.getByText("2 baris tanpa", { exact: false })).toBeVisible();
  const receipt = page.getByTestId("receipt");
  await expect(receipt).toHaveAttribute("aria-label", /5 baris, 5 sesi.*4 film unik/);
  await page.getByLabel("Nama pada struk").fill("Film Friend");
  await page.getByLabel("Judul struk").fill("My October Cinema Diary");
  await page.getByLabel("Periode", { exact: true }).selectOption("2026-10");
  await expect(receipt).toHaveAttribute("aria-label", /2 baris, 2 sesi.*2 film unik/);
  await page.getByLabel("Urutan").selectOption("rating");
  await page.getByLabel("Jumlah baris").selectOption("20");
  await page.getByRole("button", { name: "Cinema Ticket" }).click();
  await expect(receipt).toContainText("CINEMA TICKET / ADMIT ONE");
  await page.getByRole("button", { name: "Putih" }).click();
  await expect(receipt.locator("rect").first()).toHaveAttribute("fill", "#ffffff");
  const dims = await receipt.evaluate((svg: SVGSVGElement) => ({ width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height }));
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("slipboxd-Film-Friend-2026-10.png");
  const output = testInfo.outputPath("receipt-ticket.png");
  await download.saveAs(output);
  const png = PNG.sync.read(await readFile(output));
  expect(png.width).toBe(dims.width * 3);
  expect(png.height).toBe(dims.height * 3);
  expect([...png.data.subarray(0, 4)]).toEqual([255, 255, 255, 255]);
  expect(png.data.some((value, i) => i % 4 < 3 && value < 100)).toBe(true);
  await page.getByRole("button", { name: "Classic Receipt" }).click();
  await page.getByRole("button", { name: "Krem" }).click();
  await expect(receipt).not.toContainText("CINEMA TICKET / ADMIT ONE");
  await expect(receipt.locator("rect").first()).toHaveAttribute("fill", "#fff5df");
  const classicDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  const classicPath = testInfo.outputPath("receipt-classic.png");
  await (await classicDownload).saveAs(classicPath);
  expect([...PNG.sync.read(await readFile(classicPath)).data.subarray(0, 4)]).toEqual([255, 245, 223, 255]);
  await page.screenshot({ path: testInfo.outputPath("editor.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(outgoing.some(r => r.body?.includes("Somewhere") || r.url.includes("/api/rss"))).toBe(false);
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Ganti sumber" }).click();
  await page.getByRole("button", { name: "Batal", exact: true }).click();
  await expect(page.getByLabel("Nama pada struk")).toHaveValue("Film Friend");
  await page.getByRole("button", { name: "Ganti sumber" }).click();
  await page.getByRole("button", { name: "Ya, ganti sumber" }).click();
  await expect(page.getByRole("heading", { name: "Mulai dari diary-mu" })).toBeFocused();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test("ZIP upload and bad-file recovery", async ({ page }) => {
  await page.goto("/");
  const input = page.getByLabel("Pilih ZIP / diary.csv");
  await input.setInputFiles({ name: "empty.zip", mimeType: "application/zip", buffer: Buffer.from(zipSync({ "watched.csv": strToU8("unused") })) });
  await expect(page.getByRole("main").getByRole("alert")).toContainText("tidak menemukan diary.csv");
  await input.setInputFiles({ name: "synthetic.zip", mimeType: "application/zip", buffer: Buffer.from(zipSync({ "export/diary.csv": strToU8(await readFile(csvPath, "utf8")) })) });
  await expect(page.getByRole("heading", { name: "Make it yours." })).toBeVisible();
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
  await page.getByLabel("Username Letterboxd").fill("https://invalid.test");
  await page.getByRole("button", { name: "Muat aktivitas terbaru" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Masukkan username, bukan URL");
  expect(calls).toBe(0);
  await page.getByLabel("Username Letterboxd").fill("fictional");
  await page.getByRole("button", { name: "Coba lagi" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("terlalu lama");
  await expect(page.getByRole("button", { name: "Upload ekspor", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Coba lagi" }).click();
  await expect(page.getByRole("heading", { name: "Make it yours." })).toBeVisible();
  await expect(page.getByLabel("Nama pada struk")).toHaveValue("fictional");
  await expect(page.getByTestId("receipt")).toContainText("Diambil dari aktivitas publik terbaru");
  await expect(page.getByTestId("receipt")).toContainText("berdasarkan entri yang tersedia");
  await expect(page.getByTestId("receipt")).toHaveAttribute("aria-label", /3 baris, 3 sesi.*2 film unik/);
  await expect(page.getByLabel("Periode", { exact: true }).locator("option")).toHaveCount(4);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  expect((await downloaded).suggestedFilename()).toBe("slipboxd-fictional-semua.png");
});

test("missing ratings disable sorting, long titles wrap, export failure preserves controls", async ({ page }) => {
  await page.goto("/");
  const title = "A very long fictional film title with no rating and a much longer name than a single line can hold";
  await page.getByLabel("Pilih ZIP / diary.csv").setInputFiles({ name: "diary.csv", mimeType: "text/csv", buffer: Buffer.from(`Name,Watched Date\n${title},2026-10-03`) });
  await expect(page.getByRole("option", { name: "Rating tertinggi (tidak tersedia)" })).toBeDisabled();
  await expect(page.getByTestId("receipt")).toContainText("—");
  await page.getByLabel("Judul struk").fill("Keep this title");
  await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = function(callback) { callback(null); }; });
  await page.getByRole("button", { name: "Download PNG" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Gambar belum berhasil dibuat");
  await expect(page.getByLabel("Judul struk")).toHaveValue("Keep this title");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("keyboard reaches source actions and editor controls", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Lewati ke konten" })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Buka halaman ekspor Letterboxd" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Pilih ZIP / diary.csv")).toBeFocused();
  await page.getByLabel("Pilih ZIP / diary.csv").setInputFiles(csvPath);
  await expect(page.getByRole("heading", { name: "Make it yours." })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Ganti sumber" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Nama pada struk")).toBeFocused();
  await page.keyboard.type("Keyboard user");
  await expect(page.getByTestId("receipt")).toContainText("Keyboard user");
});

test("real API rejects URLs without proxying them", async ({ request }) => {
  const response = await request.get("/api/rss?username=https://example.com");
  expect(response.status()).toBe(400);
  expect((await response.json()).code).toBe("username");
});
