"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { availablePeriods, defaultSettings, safeFilename, selectEntries, type ImportResult, type ReceiptSettings, type WatchEntry } from "@/lib/model";
import { useDiary } from "@/lib/diary-provider";
import { formatMonth, formatNumber, formatRange, dictionaries, type Language } from "@/i18n";
import { useLanguage } from "@/i18n/provider";
import { Receipt } from "./receipt-v2";
import { prepareReceiptAssets, receiptPng, savePng } from "@/lib/download";
import { genreLabel, tmdbCacheKey, type TmdbMovieMetadata, type TmdbMovieQuery } from "@/lib/tmdb";
import { availableDiaryYears, buildAnnualRecap, buildViewingProfile } from "@/lib/diary-insights";
import { RECEIPT_BACKGROUNDS, type ReceiptBackgroundId } from "@/config/receipt-backgrounds";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AnnualRecapCard } from "./annual-recap-card";
import { ArrowUpRight, CloudUpload, Download, Share2, UserRound } from "lucide-react";

const exampleFilms = [
  ["Oppenheimer", 2023, 180],
  ["Good Will Hunting", 1997, 126],
  ["Eternal Sunshine of the Spotless Mind", 2004, 108],
  ["Forrest Gump", 1994, 142],
  ["Interstellar", 2014, 169],
  ["Falling in Love Like in Movies", 2023, 118],
] as const;
const exampleEntries: WatchEntry[] = exampleFilms.map(([title, releaseYear], index) => ({
  source: "export", filmKey: `example:${index}`, title, releaseYear,
  watchedDate: `2026-09-${String(30 - index).padStart(2, "0")}`,
}));
const exampleMetadata = new Map<string, TmdbMovieMetadata>(exampleFilms.map(([title, releaseYear, runtime]) => [
  tmdbCacheKey(title, releaseYear),
  { key: tmdbCacheKey(title, releaseYear), title, releaseYear, runtime, genres: [], status: "matched" },
]));

type AppError = { mode: "file" | "rss"; code: string };
type Notice = "shared" | "share-fallback" | "downloaded" | null;

