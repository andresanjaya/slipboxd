import { en } from "./en";
import { id } from "./id";
import type { Dictionary, Language } from "./types";

export const dictionaries: Record<Language, Dictionary> = { id, en };
export type { Dictionary, FaqItem, Language } from "./types";

export function isLanguage(value: unknown): value is Language {
  return value === "id" || value === "en";
}

export function formatCalendarDate(value: string, dictionary: Dictionary, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat(dictionary.locale, options).format(date);
}

export function formatMonth(value: string, dictionary: Dictionary) {
  return formatCalendarDate(`${value}-01`, dictionary, { month: "long", year: "numeric" });
}

export function formatNumber(value: number, dictionary: Dictionary, decimals = 0) {
  return new Intl.NumberFormat(dictionary.locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

export function formatRange(entries: { watchedDate: string }[], dictionary: Dictionary) {
  const dates = entries.map(entry => entry.watchedDate).sort();
  return dates.length ? `${formatCalendarDate(dates[0], dictionary)} — ${formatCalendarDate(dates[dates.length - 1], dictionary)}` : dictionary.receipt.noEntries;
}
