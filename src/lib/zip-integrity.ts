import { ImportError } from "./model";

const corrupt = () => new ImportError("zip-corrupt", "File ZIP rusak atau tidak lengkap. Pilih file lain.");
export const isDiaryPath = (name: string) => /(^|\/)diary\.csv$/i.test(name.replace(/\\/g, "/"));

// Validate the central directory before streaming. fflate deliberately does not
// verify CRCs; a truncated archive or altered CSV must not silently become a receipt.
export function diaryZipMetadata(bytes: Uint8Array, maxDiaryBytes: number) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0) throw corrupt();
  const count = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  let cursor = view.getUint32(end + 16, true);
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || count !== view.getUint16(end + 8, true) || count === 0xffff) {
    throw new ImportError("zip-unsupported", "ZIP multipart/ZIP64 tidak didukung. Pilih diary.csv langsung.");
  }
  if (cursor + directorySize !== end) throw corrupt();
  let diary: { crc: number; size: number } | undefined;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50) throw corrupt();
    const nameLength = view.getUint16(cursor + 28, true);
    const next = cursor + 46 + nameLength + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true);
    if (next > end) throw corrupt();
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (isDiaryPath(name)) {
      if (diary) throw new ImportError("zip-ambiguous", "ZIP memiliki lebih dari satu diary.csv. Pilih diary.csv langsung.");
      if (view.getUint16(cursor + 8, true) & 1) throw new ImportError("zip-encrypted", "ZIP memakai kata sandi. Pilih diary.csv langsung.");
      const size = view.getUint32(cursor + 24, true);
      if (size > maxDiaryBytes) throw new ImportError("too-large", "diary.csv dalam ZIP terlalu besar. Batasnya 10 MB.");
      diary = { size, crc: view.getUint32(cursor + 16, true) };
    }
    cursor = next;
  }
  if (cursor !== end) throw corrupt();
  if (!diary) throw new ImportError("zip-missing", "Kami tidak menemukan diary.csv di file ini.");
  return diary;
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
