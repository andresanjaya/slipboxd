import { forwardRef } from "react";
import { selectEntries, type ReceiptSettings, type WatchEntry } from "@/lib/model";
import { formatCalendarDate, formatMonth, formatNumber, formatRange, type Dictionary } from "@/i18n";
import { ACTIVE_RECEIPT_BACKGROUND } from "@/config/receipt-backgrounds";

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

type Props = { entries: WatchEntry[]; settings: ReceiptSettings; source: "export" | "rss"; dictionary: Dictionary; example?: boolean };

export const Receipt = forwardRef<SVGSVGElement, Props>(function Receipt({ entries, settings, source, dictionary: t, example }, ref) {
  const { rows, sessions, unique } = selectEntries(entries, settings);
  const ticket = false;
  const paper = "#ffffff";
  const receiptTitle = settings.title || t.receipt.defaultTitle;
  const titleLines = wrapText(receiptTitle, 25);
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
  const periodEntries = entries.filter(entry => settings.period === "all" || entry.watchedDate.startsWith(settings.period));
  const periodLabel = settings.period === "all" ? t.receipt.allData : t.receipt.period(settings.period.length === 7 ? formatMonth(settings.period, t) : settings.period);
  const rowCount = formatNumber(rows.length, t);
  const sessionCount = formatNumber(sessions, t);
  const uniqueCount = formatNumber(unique, t);
  return (
    <svg ref={ref} data-testid="receipt" xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 440 ${height}`} width="440" height={height}
      role="img" aria-label={`${example ? t.receipt.examplePrefix : ""}${t.receipt.aria(receiptTitle, rowCount, sessionCount, uniqueCount)}`}>
      <title>{receiptTitle}</title>
      <desc>{rows.map(entry => `${entry.title}, ${formatCalendarDate(entry.watchedDate, t)}, ${t.receipt.descriptionRating} ${entry.rating === undefined ? t.receipt.descriptionMissing : formatNumber(entry.rating, t, 1)}${entry.rewatch ? `, ${t.receipt.descriptionRewatch}` : ""}`).join("; ")}</desc>
      <rect width="440" height={height} fill={paper}/>
      <image data-receipt-background href={ACTIVE_RECEIPT_BACKGROUND} width="440" height={height} preserveAspectRatio="xMidYMid slice"/>
      <rect width="440" height={height} fill={paper} fillOpacity=".78"/>
      <g fill="#24251f" fontFamily="'Merchant Copy', monospace" fontSize="13">
        {ticket ? <>
          <rect x="16" y="16" width="408" height="62" rx="2" fill="#24251f"/>
          <text x="220" y="44" textAnchor="middle" fill={paper} fontSize="23" fontWeight="bold" letterSpacing="4">SLIPBOXD</text>
          <text x="220" y="64" textAnchor="middle" fill={paper} fontSize="10" letterSpacing="3">{t.receipt.ticketTagline}</text>
          <path d={`M16 88 V${height - 16} M424 88 V${height - 16}`} stroke="#24251f" strokeWidth="1" strokeDasharray="3 5"/>
        </> : <>
          <text x="220" y="44" textAnchor="middle" fontSize="29" fontWeight="bold" letterSpacing="-1">slipboxd.</text>
          <text x="220" y="65" textAnchor="middle" fontSize="10" letterSpacing="3">{t.receipt.tagline}</text>
        </>}
        {titleLines.map((line, i) => <text key={i} x="220" y={titleY + i * 23} textAnchor="middle" fontSize="19" fontWeight="bold">{line}</text>)}
        {nameLines.map((line, i) => <text key={i} x="220" y={titleY + titleLines.length * 23 + i * 17} textAnchor="middle">{line}</text>)}
        <text x="220" y={metaY} textAnchor="middle" fontSize="11">{periodLabel.toUpperCase()}</text>
        <text x="220" y={metaY + 19} textAnchor="middle" fontSize="10">{formatRange(periodEntries, t)}</text>
        <path d={`M32 ${metaY + 34} H408`} stroke="#24251f" strokeDasharray="4 4"/>
        <text x="32" y={metaY + 56} fontSize="10">{t.receipt.number}</text>
        <text x="67" y={metaY + 56} fontSize="10">{t.receipt.filmDate}</text>
        <text x="408" y={metaY + 56} fontSize="10" textAnchor="end">{t.receipt.rating}</text>
        {layouts.map(({ entry, lines, y }, index) => <g key={index}>
          <text x="32" y={y} fontSize="11">{formatNumber(index + 1, t).padStart(2, "0")}</text>
          {lines.map((line, i) => <text key={i} x="67" y={y + i * 19} fontSize="13" fontWeight="bold">{line}</text>)}
          <text x="408" y={y} textAnchor="end">{entry.rating === undefined ? "—" : formatNumber(entry.rating, t, 1)}</text>
          <text x="67" y={y + lines.length * 19} fontSize="10">{entry.releaseYear ? formatNumber(entry.releaseYear, t) : "—"} · {formatCalendarDate(entry.watchedDate, t)}{entry.rewatch ? ` · ${t.receipt.rewatch}` : ""}</text>
        </g>)}
        {!rows.length && <text x="220" y={metaY + 88} textAnchor="middle" fontSize="11">{t.receipt.noEntries}</text>}
        <path d={`M32 ${footerY} H408`} stroke="#24251f" strokeDasharray="4 4"/>
        {[[t.receipt.sessions, sessionCount], [t.receipt.unique, uniqueCount], [t.receipt.displayed, rowCount]].map(([label, value], i) => <g key={label}>
          <text x="32" y={footerY + 25 + i * 22} fontSize="11">{label}</text>
          <text x="408" y={footerY + 25 + i * 22} textAnchor="end" fontWeight="bold">{value}</text>
        </g>)}
        {source === "rss" && <>
          <text x="220" y={footerY + 97} textAnchor="middle" fontSize="10">{t.receipt.rssLatest}</text>
          <text x="220" y={footerY + 113} textAnchor="middle" fontSize="10">{t.receipt.rssBasis}</text>
        </>}
        <text x="220" y={height - 63} textAnchor="middle" fontSize="10">{example ? t.receipt.example : source === "export" ? t.receipt.exportSource : t.receipt.rssSource}</text>
        <g fill="#24251f">{Array.from({ length: 46 }, (_, i) => <rect key={i} x={115 + i * 4.6} y={height - 48} width={i % 3 === 0 ? 3 : 1.5} height={19}/>)}</g>
        <text x="220" y={height - 13} textAnchor="middle" fontSize="8" letterSpacing="2">{t.receipt.signoff}</text>
      </g>
    </svg>
  );
});
