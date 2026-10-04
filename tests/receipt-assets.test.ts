import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ACTIVE_RECEIPT_BACKGROUND, DEFAULT_RECEIPT_BACKGROUND, RECEIPT_BACKGROUNDS } from "../src/config/receipt-backgrounds";

test("receipt background configuration points to public local assets", async () => {
  assert.equal(ACTIVE_RECEIPT_BACKGROUND, RECEIPT_BACKGROUNDS[DEFAULT_RECEIPT_BACKGROUND]);
  assert.deepEqual(Object.keys(RECEIPT_BACKGROUNDS), ["paper-bg-1", "paper-bg-2", "paper-bg-3", "paper-bg-4"]);
  await Promise.all(Object.values(RECEIPT_BACKGROUNDS).map(path => access(fileURLToPath(new URL(`../public${path}`, import.meta.url)))));
  await access(fileURLToPath(new URL("../public/fonts/merchant-copy.ttf", import.meta.url)));
  await access(fileURLToPath(new URL("../public/assets/letterboxd-logo.svg", import.meta.url)));
  await access(fileURLToPath(new URL("../public/assets/barcode.svg", import.meta.url)));
  await access(fileURLToPath(new URL("../public/assets/tmdb-logo.svg", import.meta.url)));
});
