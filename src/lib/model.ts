export type WatchEntry = {
  source: "export" | "rss";
  filmKey: string;
  title: string;
  releaseYear?: number;
  watchedDate: string;
  rating?: number;
  rewatch?: boolean;
};

export type ImportResult = {
  source: WatchEntry["source"];
  entries: WatchEntry[];
  skipped: number;
  duplicates: number;
  username?: string;
};

export class ImportError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
    this.name = "ImportError";
  }
}

// Calendar dates remain strings throughout the app: no timezone conversions.
export function calendarDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return;
  const date = value.trim();
  const [year, month, day] = date.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]) return date;
}

export function ratingValue(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") return;
  if (String(value).trim() === "") return;
  const rating = Number(value);
  if (Number.isFinite(rating) && rating >= 0.5 && rating <= 5 && Number.isInteger(rating * 2)) return rating;
}

export function releaseYearValue(value: unknown): number | undefined {
  const year = Number(value);
  if (Number.isInteger(year) && year >= 1000 && year <= 9999) return year;
}

export function rewatchValue(value: unknown): boolean | undefined {
  if (typeof value !== "string") return;
  if (/^(yes|true)$/i.test(value.trim())) return true;
  if (/^(no|false)$/i.test(value.trim())) return false;
}

export function filmIdentity(uri: string, title: string, year?: number): string {
  try {
    const url = new URL(uri);
    const slug = url.pathname.match(/\/film\/([^/]+)/)?.[1];
    // Diary and film URLs identify the same film, including subsequent rewatches.
    if (url.hostname === "letterboxd.com" && slug) return `letterboxd:${slug}`;
  } catch { /* Missing URI: use the documented title/year fallback. */ }
  return `title:${JSON.stringify([title.trim().toLowerCase(), year ?? null])}`;
}

export type ReceiptSettings = {
  name: string;
  title: string;
  period: string;
  sort: "newest" | "oldest" | "rating";
  count: 10 | 20;
  valueType: "rating" | "minute";
  paper: "paper-bg-1" | "paper-bg-2" | "paper-bg-3" | "paper-bg-4";
};

export const defaultSettings: ReceiptSettings = {
  name: "", title: "My Movie Receipt", period: "all", sort: "newest",
  count: 10, valueType: "rating", paper: "paper-bg-2",
};

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function selectEntries(entries: WatchEntry[], settings: ReceiptSettings) {
  const inPeriod = entries.filter(e => settings.period === "all" || e.watchedDate.startsWith(settings.period));
  const ordered = [...inPeriod].sort((a, b) => {
    if (settings.sort === "rating") {
      const rating = (b.rating ?? -1) - (a.rating ?? -1);
      if (rating) return rating;
    }
    const date = compare(a.watchedDate, b.watchedDate) * (settings.sort === "oldest" ? 1 : -1);
    return date || compare(a.title, b.title) || compare(a.filmKey, b.filmKey);
  });
  return { rows: ordered.slice(0, settings.count), sessions: inPeriod.length, unique: new Set(inPeriod.map(e => e.filmKey)).size };
}

export function availablePeriods(entries: WatchEntry[]) {
  return {
    years: [...new Set(entries.map(e => e.watchedDate.slice(0, 4)))].sort().reverse(),
    months: [...new Set(entries.map(e => e.watchedDate.slice(0, 7)))].sort().reverse(),
  };
}

export function observedRange(entries: WatchEntry[]): string {
  const dates = entries.map(e => e.watchedDate).sort();
  return dates.length ? `${dates[0]} — ${dates[dates.length - 1]}` : "Tidak ada entri";
}

export function safeFilename(settings: ReceiptSettings) {
  const name = settings.name.normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "diary";
  const period = /^\d{4}(-\d{2})?$/.test(settings.period) ? settings.period : "semua";
  return `slipboxd-${name}-${period}.png`;
}
