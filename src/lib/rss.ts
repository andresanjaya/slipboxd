import { XMLParser, XMLValidator } from "fast-xml-parser";
import { calendarDate, filmIdentity, ImportError, ratingValue, releaseYearValue, rewatchValue, type ImportResult, type WatchEntry } from "./model";

export const MAX_RSS_BYTES = 2 * 1024 * 1024;
export function validUsername(value: string): string | undefined {
  const username = value.trim().toLowerCase();
  if (/^[a-z0-9][a-z0-9_-]{0,39}$/.test(username)) return username;
}

function stringValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value && typeof value === "object" && "#text" in value) return stringValue(value["#text"]);
  return "";
}

export function parseRss(xml: string): ImportResult {
  if (new TextEncoder().encode(xml).length > MAX_RSS_BYTES) throw new ImportError("rss-large", "Respons aktivitas publik terlalu besar. Gunakan upload ekspor.", 502);
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new ImportError("rss-format", "Format feed tidak dapat dibaca. Coba lagi atau upload ekspor.", 502);
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false, removeNSPrefix: true, trimValues: true }).parse(xml);
  if (!parsed.rss?.channel) throw new ImportError("rss-format", "Sumber tidak mengembalikan RSS. Coba lagi atau upload ekspor.", 502);
  const rawItems = parsed.rss.channel.item;
  const items = rawItems ? (Array.isArray(rawItems) ? rawItems : [rawItems]) : [];
  if (!items.length) throw new ImportError("rss-empty", "Feed publik masih kosong. Gunakan upload ekspor atau coba akun lain.", 422);
  const entries: WatchEntry[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let duplicates = 0;
  for (const item of items) {
    const watchedDate = calendarDate(stringValue(item.watchedDate));
    const title = stringValue(item.filmTitle);
    if (!watchedDate || !title) { skipped++; continue; }
    const guid = stringValue(item.guid);
    if (guid && seen.has(guid)) { duplicates++; continue; }
    if (guid) seen.add(guid);
    const releaseYear = releaseYearValue(stringValue(item.filmYear));
    entries.push({ source: "rss", title, watchedDate, releaseYear,
      filmKey: filmIdentity(stringValue(item.link), title, releaseYear),
      rating: ratingValue(stringValue(item.memberRating)), rewatch: rewatchValue(stringValue(item.rewatch)) });
  }
  if (!entries.length) throw new ImportError("rss-no-diary", "Tidak ada entri diary dengan tanggal menonton valid dalam feed. Gunakan upload ekspor.", 422);
  return { source: "rss", entries, skipped, duplicates };
}

export async function fetchPublicDiary(username: string, fetcher: typeof fetch = fetch, timeoutMs = 8000): Promise<ImportResult> {
  const normalized = validUsername(username);
  if (!normalized) throw new ImportError("username", "Masukkan username Letterboxd, bukan URL (huruf, angka, _ atau -; maks. 40 karakter).");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(`https://letterboxd.com/${normalized}/rss/`, {
      signal: controller.signal, redirect: "error", cache: "no-store",
      headers: { Accept: "application/rss+xml, application/xml, text/xml", "User-Agent": "Slipboxd/0.1 (public RSS reader)" },
    });
    if (response.status === 404) throw new ImportError("rss-not-found", "Akun atau feed tidak ditemukan. Periksa username atau upload ekspor.", 404);
    if ([401, 403].includes(response.status)) throw new ImportError("rss-unavailable", "Feed privat atau tidak tersedia untuk diakses. Gunakan upload ekspor.", 502);
    if (!response.ok) throw new ImportError("rss-upstream", "Layanan sumber sedang gagal. Coba lagi atau upload ekspor.", 502);
    if (Number(response.headers.get("content-length")) > MAX_RSS_BYTES) {
      await response.body?.cancel();
      throw new ImportError("rss-large", "Respons aktivitas publik terlalu besar. Gunakan upload ekspor.", 502);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new ImportError("rss-empty", "Feed tidak tersedia. Gunakan upload ekspor.", 502);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_RSS_BYTES) {
          await reader.cancel();
          throw new ImportError("rss-large", "Respons aktivitas publik terlalu besar. Gunakan upload ekspor.", 502);
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return { ...parseRss(new TextDecoder().decode(bytes)), username: normalized };
  } catch (error) {
    if (error instanceof ImportError) throw error;
    if (controller.signal.aborted) throw new ImportError("rss-timeout", "Aktivitas publik terlalu lama merespons. Coba lagi atau upload ekspor.", 504);
    throw new ImportError("rss-network", "Aktivitas publik belum bisa dimuat. Coba lagi atau upload ekspor.", 502);
  } finally { clearTimeout(timeout); }
}
