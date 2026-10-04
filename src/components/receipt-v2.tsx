import { forwardRef } from "react";
import { RECEIPT_BACKGROUNDS } from "@/config/receipt-backgrounds";
import { formatNumber, type Dictionary } from "@/i18n";
import { selectEntries, type ReceiptSettings, type WatchEntry } from "@/lib/model";
import { metadataFor, type TmdbMovieMetadata } from "@/lib/tmdb";

export function wrapText(text: string, columns: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line) {
      if (word.length <= columns) line = word;
      else for (let offset = 0; offset < word.length; offset += columns) lines.push(word.slice(offset, offset + columns));
    } else if (`${line} ${word}`.length <= columns) line += ` ${word}`;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

type Props = {
  entries: WatchEntry[];
  settings: ReceiptSettings;
  source: "export" | "rss";
  dictionary: Dictionary;
  metadata?: ReadonlyMap<string, TmdbMovieMetadata>;
  printedAt?: Date;
  example?: boolean;
};

function periodHeading(settings: ReceiptSettings, rows: WatchEntry[], locale: string): string {
  if (/^\d{4}-\d{2}$/.test(settings.period)) {
    const [year, month] = settings.period.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(year, month - 1, 1))).toLocaleUpperCase(locale);
  }
  if (/^\d{4}$/.test(settings.period)) return settings.period;
  const latest = rows.map(row => row.watchedDate).sort().at(-1);
  if (!latest) return "SLIPBOXD";
  const [year, month] = latest.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1))).toLocaleUpperCase(locale);
}

function printedDate(value: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    .format(value).toLocaleUpperCase(locale);
}

