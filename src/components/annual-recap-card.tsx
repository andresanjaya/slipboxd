"use client";

import { forwardRef, type Ref } from "react";
import { formatMonth, formatNumber, type Dictionary } from "@/i18n";
import type { AnnualRecapData } from "@/lib/diary-insights";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  data: AnnualRecapData;
  year: string;
  years: string[];
  source: "export" | "rss";
  backgroundUrl: string;
  dictionary: Dictionary;
  onYearChange: (year: string) => void;
  onExport: (share: boolean) => void;
  canShare: boolean;
  disabled: boolean;
  exporting: boolean;
  error: boolean;
};

export const AnnualRecapArtwork = forwardRef<SVGSVGElement, Pick<Props, "data" | "year" | "source" | "dictionary" | "backgroundUrl">>(function AnnualRecapArtwork(
  { data, year, source, dictionary, backgroundUrl },
  ref,
) {
  const t = dictionary.annualRecap;
  const top = Math.max(1, ...data.ratingDistribution.map(bucket => bucket.count));
  return <svg ref={ref} data-testid="annual-recap-artwork" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 690" width="440" height="690"
    role="img" aria-label={`${t.title} ${year}. ${t.uniqueFilms}: ${formatNumber(data.uniqueFilms, dictionary)}. ${t.sessions}: ${formatNumber(data.sessions, dictionary)}.`}>
    <title>{t.title} {year}</title>
    <desc>{[...data.topGenres.map(genre => genre.name), data.mostActiveMonth ? formatMonth(data.mostActiveMonth, dictionary) : ""].filter(Boolean).join(" · ")}</desc>
    <image data-receipt-asset data-receipt-background href={backgroundUrl} width="440" height="690" preserveAspectRatio="xMidYMid slice"/>
    <g fill="#34362e" fontFamily="'Merchant Copy', monospace" fontWeight="400">
      <text x="220" y="47" textAnchor="middle" fontSize="16" letterSpacing="3">{t.title.toLocaleUpperCase(dictionary.locale)}</text>
      <text x="220" y="91" textAnchor="middle" fontSize="38" letterSpacing="4">{year}</text>
      <path d="M35 116 H405" stroke="#98978a" strokeWidth="1.5" strokeDasharray="3 3"/>
      <text x="35" y="157" fontSize="16">{t.uniqueFilms.toLocaleUpperCase(dictionary.locale)}</text>
      <text x="405" y="157" textAnchor="end" fontSize="19">{formatNumber(data.uniqueFilms, dictionary)}</text>
      <text x="35" y="201" fontSize="16">{t.sessions.toLocaleUpperCase(dictionary.locale)}</text>
      <text x="405" y="201" textAnchor="end" fontSize="19">{formatNumber(data.sessions, dictionary)}</text>
      <text x="35" y="245" fontSize="16">{t.mostActiveMonth.toLocaleUpperCase(dictionary.locale)}</text>
      <text x="405" y="245" textAnchor="end" fontSize="15">{data.mostActiveMonth ? formatMonth(data.mostActiveMonth, dictionary).toLocaleUpperCase(dictionary.locale) : "—"}</text>
      <path d="M35 269 H405" stroke="#98978a" strokeWidth="1.5" strokeDasharray="3 3"/>
      <text x="35" y="306" fontSize="16">{t.topGenres.toLocaleUpperCase(dictionary.locale)}</text>
      {data.topGenres.length ? data.topGenres.map((genre, index) => <g key={genre.id}>
        <text x="35" y={342 + index * 32} fontSize="15">{genre.name.toLocaleUpperCase(dictionary.locale)}</text>
        <text x="405" y={342 + index * 32} textAnchor="end" fontSize="15">{formatNumber(genre.count, dictionary)}</text>
      </g>) : <text x="35" y="342" fontSize="14">{t.noGenreData}</text>}
      {source === "rss" && <text x="35" y="481" fontSize="10">{t.recentRss}</text>}
      <path d="M35 496 H405" stroke="#98978a" strokeWidth="1.5" strokeDasharray="3 3"/>
      <text x="35" y="529" fontSize="14">{t.ratingDistribution.toLocaleUpperCase(dictionary.locale)}</text>
      <text x="35" y="558" fontSize="13">{t.averageRating.toLocaleUpperCase(dictionary.locale)}</text>
      <text x="405" y="558" textAnchor="end" fontSize="16">{data.averageRating === undefined ? t.noRatings : formatNumber(data.averageRating, dictionary, 1)}</text>
      {data.ratingDistribution.map((bucket, index) => {
        const x = 39 + index * 40;
        const barHeight = bucket.count ? Math.max(2, 30 * bucket.count / top) : 0;
        return <g key={bucket.rating}>
          <rect x={x} y={608 - barHeight} width="20" height={barHeight} rx="2" fill="#2047c7"/>
          <text x={x + 10} y="628" textAnchor="middle" fontSize="9">{formatNumber(bucket.rating, dictionary, 1)}</text>
          <text x={x + 10} y="644" textAnchor="middle" fontSize="10">{formatNumber(bucket.count, dictionary)}</text>
        </g>;
      })}
      <text x="220" y="674" textAnchor="middle" fontSize="10">{t.ratedEntries(formatNumber(data.ratingsCount, dictionary))}</text>
    </g>
  </svg>;
});

