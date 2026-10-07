"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLanguage } from "@/i18n/provider";
import { formatNumber } from "@/i18n";
import { useDiary } from "@/lib/diary-provider";
import { availableDiaryYears } from "@/lib/diary-insights";
import { buildCharts, chartEntries, type ChartPeriod } from "@/lib/charts";
import { genreLabel, tmdbCacheKey, type TmdbMovieMetadata, type TmdbMovieQuery } from "@/lib/tmdb";

function ChartCard({ id, title, description, children, className = "" }: { id: string; title: string; description: string; children: ReactNode; className?: string }) {
  return <section className={`chart-card ${className}`} aria-labelledby={id}>
    <header className="chart-card-header"><h2 id={id}>{title}</h2></header>
    <div className="chart-card-body"><p className="chart-card-description">{description}</p>{children}</div>
  </section>;
}

function BarList({ items }: { items: { key: string; label: string; count: number; displayCount: string; accessibleLabel: string }[] }) {
  const max = Math.max(1, ...items.map(item => item.count));
  return <ul className="chart-bar-list">{items.map(item => <li key={item.key} aria-label={item.accessibleLabel}>
    <span className="chart-bar-label">{item.label}</span>
    <span className="chart-bar-track" aria-hidden="true"><i style={{ width: `${item.count / max * 100}%` }}/></span>
    <strong>{item.displayCount}</strong>
  </li>)}</ul>;
}