export const Receipt = forwardRef<SVGSVGElement, Props>(function Receipt(
  { entries, settings, source, dictionary: t, metadata = new Map(), printedAt = new Date(), example },
  ref,
) {
  const { rows, sessions, unique } = selectEntries(entries, settings);
  const receiptTitle = settings.title || t.receipt.defaultTitle;
  const orderName = (settings.name || "GUEST").trim().toLocaleUpperCase(t.locale).slice(0, 18);
  const heading = periodHeading(settings, rows, t.locale);
  const showMinutes = settings.valueType === "minute";
  const totalRuntime = rows.reduce((sum, entry) => sum + (metadataFor(entry, metadata)?.runtime ?? 0), 0);
  const titleLineHeight = 19.33;
  const rowLayouts = rows.map(entry => {
    const lines = wrapText(entry.title.toLocaleUpperCase(t.locale), 40);
    return { entry, lines, height: 45 + (lines.length - 1) * titleLineHeight };
  });
  const listHeight = rowLayouts.reduce((sum, row) => sum + row.height, 0);
  const footerY = 269 + listHeight + (rows.length ? 9 : 34);
  const height = footerY + 210;
  let rowY = 269;
  const rated = rows.map(entry => entry.rating).filter((rating): rating is number => rating !== undefined);
  const averageRating = rated.length ? (rated.reduce((sum, rating) => sum + rating, 0) / rated.length).toFixed(1) : "—";
  const rowCount = formatNumber(rows.length, t);
  const sessionCount = formatNumber(sessions, t);
  const uniqueCount = formatNumber(unique, t);

  return <svg ref={ref} data-testid="receipt" xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 440 ${height}`} width="440" height={height}
    role="img" aria-label={`${example ? t.receipt.examplePrefix : ""}${t.receipt.aria(receiptTitle, rowCount, sessionCount, uniqueCount)}`}>
    <title>{receiptTitle}</title>
    <desc>{rows.map(entry => entry.title).join("; ")}</desc>
    <image data-receipt-asset data-receipt-background href={RECEIPT_BACKGROUNDS[settings.paper]} width="440" height={height} preserveAspectRatio="xMidYMid slice"/>
    <g fill="#34362e" fontFamily="'Merchant Copy', monospace" fontWeight="400">
      <image data-receipt-asset href="/assets/figma-letterboxd-logo.svg" x="151" y="30" width="138" height="65.5" preserveAspectRatio="xMidYMid meet"/>
      <text x="220" y="129" textAnchor="middle" fontSize="19.33" letterSpacing="6.9">{heading}</text>
      <path d="M35 149 H405" stroke="#98978a" strokeWidth="1.55" strokeDasharray="3 3"/>
      <text x="35" y="170" fontSize="16.67" letterSpacing="0.83">{t.receipt.orderFor(orderName)}</text>
      <text x="405" y="170" textAnchor="end" fontSize="16.67" letterSpacing="0.83">{t.receipt.register}</text>
      <text x="35" y="188" fontSize="16.67" letterSpacing="0.83">{printedDate(printedAt, t.locale)}</text>
      <text x="405" y="188" textAnchor="end" fontSize="16.67" letterSpacing="0.83">{t.receipt.cashier}</text>
      <path d="M35 208 H405" stroke="#98978a" strokeWidth="1.55" strokeDasharray="3 3"/>
      <text x="35" y="231" fontSize="19.33">#</text>
      <text x="71" y="231" fontSize="19.33">{t.receipt.movie}</text>
      <text x="405" y="231" textAnchor="end" fontSize="19.33">{showMinutes ? t.receipt.minutes : t.receipt.rating}</text>
      <path d="M35 243 H405" stroke="#98978a" strokeWidth="1.55" strokeDasharray="3 3"/>
      {rowLayouts.map(({ entry, lines, height: rowHeight }, index) => {
        const y = rowY;
        rowY += rowHeight;
        const runtime = metadataFor(entry, metadata)?.runtime;
        return <g key={`${entry.filmKey}:${entry.watchedDate}:${index}`}>
          <text x="35" y={y} fill="#717264" fontSize="14">{String(index + 1).padStart(2, "0")}</text>
          {lines.map((line, lineIndex) => <text key={lineIndex} x="71" y={y + lineIndex * titleLineHeight} fontSize="19.33">{line}</text>)}
          <text x="405" y={y} textAnchor="end" fontSize="14">{showMinutes ? (runtime ? String(runtime) : "—") : (entry.rating === undefined ? "—" : formatNumber(entry.rating, t, 1))}</text>
          <text x="71" y={y + (lines.length - 1) * titleLineHeight + 15.5} fill="#737367" fontSize="14">{entry.releaseYear ?? "—"}</text>
        </g>;
      })}
      {!rows.length && <text x="220" y="300" textAnchor="middle" fontSize="16">{t.receipt.noEntries}</text>}
      {(() => {
        return <g>
          <path d={`M35 ${footerY} H405`} stroke="#98978a" strokeWidth="1.55" strokeDasharray="3 3"/>
          <text x="35" y={footerY + 24} fontSize="19.33">{t.receipt.itemCount}:</text>
          <text x="405" y={footerY + 24} textAnchor="end" fontSize="19.33">{rowCount}</text>
          <text x="35" y={footerY + 47} fontSize="19.33">{showMinutes ? "TOTAL RUNTIME:" : "AVERAGE RATING:"}</text>
          <text x="405" y={footerY + 47} textAnchor="end" fontSize="19.33">{showMinutes ? (totalRuntime ? `${Math.floor(totalRuntime / 60)}h ${String(totalRuntime % 60).padStart(2, "0")}m` : "—") : (rated.length ? formatNumber(Number(averageRating), t, 1) : "—")}</text>
          <path d={`M35 ${footerY + 64} H405`} stroke="#98978a" strokeWidth="1.55" strokeDasharray="3 3"/>
          <text x="220" y={footerY + 93} textAnchor="middle" fontSize="16.64" letterSpacing="1">{t.receipt.thankYou}</text>
          <text x="220" y={footerY + 107} textAnchor="middle" fontSize="14">{t.receipt.seeYou}</text>
          <image data-receipt-asset href="/assets/figma-barcode.svg" x="45" y={footerY + 121} width="350" height="42.17" preserveAspectRatio="none"/>
          <text x="220" y={footerY + 183} textAnchor="middle" fontSize="16.64" letterSpacing="1.1">slipboxd.vercel.app</text>
        </g>;
      })()}
    </g>
  </svg>;
});
