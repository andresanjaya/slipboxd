import { forwardRef } from "react";
import { observedRange, selectEntries, type ReceiptSettings, type WatchEntry } from "@/lib/model";

// Conservative monospace wrapping, including long unbroken titles and wide glyphs.
export function wrapText(text: string, columns: number): string[] {
  const lines: string[] = [];
  let line = "";
  let width = 0;
  for (const char of text.replace(/\s+/g, " ").trim()) {
    const units = (char.codePointAt(0) ?? 0) > 0x2e7f ? 2 : 1;
    if (width + units > columns) { lines.push(line.trimEnd()); line = ""; width = 0; }
    if (!line && char === " ") continue;
    line += char;
    width += units;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

type Props = { entries: WatchEntry[]; settings: ReceiptSettings; source: "export" | "rss"; example?: boolean };

export const Receipt = forwardRef<SVGSVGElement, Props>(function Receipt({ entries, settings, source, example }, ref) {
  const { rows, sessions, unique } = selectEntries(entries, settings);
  const ticket = settings.template === "ticket";
  const paper = settings.paper === "cream" ? "#fff5df" : "#ffffff";
  const titleLines = wrapText(settings.title || "My Movie Receipt", 25);
  const nameLines = settings.name ? wrapText(settings.name, 36) : [];
  const titleY = ticket ? 112 : 100;
  const metaY = titleY + titleLines.length * 23 + nameLines.length * 17 + 12;
  let cursor = metaY + 88;
  const layouts = rows.map(entry => {
    const lines = wrapText(entry.title, 31);
    const y = cursor;
    cursor += lines.length * 19 + 39;
    return { entry, lines, y };
  });
  if (!rows.length) cursor += 38;
  const footerY = cursor + 4;
  const height = footerY + (source === "rss" ? 206 : 186);
  return (
    <svg ref={ref} data-testid="receipt" xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 440 ${height}`} width="440" height={height}
      role="img" aria-label={`${example ? "Contoh fiktif. " : ""}${settings.title || "My Movie Receipt"}. ${rows.length} baris, ${sessions} sesi tersedia dalam periode, ${unique} film unik.`}>
      <title>{settings.title || "My Movie Receipt"}</title>
      <desc>{rows.map(e => `${e.title}, ${e.watchedDate}, rating ${e.rating ?? "kosong"}${e.rewatch ? ", tonton ulang" : ""}`).join("; ")}</desc>
      <rect width="440" height={height} fill={paper}/>
      <g fill="#24251f" fontFamily="'Courier New', Courier, monospace" fontSize="13">
        {ticket ? <>
          <rect x="16" y="16" width="408" height="62" rx="2" fill="#24251f"/>
          <text x="220" y="44" textAnchor="middle" fill={paper} fontSize="23" fontWeight="bold" letterSpacing="4">SLIPBOXD</text>
          <text x="220" y="64" textAnchor="middle" fill={paper} fontSize="10" letterSpacing="3">CINEMA TICKET / ADMIT ONE</text>
          <path d={`M16 88 V${height - 16} M424 88 V${height - 16}`} stroke="#24251f" strokeWidth="1" strokeDasharray="3 5"/>
        </> : <>
          <text x="220" y="44" textAnchor="middle" fontSize="29" fontWeight="bold" letterSpacing="-1">slipboxd.</text>
          <text x="220" y="65" textAnchor="middle" fontSize="10" letterSpacing="3">YOUR FILMS. YOUR RECEIPT.</text>
        </>}
        {titleLines.map((line, i) => <text key={i} x="220" y={titleY + i * 23} textAnchor="middle" fontSize="19" fontWeight="bold">{line}</text>)}
        {nameLines.map((line, i) => <text key={i} x="220" y={titleY + titleLines.length * 23 + i * 17} textAnchor="middle">{line}</text>)}
        <text x="220" y={metaY} textAnchor="middle" fontSize="11">{settings.period === "all" ? "SEMUA DATA TERSEDIA" : `PERIODE ${settings.period}`}</text>
        <text x="220" y={metaY + 19} textAnchor="middle" fontSize="10">{observedRange(entries.filter(e => settings.period === "all" || e.watchedDate.startsWith(settings.period)))}</text>
        <path d={`M32 ${metaY + 34} H408`} stroke="#24251f" strokeDasharray="4 4"/>
        <text x="32" y={metaY + 56} fontSize="10">NO.</text>
        <text x="67" y={metaY + 56} fontSize="10">FILM / TANGGAL TONTON</text>
        <text x="408" y={metaY + 56} fontSize="10" textAnchor="end">RATING</text>
        {layouts.map(({ entry, lines, y }, index) => <g key={index}>
          <text x="32" y={y} fontSize="11">{String(index + 1).padStart(2, "0")}</text>
          {lines.map((line, i) => <text key={i} x="67" y={y + i * 19} fontSize="13" fontWeight="bold">{line}</text>)}
          <text x="408" y={y} textAnchor="end">{entry.rating === undefined ? "—" : `${entry.rating.toFixed(1)}`}</text>
          <text x="67" y={y + lines.length * 19} fontSize="10">{entry.releaseYear ?? "—"} · {entry.watchedDate}{entry.rewatch ? " · REWATCH" : ""}</text>
        </g>)}
        {!rows.length && <text x="220" y={metaY + 88} textAnchor="middle" fontSize="11">Tidak ada entri dalam periode ini.</text>}
        <path d={`M32 ${footerY} H408`} stroke="#24251f" strokeDasharray="4 4"/>
        {[["Sesi tersedia dalam periode", sessions], ["Film unik dalam periode", unique], ["Baris yang ditampilkan", rows.length]].map(([label, value], i) => <g key={label}>
          <text x="32" y={footerY + 25 + i * 22} fontSize="11">{label}</text>
          <text x="408" y={footerY + 25 + i * 22} textAnchor="end" fontWeight="bold">{value}</text>
        </g>)}
        {source === "rss" && <>
          <text x="220" y={footerY + 97} textAnchor="middle" fontSize="10">Diambil dari aktivitas publik terbaru</text>
          <text x="220" y={footerY + 113} textAnchor="middle" fontSize="10">berdasarkan entri yang tersedia</text>
        </>}
        <text x="220" y={height - 63} textAnchor="middle" fontSize="10">{example ? "CONTOH · DATA FIKTIF" : source === "export" ? "DARI DIARY YANG DIUNGGAH" : "RSS PUBLIK · BUKAN TOTAL AKUN"}</text>
        <g fill="#24251f">{Array.from({ length: 46 }, (_, i) => <rect key={i} x={115 + i * 4.6} y={height - 48} width={i % 3 === 0 ? 3 : 1.5} height={19}/>)}</g>
        <text x="220" y={height - 13} textAnchor="middle" fontSize="8" letterSpacing="2">KEEP THE MEMORY. ROLL THE CREDITS.</text>
      </g>
    </svg>
  );
});