export function ChartsView({ tmdbEnabled }: { tmdbEnabled: boolean }) {
  const { language, dictionary: t } = useLanguage();
  const { data, metadata, metadataCache, publishMetadata } = useDiary();
  const [period, setPeriod] = useState<ChartPeriod>("all");
  const [currentYear] = useState(() => new Date().getFullYear());
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const years = useMemo(() => availableDiaryYears(data?.entries ?? []), [data]);
  const selectedEntries = useMemo(() => chartEntries(data?.entries ?? [], period, currentYear), [data, period, currentYear]);
  const charts = useMemo(() => buildCharts(data?.entries ?? [], metadata, period, currentYear), [data, metadata, period, currentYear]);

  useEffect(() => {
    if (!tmdbEnabled || !selectedEntries.length) return;
    const unique = new Map<string, TmdbMovieQuery>();
    for (const entry of selectedEntries) {
      const key = tmdbCacheKey(entry.title, entry.releaseYear);
      unique.set(key, { key, title: entry.title, releaseYear: entry.releaseYear });
    }
    const missing = [...unique.values()].filter(movie => {
      const cached = metadataCache.current.get(movie.key);
      return !cached || (cached.status === "matched" && cached.directors === undefined);
    });
    if (!missing.length) { setLoadingMetadata(false); return; }
    const controller = new AbortController();
    setLoadingMetadata(true);
    void (async () => {
      try {
        for (let offset = 0; offset < missing.length; offset += 25) {
          const response = await fetch("/api/tmdb", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ movies: missing.slice(offset, offset + 25) }), signal: controller.signal,
          });
          if (!response.ok) throw new Error("TMDB enrichment unavailable");
          const payload = await response.json() as { results?: TmdbMovieMetadata[] };
          if (!controller.signal.aborted) publishMetadata(payload.results ?? []);
        }
      } catch { /* Cards show their available coverage and empty states. */ }
      finally { if (!controller.signal.aborted) setLoadingMetadata(false); }
    })();
    return () => controller.abort();
  }, [selectedEntries, tmdbEnabled, metadataCache, publishMetadata]);

  const monthLabel = (month: string) => {
    const [year, number] = month.split("-").map(Number);
    return new Intl.DateTimeFormat(t.locale, { month: "short", ...(["all", "weeks4", "months6"].includes(period) ? { year: "numeric" } : {}), timeZone: "UTC" })
      .format(new Date(Date.UTC(year, number - 1, 1)));
  };
  const number = (value: number) => formatNumber(value, t);
  const chartNote = (content: string) => <p className="chart-note">{content}</p>;

  return <main id="main" className="shell charts-page">
    <div className="charts-intro"><p className="eyebrow"><span className="dot"/> {t.charts.eyebrow}</p>
      <h1>{t.charts.title}</h1><p>{t.charts.description}</p></div>
    {!data ? <section className="charts-empty" role="status"><p>{t.charts.noDiary}</p><Link href="/" className="charts-create-link">{t.charts.createReceipt}</Link></section> : <>
      <section className="charts-period-card" aria-labelledby="charts-period-title">
        <header className="chart-card-header charts-period-header"><h2 id="charts-period-title">{t.charts.periodTitle}</h2><p className="charts-entry-count" role="status">{t.charts.entryCount(number(charts.entries))}</p></header>
        <div className="charts-period-body"><p>{t.charts.periodDescription}</p>
          <div className="charts-period-controls" role="group" aria-label={t.charts.periodTitle}>
            <button type="button" aria-pressed={period === "all"} onClick={() => setPeriod("all")}>{t.charts.allDiary}</button>
            <button type="button" aria-pressed={period === "weeks4"} onClick={() => setPeriod("weeks4")}>{t.charts.fourWeeks}</button>
            <button type="button" aria-pressed={period === "months6"} onClick={() => setPeriod("months6")}>{t.charts.sixMonths}</button>
            <button type="button" aria-pressed={period === "current"} onClick={() => setPeriod("current")}>{t.charts.thisYear}</button>
          <label className="charts-year-label" htmlFor="charts-year"><span>{t.charts.selectYear}</span><select id="charts-year" value={period.startsWith("year:") ? period.slice(5) : ""} onChange={event => setPeriod(event.target.value ? `year:${event.target.value}` : "all")}>
            <option value="">{t.charts.selectYear}</option>{years.map(year => <option key={year} value={year}>{year}</option>)}
          </select></label></div>
        </div>
      </section>
      {data.source === "rss" && <p className="charts-scope-note">{t.charts.rssNote}</p>}
      {charts.entries === 0 ? <section className="charts-empty" role="status"><p>{t.charts.noPeriod}</p></section> : <>
        {loadingMetadata && <p className="charts-metadata-status" role="status">{t.charts.loadingMetadata}</p>}
        {!tmdbEnabled && <p className="charts-metadata-status" role="status">{t.charts.metadataUnavailable}</p>}
        <div className="charts-grid">
          <ChartCard id="top-genres" title={t.charts.topGenres} description={t.charts.genresDescription}>
            {charts.topGenres.length ? <BarList items={charts.topGenres.map(genre => ({ key: String(genre.id), label: genreLabel(genre, language), count: genre.count, displayCount: number(genre.count), accessibleLabel: `${genreLabel(genre, language)}: ${number(genre.count)}` }))}/> : <p className="chart-empty">{t.charts.noGenres}</p>}
            {chartNote(t.charts.genreCoverage(number(charts.genreCoverage)))}
          </ChartCard>
          <ChartCard id="diary-activity" title={t.charts.diaryActivity} description={t.charts.activityDescription}>
            <div className="chart-activity-scroll"><BarList items={charts.activity.map(item => ({ key: item.month, label: monthLabel(item.month), count: item.count, displayCount: number(item.count), accessibleLabel: t.charts.activityValue(monthLabel(item.month), number(item.count)) }))}/></div>
          </ChartCard>
          <ChartCard id="release-decades" title={t.charts.releaseDecades} description={t.charts.decadesDescription}>
            {charts.decades.length ? <BarList items={charts.decades.map(item => ({ key: String(item.decade), label: t.charts.decadeLabel(item.decade), count: item.count, displayCount: number(item.count), accessibleLabel: `${t.charts.decadeLabel(item.decade)}: ${number(item.count)}` }))}/> : <p className="chart-empty">{t.charts.noDecades}</p>}
          </ChartCard>
          <ChartCard id="rating-distribution" title={t.charts.ratingDistribution} description={t.charts.ratingsDescription} className="chart-card-rating">
            {charts.ratedEntries ? <ul className="chart-rating-bars" aria-label={t.charts.ratingDistribution}>{charts.ratings.map(item => <li key={item.rating} aria-label={`${formatNumber(item.rating, t, 1)}: ${number(item.count)}`}>
              <strong>{number(item.count)}</strong><span className="chart-rating-track" aria-hidden="true"><i style={{ height: `${item.count / Math.max(1, ...charts.ratings.map(bucket => bucket.count)) * 100}%` }}/></span><span>{formatNumber(item.rating, t, 1)}</span>
            </li>)}</ul> : <p className="chart-empty">{t.charts.noRatings}</p>}
            {chartNote(t.charts.ratedEntries(number(charts.ratedEntries)))}
          </ChartCard>
          <ChartCard id="most-watched-directors" title={t.charts.mostWatchedDirectors} description={t.charts.directorsDescription}>
            {charts.topDirectors.length ? <ol className="chart-directors">{charts.topDirectors.map(director => <li key={director.id}><span>{director.name}</span><strong>{number(director.count)}</strong></li>)}</ol> : <p className="chart-empty">{t.charts.noDirectors}</p>}
            {chartNote(t.charts.directorCoverage(number(charts.directorCoverage)))}
          </ChartCard>
        </div>
      </>}
    </>}
  </main>;
}