export function SlipboxdApp({ rssEnabled, tmdbEnabled }: { rssEnabled: boolean; tmdbEnabled: boolean }) {
  const { language, dictionary: t } = useLanguage();
  const { data, metadata, metadataCache, setDiary, clearDiary, publishMetadata } = useDiary();
  const [settings, setSettings] = useState<ReceiptSettings>({ ...defaultSettings, title: dictionaries.en.receipt.defaultTitle });
  const [username, setUsername] = useState("");
  const [sourceTab, setSourceTab] = useState<"file" | "rss">("file");
  const [loading, setLoading] = useState<"file" | "rss" | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [exporting, setExporting] = useState(false);
  const [recapYear, setRecapYear] = useState(() => availableDiaryYears(data?.entries ?? [])[0] ?? "");
  const [exportError, setExportError] = useState(false);
  const [recapExportError, setRecapExportError] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [canShare, setCanShare] = useState(false);
  const [receiptAssetsReady, setReceiptAssetsReady] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [printedAt, setPrintedAt] = useState(() => new Date());
  const fileInput = useRef<HTMLInputElement>(null);
  const receipt = useRef<SVGSVGElement>(null);
  const annualArtwork = useRef<SVGSVGElement>(null);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const sourceHeading = useRef<HTMLHeadingElement>(null);
  const cancelReset = useRef<HTMLButtonElement>(null);
  const switchButton = useRef<HTMLButtonElement>(null);
  const request = useRef<AbortController | null>(null);
  const enrichmentRequest = useRef<AbortController | null>(null);
  const previousLanguage = useRef<Language>("en");

  useEffect(() => {
    setCanShare(typeof navigator.share === "function" && typeof navigator.canShare === "function");
    return () => { request.current?.abort(); enrichmentRequest.current?.abort(); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setReceiptAssetsReady(false);
    void prepareReceiptAssets(RECEIPT_BACKGROUNDS[settings.paper]).then(() => { if (!cancelled) setReceiptAssetsReady(true); }).catch(() => { if (!cancelled) setExportError(true); });
    return () => { cancelled = true; };
  }, [settings.paper]);
  useEffect(() => { if (data) editorHeading.current?.focus(); }, [data]);
  useEffect(() => { if (confirmReset) cancelReset.current?.focus(); }, [confirmReset]);
  useEffect(() => {
    const previousDefault = dictionaries[previousLanguage.current].receipt.defaultTitle;
    setSettings(current => current.title === previousDefault ? { ...current, title: t.receipt.defaultTitle } : current);
    previousLanguage.current = language;
  }, [language, t.receipt.defaultTitle]);

  useEffect(() => {
    if (!data || !tmdbEnabled) return;
    enrichmentRequest.current?.abort();
    const controller = new AbortController();
    enrichmentRequest.current = controller;
    const periodEntries = data.entries.filter(entry => settings.period === "all" || entry.watchedDate.startsWith(settings.period));
    const recapEntries = recapYear ? data.entries.filter(entry => entry.watchedDate.startsWith(`${recapYear}-`)) : [];
    const unique = new Map<string, TmdbMovieQuery>();
    for (const entry of [...periodEntries, ...recapEntries]) {
      const key = tmdbCacheKey(entry.title, entry.releaseYear);
      unique.set(key, { key, title: entry.title, releaseYear: entry.releaseYear });
    }
    const missing = [...unique.values()].filter(movie => !metadataCache.current.has(movie.key));
    const publish = () => publishMetadata();
    if (!missing.length) { publish(); setEnriching(false); return; }
    setEnriching(true);
    void (async () => {
      try {
        for (let offset = 0; offset < missing.length; offset += 25) {
          const response = await fetch("/api/tmdb", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ movies: missing.slice(offset, offset + 25) }),
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("TMDB enrichment unavailable");
          const payload = await response.json() as { results?: TmdbMovieMetadata[] };
          publishMetadata(payload.results ?? []);
        }
      } catch {
        if (!controller.signal.aborted) publish();
      } finally {
        if (!controller.signal.aborted) setEnriching(false);
      }
    })();
    return () => controller.abort();
  }, [data, settings.period, recapYear, tmdbEnabled, metadataCache, publishMetadata]);

  function accept(result: ImportResult) {
    enrichmentRequest.current?.abort();
    setDiary(result);
    setRecapYear(availableDiaryYears(result.entries)[0] ?? "");
    setSettings({ ...defaultSettings, title: t.receipt.defaultTitle, name: result.username ?? "" });
    setError(null); setNotice(null);
  }

  async function upload(file: File) {
    if (!/^diary\.csv$/i.test(file.name)) {
      setError({ mode: "file", code: "file-type" });
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setLoading("file"); setError(null);
    try {
      const { importExportFile } = await import("@/lib/import-export");
      accept(await importExportFile(file));
    } catch (caught) {
      const code = typeof caught === "object" && caught && "code" in caught && typeof caught.code === "string" ? caught.code : "unknown";
      setError({ mode: "file", code });
    } finally {
      setLoading(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function loadRss(event: FormEvent) {
    event.preventDefault(); setError(null);
    if (!/^[a-z0-9][a-z0-9_-]{0,39}$/i.test(username.trim())) { setError({ mode: "rss", code: "username-invalid" }); return; }
    setLoading("rss");
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`/api/rss?username=${encodeURIComponent(username.trim())}`, { signal: controller.signal });
      const result = await response.json();
      if (!response.ok) {
        const statusCode = response.status === 504 ? "rss-timeout" : response.status === 404 ? "rss-not-found" : response.status === 503 ? "rss-disabled" : "rss-network";
        setError({ mode: "rss", code: typeof result.code === "string" ? result.code : statusCode });
        return;
      }
      accept(result as ImportResult);
    } catch { setError({ mode: "rss", code: controller.signal.aborted ? "rss-timeout" : "rss-network" }); }
    finally { clearTimeout(timeout); request.current = null; setLoading(null); }
  }

  function change<K extends keyof ReceiptSettings>(key: K, value: ReceiptSettings[K]) {
    setSettings(previous => ({ ...previous, [key]: value })); setNotice(null);
  }

  function resetSource() {
    request.current?.abort();
    enrichmentRequest.current?.abort();
    clearDiary(); setEnriching(false);
    setSettings({ ...defaultSettings, title: t.receipt.defaultTitle }); setUsername(""); setError(null); setRecapYear("");
    setExportError(false); setRecapExportError(false); setNotice(null); setConfirmReset(false);
    setTimeout(() => sourceHeading.current?.focus(), 0);
  }

  async function download(share = false) {
    if (!receipt.current) return;
    setExporting(true); setExportError(false); setNotice(null);
    try {
      setPrintedAt(new Date());
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const blob = await receiptPng(receipt.current);
      const filename = safeFilename(settings);
      const file = new File([blob], filename, { type: "image/png" });
      if (share && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: settings.title || t.receipt.defaultTitle }); setNotice("shared"); }
        catch (caught) {
          if (caught instanceof Error && caught.name === "AbortError") return;
          savePng(blob, filename); setNotice("share-fallback");
        }
      } else { savePng(blob, filename); setNotice("downloaded"); }
    } catch { setExportError(true); }
    finally { setExporting(false); }
  }

  async function downloadAnnualRecap(share = false) {
    if (!annualArtwork.current || !recapYear) return;
    setExporting(true); setRecapExportError(false); setNotice(null);
    try {
      const blob = await receiptPng(annualArtwork.current);
      const filename = `slipboxd-annual-recap-${recapYear}.png`;
      const file = new File([blob], filename, { type: "image/png" });
      if (share && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: `${t.annualRecap.title} ${recapYear}` }); setNotice("shared"); }
        catch (caught) {
          if (caught instanceof Error && caught.name === "AbortError") return;
          savePng(blob, filename); setNotice("share-fallback");
        }
      } else { savePng(blob, filename); setNotice("downloaded"); }
    } catch { setRecapExportError(true); }
    finally { setExporting(false); }
  }

  const periods = data ? availablePeriods(data.entries) : null;
  const selected = data ? selectEntries(data.entries, settings) : null;
  const selectedPeriodEntries = useMemo(() => data?.entries.filter(entry => settings.period === "all" || entry.watchedDate.startsWith(settings.period)) ?? [], [data, settings.period]);
  const profile = useMemo(() => buildViewingProfile(selectedPeriodEntries, metadata), [selectedPeriodEntries, metadata]);
  const recapYears = useMemo(() => availableDiaryYears(data?.entries ?? []), [data]);
  const annualRecap = useMemo(() => buildAnnualRecap(data?.entries ?? [], metadata, recapYear), [data, metadata, recapYear]);
  const matchedCount = profile.genresAvailable;
  const failedCount = profile.uniqueFilms - profile.genresAvailable;
  const maxGenreCount = Math.max(1, ...profile.topGenres.map(genre => genre.count));
  const maxRatingCount = Math.max(1, ...profile.ratingDistribution.map(bucket => bucket.count));
  const rated = data?.entries.some(entry => entry.rating !== undefined);
  const errorMessage = error ? error.code === "username-invalid" ? t.usernameInvalid : t.errors[error.code] ?? (error.mode === "file" ? t.errorFallback : t.rssFallback) : "";
  const noticeMessage = notice === "shared" ? t.editor.shared : notice === "share-fallback" ? t.editor.shareFallback : notice === "downloaded" ? t.editor.downloaded : "";
  const exportBlocked = !receiptAssetsReady || exporting || (settings.valueType === "minute" && enriching) || !selected?.rows.length;

  return <main id="main" className="shell">
    {!data ? <>
      <section className="intro"><p className="eyebrow"><span className="dot"/> {t.landing.eyebrow}</p><h1>{t.landing.introFirst}</h1><p className="intro-copy">{t.landing.introSecond}</p></section>
      <section className="landing-grid" aria-labelledby="source-heading">
        <div className="landing-primary"><div className="source-area"><div className="section-heading"><span className="step">01</span><h2 id="source-heading" ref={sourceHeading} tabIndex={-1}>{t.landing.start}</h2></div>
          <p className="muted">{t.landing.startNote}</p>
          <div className="source-tabs" role="tablist" aria-label={language === "en" ? "Choose data source" : "Pilih sumber data"}><Button variant="ghost" type="button" role="tab" aria-selected={sourceTab === "file"} onClick={() => setSourceTab("file")}><CloudUpload aria-hidden="true" size={14}/>{t.landing.uploadTab}</Button><Button variant="ghost" type="button" role="tab" aria-selected={sourceTab === "rss"} onClick={() => setSourceTab("rss")}><UserRound aria-hidden="true" size={14}/>Letterboxd username</Button></div>
          <div className="source-cards">
            <section className="source-card" aria-labelledby="upload-title" hidden={sourceTab !== "file"} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void upload(file); }}><div className="card-icon" aria-hidden="true"><CloudUpload size={34} strokeWidth={2.3}/></div><h3 id="upload-title">{t.landing.uploadTitle}</h3><p>{t.landing.uploadBody}</p>
              <p className="source-scope">{t.landing.uploadScope}</p>
              <a className="text-link" href="https://letterboxd.com/user/exportdata/" target="_blank" rel="noopener noreferrer">{t.landing.exportLink.replace(/\s*↗$/, "")} <ArrowUpRight size={13} aria-hidden="true"/></a>
              <Button type="button" className="file-label" disabled={!!loading} onClick={() => fileInput.current?.click()}>{t.landing.chooseFile}</Button>
              <input ref={fileInput} id="diary-file" type="file" accept=".csv,text/csv" disabled={!!loading} aria-label={t.landing.chooseFile} aria-describedby={error?.mode === "file" ? "file-error file-help" : "file-help"} aria-invalid={error?.mode === "file"} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }}/>
              <p id="file-help" className="small muted">{t.landing.fileHelp}</p>
              {error?.mode === "file" && <div id="file-error" className="error" role="alert"><p>{errorMessage}</p><Button variant="link" className="text-button" onClick={() => fileInput.current?.click()}>{t.landing.chooseAnother}</Button></div>}
            </section>
            <section className="source-card" aria-labelledby="rss-title" hidden={sourceTab !== "rss"}><div className="card-icon" aria-hidden="true">@</div><h3 id="rss-title">{t.landing.usernameTitle}</h3><p>{t.landing.usernameBody}</p>
              <p className="source-scope">{t.landing.usernameScope}</p>
              {rssEnabled ? <form onSubmit={loadRss} noValidate><Field><FieldLabel htmlFor="username">{t.landing.usernameLabel}</FieldLabel><Input id="username" className="username-input" value={username} onChange={event => setUsername(event.target.value)} placeholder={t.landing.usernamePlaceholder} autoCapitalize="none" spellCheck={false} autoComplete="off" maxLength={40} disabled={!!loading} aria-invalid={error?.mode === "rss"} aria-describedby={error?.mode === "rss" ? "rss-error" : undefined}/></Field>
                <Button className="primary" type="submit" disabled={!!loading}>{loading === "rss" ? t.landing.loadingRss : error?.mode === "rss" ? t.landing.retry : t.landing.load}<ArrowUpRight size={16} aria-hidden="true"/></Button>
              </form> : <p className="notice">{t.landing.rssDisabled}</p>}
              {error?.mode === "rss" && <div id="rss-error" className="error" role="alert"><p>{errorMessage}</p><Button variant="link" className="text-button" onClick={() => { fileInput.current?.focus(); fileInput.current?.click(); }}>{t.landing.uploadInstead}</Button></div>}
            </section>
          </div>
          <p role="status" aria-live="polite" className="status">{loading === "file" ? t.landing.readingFile : loading === "rss" ? t.landing.loadingRss : t.landing.privacyStatus}</p>
        </div>
          <section className="journey-steps" aria-labelledby="journey-title"><div className="journey-heading"><h2 id="journey-title">{t.landing.journeyTitle}</h2><p>{t.landing.journeySubtitle}</p></div><div className="journey-cards">{t.landing.journeySteps.map((step, index) => <article key={step.title}><h3>{index + 1}. {step.title}</h3><p>{step.body}</p></article>)}</div></section>
        </div>
        <aside className="example-stage" aria-label={t.landing.exampleAria}><span className="stage-label">{t.landing.previewLabel} <span>PNG</span></span><div className={`example-receipt ${receiptAssetsReady ? "" : "receipt-loading"}`}>{receiptAssetsReady && <Receipt entries={exampleEntries} settings={{ ...defaultSettings, name: "SKINNYDOOKIE", valueType: "minute" }} source="export" dictionary={t} metadata={exampleMetadata} printedAt={new Date("2026-09-30T12:00:00Z")} example/>}</div><p className="example-label">{t.landing.previewCaption}</p></aside>
      </section>
    </> : <section className="editor" aria-labelledby="editor-heading">
      <div className="editor-top"><div><p className="eyebrow"><span className="dot"/> {t.editor.eyebrow}</p><h1 id="editor-heading" ref={editorHeading} tabIndex={-1}>{t.editor.heading}</h1><p className="editor-intro">{t.editor.intro}</p></div><button ref={switchButton} className="secondary" disabled={exporting} onClick={() => setConfirmReset(true)}>{t.editor.switchSource}</button></div>
      <div className="import-summary" role="status"><strong>{data.source === "rss" ? t.editor.rssSource : t.editor.exportSource}</strong><span>{t.editor.available(formatNumber(data.entries.length, t), formatRange(data.entries, t))}</span>
        {data.source === "rss" && <p>{t.editor.rssLimit(formatNumber(data.entries.length, t))}</p>}
        {data.skipped > 0 && <p>{data.source === "rss" ? t.editor.skippedRss(formatNumber(data.skipped, t)) : t.editor.skippedExport(formatNumber(data.skipped, t))}</p>}
        {data.duplicates > 0 && <p>{t.editor.duplicates(formatNumber(data.duplicates, t))}</p>}
      </div>
      {confirmReset && <div className="confirm-box" role="region" aria-label={t.editor.confirmLabel}><p>{t.editor.confirm}</p><div className="button-row"><button className="secondary" ref={cancelReset} onClick={() => { setConfirmReset(false); switchButton.current?.focus(); }}>{t.editor.cancel}</button><button onClick={resetSource}>{t.editor.confirmSwitch}</button></div></div>}
      <div className="editor-grid">
        <div className="editor-preview-column">
          <div className="preview-stage"><div className="preview-label"><span>{t.editor.livePreview}</span><span>{t.editor.rowsUpper(formatNumber(selected?.rows.length ?? 0, t))}</span></div><div className={`receipt-paper${receiptAssetsReady ? "" : " receipt-loading"}`}>{receiptAssetsReady && <Receipt ref={receipt} entries={data.entries} settings={settings} source={data.source} dictionary={t} metadata={metadata} printedAt={printedAt}/>}</div><p className="small muted">{t.editor.previewHelp}</p></div>
          <section className="viewing-profile" aria-labelledby="viewing-profile-title">
            <h2 id="viewing-profile-title">{t.viewingProfile.title}</h2>
            <div className="profile-body"><p className="eyebrow">{t.viewingProfile.eyebrow}</p>
            <div className="profile-summary"><p>{t.viewingProfile.sessions(formatNumber(profile.sessions, t))}</p><p>{t.viewingProfile.uniqueFilms(formatNumber(profile.uniqueFilms, t))}</p></div>
            <div className="profile-ratings"><div className="profile-section-title"><h3>{t.viewingProfile.ratingDistribution}</h3><strong>{profile.averageRating === undefined ? t.viewingProfile.noRatings : `${t.viewingProfile.averageRating}: ${formatNumber(profile.averageRating, t, 1)}`}</strong></div>
              <div className="rating-distribution" aria-label={t.viewingProfile.ratingDistribution}>{profile.ratingDistribution.map(bucket => <div className="rating-bucket" key={bucket.rating} title={`${formatNumber(bucket.rating, t, 1)}: ${formatNumber(bucket.count, t)}`}><span>{formatNumber(bucket.rating, t, 1)}</span><i style={{ height: `${bucket.count / maxRatingCount * 100}%` }}/><strong>{formatNumber(bucket.count, t)}</strong></div>)}</div>
              <p className="small muted">{t.viewingProfile.ratedEntries(formatNumber(profile.ratingsCount, t))}</p>
            </div>
            <div className="profile-genres"><div className="profile-section-title"><h3>{t.viewingProfile.topGenres}</h3>{enriching && <span role="status">{t.viewingProfile.loading}</span>}</div>
              {profile.topGenres.length ? <div className="genre-bars">{profile.topGenres.map(genre => <div key={genre.id}><span>{genreLabel(genre, language)}</span><strong>{formatNumber(genre.count, t)}</strong><i style={{ width: `${genre.count / maxGenreCount * 100}%` }}/></div>)}</div> : <p>{tmdbEnabled && enriching ? t.viewingProfile.loading : t.viewingProfile.noGenreData}</p>}
              <p className="small muted">{t.viewingProfile.genreCoverage(formatNumber(profile.genresAvailable, t), formatNumber(profile.uniqueFilms, t))}</p>
              {profile.genresAvailable < profile.uniqueFilms && !enriching && <p className="small muted">{t.viewingProfile.incompleteMetadata}</p>}
              {data.source === "rss" && <p className="small muted">{t.viewingProfile.recentRss}</p>}
            </div></div>
          </section>
          <AnnualRecapCard data={annualRecap} year={recapYear} years={recapYears} source={data.source} backgroundUrl={RECEIPT_BACKGROUNDS[settings.paper]} dictionary={t} onYearChange={setRecapYear} onExport={share => void downloadAnnualRecap(share)} canShare={canShare} disabled={!receiptAssetsReady || enriching || !recapYear || !annualRecap.sessions} exporting={exporting} error={recapExportError} artworkRef={annualArtwork}/>
        </div>
        <div className="controls"><h2 className="controls-heading">{t.editor.settingsHeading}</h2><div className="controls-body"><FieldSet disabled={exporting}><FieldLegend><span className="step">01</span> {t.editor.content}</FieldLegend>
          <FieldGroup>
            <Field><FieldLabel htmlFor="receipt-name">{t.editor.name}</FieldLabel><Input id="receipt-name" maxLength={48} value={settings.name} onChange={event => change("name", event.target.value)} placeholder={t.editor.namePlaceholder}/></Field>
            <Field><FieldLabel htmlFor="period">{t.editor.period}</FieldLabel><select id="period" value={settings.period} onChange={event => change("period", event.target.value)}><option value="all">{t.editor.allData}</option><optgroup label={t.editor.years}>{periods?.years.map(year => <option key={year} value={year}>{year}</option>)}</optgroup><optgroup label={t.editor.months}>{periods?.months.map(month => <option key={month} value={month}>{formatMonth(month, t)}</option>)}</optgroup></select></Field>
            <div className="control-row"><Field><FieldLabel htmlFor="sort">{t.editor.sort}</FieldLabel><select id="sort" value={settings.sort} onChange={event => change("sort", event.target.value as ReceiptSettings["sort"])}><option value="newest">{t.editor.newest}</option><option value="oldest">{t.editor.oldest}</option><option value="rating" disabled={!rated}>{t.editor.topRated}{!rated ? ` (${t.editor.unavailable})` : ""}</option></select></Field><Field><FieldLabel htmlFor="count">{t.editor.rowCount}</FieldLabel><select id="count" value={settings.count} onChange={event => change("count", Number(event.target.value) as 10 | 20)}><option value={10}>{t.editor.rows(formatNumber(10, t))}</option><option value={20}>{t.editor.rows(formatNumber(20, t))}</option></select></Field></div>
            <Field><FieldLabel htmlFor="value-type">{t.editor.valueType}</FieldLabel><select id="value-type" value={settings.valueType} onChange={event => change("valueType", event.target.value as ReceiptSettings["valueType"])}><option value="rating">{t.editor.rating}</option><option value="minute">{t.editor.minute}</option></select></Field>
          </FieldGroup>
        </FieldSet>
        <FieldSet disabled={exporting}><FieldLegend><span className="step">02</span> {t.editor.appearance}</FieldLegend>
          <span className="field-label" id="paper-label">{t.editor.paper}</span><div className="paper-choice-row" role="group" aria-labelledby="paper-label">{(Object.keys(RECEIPT_BACKGROUNDS) as ReceiptBackgroundId[]).map((value, index) => <button key={value} type="button" className={`paper-choice ${settings.paper === value ? "selected" : ""}`} aria-pressed={settings.paper === value} onClick={() => change("paper", value)}><img src={RECEIPT_BACKGROUNDS[value]} alt=""/><span>{language === "en" ? "Paper" : "Kertas"} {index + 1}{settings.paper === value ? " ✓" : ""}</span></button>)}</div>
        </FieldSet>
        {!selected?.rows.length && <p className="notice" role="status">{t.editor.emptyPeriod}</p>}
        <p className="enrichment-status" role="status">{enriching ? t.editor.enrichmentLoading : tmdbEnabled ? t.editor.enrichmentResult(formatNumber(matchedCount, t), formatNumber(failedCount, t)) : t.editor.enrichmentUnavailable}</p>
        <div className="download-panel"><Button className="primary download" disabled={exportBlocked} onClick={() => void download()}><Download size={16} aria-hidden="true"/>{exporting || !receiptAssetsReady ? t.editor.preparing : t.editor.download}</Button>{canShare && <Button variant="outline" className="secondary share" disabled={exportBlocked} onClick={() => void download(true)}><Share2 size={16} aria-hidden="true"/>{t.editor.share.replace(/\s*↗$/, "")}</Button>}<p className="small muted">{t.editor.downloadNote}</p><p role="status" className="status">{exporting ? t.editor.creating : noticeMessage}</p>{exportError && <div className="error" role="alert"><p>{t.editor.exportFailed}</p><button className="text-button" onClick={() => void download()}>{t.landing.retry}</button></div>}</div>
        </div></div>
      </div>
    </section>}
  </main>;
}
