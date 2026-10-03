import Papa from "papaparse";
import { Unzip, UnzipInflate } from "fflate";
import { crc32, diaryZipMetadata, isDiaryPath } from "./zip-integrity";
import { calendarDate, filmIdentity, ImportError, ratingValue, releaseYearValue, rewatchValue, type ImportResult, type WatchEntry } from "./model";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_DIARY_BYTES = 10 * 1024 * 1024;

export function parseDiaryCsv(text: string): ImportResult {
  if (new TextEncoder().encode(text).length > MAX_DIARY_BYTES) throw new ImportError("too-large", "diary.csv terlalu besar. Batasnya 10 MB.");
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), { skipEmptyLines: "greedy" });
  if (parsed.errors.some(e => e.type === "Quotes")) throw new ImportError("csv-corrupt", "CSV rusak atau tanda kutipnya tidak lengkap. Pilih file ekspor lain.");
  const headers = (parsed.data[0] ?? []).map(h => h.trim());
  if (!headers.includes("Name") || !headers.includes("Watched Date") || new Set(headers).size !== headers.length) {
    const found = headers.map(h => h.slice(0, 40)).slice(0, 20).join(", ");
    throw new ImportError("csv-columns", `Format kolom diary tidak dikenali. Kolom yang ditemukan: ${found || "(kosong)"}.`);
  }
  const entries: WatchEntry[] = [];
  let skipped = 0;
  for (const row of parsed.data.slice(1)) {
    const field = (name: string) => (row[headers.indexOf(name)] ?? "").trim();
    const watchedDate = calendarDate(field("Watched Date"));
    const title = field("Name");
    if (!watchedDate || !title || row.length !== headers.length) { skipped++; continue; }
    const releaseYear = releaseYearValue(field("Year"));
    entries.push({ source: "export", filmKey: filmIdentity(field("Letterboxd URI"), title, releaseYear), title, releaseYear,
      watchedDate, rating: ratingValue(field("Rating")), rewatch: rewatchValue(field("Rewatch")) });
  }
  if (!entries.length) throw new ImportError("no-dates", `Belum ada entri diary bertanggal yang bisa dibuat struk. ${skipped} baris dilewati. Gunakan diary.csv yang memiliki Watched Date valid.`);
  // CSV has no stable session ID: identical-looking sessions are deliberately retained.
  return { source: "export", entries, skipped, duplicates: 0 };
}

export function extractDiaryZip(bytes: Uint8Array): Uint8Array {
  if (bytes.length > MAX_FILE_BYTES) throw new ImportError("too-large", "File terlalu besar. Batas ZIP adalah 20 MB.");
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new ImportError("zip-corrupt", "File ZIP rusak atau tidak dapat dibaca.");
  const metadata = diaryZipMetadata(bytes, MAX_DIARY_BYTES);
  let result: Uint8Array | undefined;
  let matched = false;
  let failure: Error | undefined;
  const unzip = new Unzip(file => {
    if (!isDiaryPath(file.name)) return;
    if (matched) { failure = new ImportError("zip-ambiguous", "ZIP memiliki lebih dari satu diary.csv. Pilih diary.csv langsung."); return; }
    matched = true;
    if ((file.originalSize ?? 0) > MAX_DIARY_BYTES) { failure = new ImportError("too-large", "diary.csv dalam ZIP terlalu besar. Batasnya 10 MB."); return; }
    const chunks: Uint8Array[] = [];
    let size = 0;
    file.ondata = (error, data, final) => {
      if (error) { failure = error; return; }
      if (failure) return;
      size += data.length;
      if (size > MAX_DIARY_BYTES) {
        failure = new ImportError("too-large", "diary.csv dalam ZIP terlalu besar. Batasnya 10 MB.");
        file.terminate();
        return;
      }
      chunks.push(data);
      if (final) {
        result = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  try {
    // Small compressed chunks bound the output of each inflate step, even for ZIP bombs.
    for (let i = 0; i < bytes.length && !failure; i += 4096) {
      unzip.push(bytes.subarray(i, i + 4096), i + 4096 >= bytes.length);
    }
    if (failure) throw failure;
  } catch (error) {
    if (error instanceof ImportError) throw error;
    throw new ImportError("zip-corrupt", "File ZIP rusak atau tidak dapat dibaca. Pilih file lain.");
  }
  if (!matched) throw new ImportError("zip-missing", "Kami tidak menemukan diary.csv di file ini.");
  if (!result) throw new ImportError("zip-corrupt", "File ZIP tidak lengkap. Pilih file lain.");
  if (result.length !== metadata.size || crc32(result) !== metadata.crc) throw new ImportError("zip-corrupt", "Isi diary.csv dalam ZIP rusak. Pilih file lain.");
  return result;
}

export async function importExportFile(file: File): Promise<ImportResult> {
  const isZip = /\.zip$/i.test(file.name);
  if (!isZip && !/^diary\.csv$/i.test(file.name)) throw new ImportError("file-type", "Pilih ZIP ekspor Letterboxd atau file bernama diary.csv.");
  if (file.size > (isZip ? MAX_FILE_BYTES : MAX_DIARY_BYTES)) throw new ImportError("too-large", `File terlalu besar. Batas ${isZip ? "ZIP 20" : "CSV 10"} MB.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(isZip ? extractDiaryZip(bytes) : bytes); }
  catch (error) {
    if (error instanceof ImportError) throw error;
    throw new ImportError("file-corrupt", "File tidak dapat dibaca sebagai UTF-8. Pilih ekspor Letterboxd lain.");
  }
  return parseDiaryCsv(text);
}