export function AnnualRecapCard(props: Props & { artworkRef: Ref<SVGSVGElement> }) {
  const { data, year, years, source, backgroundUrl, dictionary, onYearChange, onExport, canShare, disabled, exporting, error, artworkRef } = props;
  const recap = dictionary.annualRecap;
  const profile = dictionary.viewingProfile;
  const empty = !year || data.sessions === 0;
  return <section className="annual-recap-card" aria-labelledby="annual-recap-title">
    <div className="annual-recap-heading"><h2 id="annual-recap-title">{recap.title}</h2><label htmlFor="recap-year">{recap.selectYear}<select id="recap-year" value={year} disabled={!years.length || disabled} onChange={event => onYearChange(event.target.value)}>
      {!years.length && <option value="">{recap.noYear}</option>}
      {years.map(value => <option key={value} value={value}>{value}</option>)}
    </select></label></div>
    {empty ? <div className="annual-recap-empty" role="status"><strong>{!year ? recap.noYear : recap.emptyTitle}</strong><p>{!year ? recap.noYearBody : recap.emptyBody(year)}</p></div> : <>
      <div className="annual-recap-canvas">
        <AnnualRecapArtwork ref={artworkRef} data={data} year={year} source={source} backgroundUrl={backgroundUrl} dictionary={dictionary}/>
      </div>
      <dl className="annual-recap-stats">
        <div><dt>{recap.uniqueFilms}</dt><dd>{formatNumber(data.uniqueFilms, dictionary)}</dd></div>
        <div><dt>{recap.sessions}</dt><dd>{formatNumber(data.sessions, dictionary)}</dd></div>
        <div><dt>{recap.mostActiveMonth}</dt><dd>{data.mostActiveMonth ? formatMonth(data.mostActiveMonth, dictionary) : recap.noMonth}</dd></div>
        <div><dt>{recap.averageRating}</dt><dd>{data.averageRating === undefined ? recap.noRatings : `${formatNumber(data.averageRating, dictionary, 1)} · ${recap.ratedEntries(formatNumber(data.ratingsCount, dictionary))}`}</dd></div>
      </dl>
      {data.topGenres.length ? <div className="annual-recap-genres"><h3>{recap.topGenres}</h3><ol>{data.topGenres.map(genre => <li key={genre.id}><span>{genre.name}</span><strong>{recap.genreFilms(formatNumber(genre.count, dictionary))}</strong></li>)}</ol></div> : <p className="annual-recap-note">{recap.noGenreData}</p>}
      <p className="annual-recap-note">{profile.genreCoverage(formatNumber(data.genresAvailable, dictionary), formatNumber(data.uniqueFilms, dictionary))}</p>
      {data.genresAvailable < data.uniqueFilms && <p className="annual-recap-note">{profile.incompleteMetadata}</p>}
      {source === "rss" && <p className="annual-recap-note">{profile.recentRss}</p>}
      <div className="annual-recap-actions">
        <Button className="primary" disabled={disabled || exporting} onClick={() => onExport(false)}><Download size={15} aria-hidden="true"/>{exporting ? recap.preparing : recap.download}</Button>
        {canShare && <Button variant="outline" disabled={disabled || exporting} onClick={() => onExport(true)}><Share2 size={15} aria-hidden="true"/>{recap.share}</Button>}
      </div>
      {error && <p className="annual-recap-error" role="alert">{recap.exportFailed}</p>}
    </>}
  </section>;
}
