"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { availablePeriods, defaultSettings, observedRange, safeFilename, selectEntries, type ImportResult, type ReceiptSettings, type WatchEntry } from "@/lib/model";
import { Receipt } from "./receipt";
import { receiptPng, savePng } from "@/lib/download";

const exampleEntries: WatchEntry[] = [
  { source: "export", filmKey: "example:1", title: "The Last Matinee", releaseYear: 2026, watchedDate: "2026-10-03", rating: 4.5 },
  { source: "export", filmKey: "example:2", title: "Somewhere, After Midnight", releaseYear: 2024, watchedDate: "2026-10-02", rating: 4 },
  { source: "export", filmKey: "example:3", title: "A Small Cinema by the Sea", releaseYear: 2025, watchedDate: "2026-10-01", rating: 5, rewatch: true },
];

export function Slipboxd({ rssEnabled }: { rssEnabled: boolean }) {
  const [data, setData] = useState<ImportResult | null>(null);
  const [settings, setSettings] = useState<ReceiptSettings>({ ...defaultSettings });
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState<"file" | "rss" | null>(null);
  const [error, setError] = useState<{ mode: "file" | "rss"; message: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [notice, setNotice] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const receipt = useRef<SVGSVGElement>(null);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const sourceHeading = useRef<HTMLHeadingElement>(null);
  const cancelReset = useRef<HTMLButtonElement>(null);
  const switchButton = useRef<HTMLButtonElement>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    setCanShare(typeof navigator.share === "function" && typeof navigator.canShare === "function");
    return () => request.current?.abort();
  }, []);
  useEffect(() => { if (data) editorHeading.current?.focus(); }, [data]);
  useEffect(() => { if (confirmReset) cancelReset.current?.focus(); }, [confirmReset]);

  function accept(result: ImportResult) {
    setData(result);
    setSettings({ ...defaultSettings, name: result.username ?? "" });
    setError(null);
    setNotice("");
  }

  async function upload(file: File) {
    setLoading("file"); setError(null);
    try {
      const { importExportFile } = await import("@/lib/import-export");
      accept(await importExportFile(file));
    } catch (e) {
      setError({ mode: "file", message: e instanceof Error ? e.message : "File belum bisa dibaca. Pilih file lain." });
    } finally {
      setLoading(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function loadRss(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!/^[a-z0-9][a-z0-9_-]{0,39}$/i.test(username.trim())) {
      setError({ mode: "rss", message: "Masukkan username, bukan URL. Gunakan huruf, angka, _ atau - (maks. 40 karakter)." }); return;
    }
    setLoading("rss");
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`/api/rss?username=${encodeURIComponent(username.trim())}`, { signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Aktivitas publik belum bisa dimuat.");
      accept(result as ImportResult);
    } catch (e) {
      setError({ mode: "rss", message: controller.signal.aborted ? "Aktivitas publik terlalu lama merespons. Coba lagi atau upload ekspor." : e instanceof Error ? e.message : "Aktivitas publik belum bisa dimuat." });
    } finally { clearTimeout(timeout); request.current = null; setLoading(null); }
  }

  function change<K extends keyof ReceiptSettings>(key: K, value: ReceiptSettings[K]) {
    setSettings(previous => ({ ...previous, [key]: value }));
    setNotice("");
  }

  function resetSource() {
    request.current?.abort();
    setData(null); setSettings({ ...defaultSettings }); setUsername(""); setError(null);
    setExportError(""); setNotice(""); setConfirmReset(false);
    // No persistence: dropping state releases imported entries and personal labels.
    setTimeout(() => sourceHeading.current?.focus(), 0);
  }

  async function download(share = false) {
    if (!receipt.current) return;
    setExporting(true); setExportError(""); setNotice("");
    try {
      const blob = await receiptPng(receipt.current);
      const filename = safeFilename(settings);
      const file = new File([blob], filename, { type: "image/png" });
      if (share && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: settings.title || "My Movie Receipt" }); setNotice("Struk berhasil dibagikan."); }
        catch (e) {
          if (e instanceof Error && e.name === "AbortError") return;
          savePng(blob, filename); setNotice("Berbagi tidak tersedia. PNG diunduh sebagai gantinya.");
        }
      } else { savePng(blob, filename); setNotice("PNG siap. Periksa unduhan perangkatmu."); }
    } catch { setExportError("Gambar belum berhasil dibuat. Pengaturanmu tetap tersimpan di halaman ini; coba lagi."); }
    finally { setExporting(false); }
  }

  const periods = data ? availablePeriods(data.entries) : null;
  const selected = data ? selectEntries(data.entries, settings) : null;
  const rated = data?.entries.some(entry => entry.rating !== undefined);

  return <>
    <a className="skip-link" href="#main">Lewati ke konten</a>
    <header className="site-header shell"><a href="/" className="wordmark" aria-label="Slipboxd beranda">slipboxd<span>✳</span></a><span className="header-note">A LITTLE PROOF OF A GOOD WATCH.</span><span className="edition">VOL. 001</span></header>
    <main id="main" className="shell">
      {!data ? <>
        <section className="intro"><p className="eyebrow"><span className="dot"/> FOR THE LOVE OF FILM</p><h1>Your films.<br/><em>Your receipt.</em></h1><p className="intro-copy">Film selesai. Ceritanya tinggal.<br/>Jadikan diary Letterboxd-mu struk kecil yang bisa disimpan dan dibagikan.</p></section>
        <section className="landing-grid" aria-labelledby="source-heading">
          <div className="source-area"><div className="section-heading"><span className="step">01</span><h2 id="source-heading" ref={sourceHeading} tabIndex={-1}>Mulai dari diary-mu</h2></div>
            <p className="muted">Dua cara masuk. Satu struk personal.</p>
            <div className="source-cards">
              <section className="source-card" aria-labelledby="upload-title"><div className="card-icon" aria-hidden="true">↥</div><h3 id="upload-title">Upload ekspor</h3><p>Untuk membuat struk dari diary yang kamu ekspor sendiri. Terima file ZIP atau <code>diary.csv</code>.</p>
                <p className="source-scope">Semua entri diary valid dalam file. Diproses di browser, tanpa mengirim file ke server.</p>
                <a className="text-link" href="https://letterboxd.com/user/exportdata/" target="_blank" rel="noopener noreferrer">Buka halaman ekspor Letterboxd ↗</a>
                <label className="file-label" htmlFor="diary-file">Pilih ZIP / diary.csv</label>
                <input ref={fileInput} id="diary-file" type="file" accept=".zip,.csv" disabled={!!loading} aria-describedby={error?.mode === "file" ? "file-error file-help" : "file-help"} aria-invalid={error?.mode === "file"} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }}/>
                <p id="file-help" className="small muted">ZIP maks. 20 MB · diary.csv maks. 10 MB</p>
                {error?.mode === "file" && <div id="file-error" className="error" role="alert"><p>{error.message}</p><button className="text-button" onClick={() => fileInput.current?.click()}>Pilih file lain</button></div>}
              </section>
              <section className="source-card" aria-labelledby="rss-title"><div className="card-icon" aria-hidden="true">@</div><h3 id="rss-title">Pakai username</h3><p>Cara cepat memakai aktivitas diary publik terbaru. Riwayat lama atau privat mungkin tidak tersedia.</p>
                <p className="source-scope">Jumlah dan rentang mengikuti entri yang tersedia dalam RSS publik, bukan total akun.</p>
                {rssEnabled ? <form onSubmit={loadRss} noValidate><label htmlFor="username">Username Letterboxd</label><div className="username-input"><span aria-hidden="true">@</span><input id="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="username" autoCapitalize="none" spellCheck={false} autoComplete="off" maxLength={40} disabled={!!loading} aria-invalid={error?.mode === "rss"} aria-describedby={error?.mode === "rss" ? "rss-error" : undefined}/></div>
                  <button className="primary" type="submit" disabled={!!loading}>{loading === "rss" ? "Memuat aktivitas…" : error?.mode === "rss" ? "Coba lagi" : "Muat aktivitas terbaru"}<span aria-hidden="true">↗</span></button>
                </form> : <p className="notice">Mode username sedang tidak tersedia. Gunakan upload ekspor.</p>}
                {error?.mode === "rss" && <div id="rss-error" className="error" role="alert"><p>{error.message}</p><button className="text-button" onClick={() => { fileInput.current?.focus(); fileInput.current?.click(); }}>Upload ekspor</button></div>}
              </section>
            </div>
            <p role="status" aria-live="polite" className="status">{loading === "file" ? "Membaca diary di browser…" : loading === "rss" ? "Mengambil entri dari RSS publik Letterboxd…" : "Tanpa akun Slipboxd. Tanpa menyimpan diary-mu."}</p>
          </div>
          <aside className="example-stage" aria-label="Contoh struk"><span className="stage-label">THE SOUVENIR</span><div className="example-receipt"><Receipt entries={exampleEntries} settings={{ ...defaultSettings, name: "A film lover", title: "A week at the movies" }} source="export" example/></div><p className="example-label">CONTOH — DATA FILM FIKTIF</p></aside>
        </section>
        <div className="how-it-works"><span>01 / IMPOR DIARY</span><span>02 / BUAT JADI MILIKMU</span><span>03 / SIMPAN KENANGANNYA ↗</span></div>
      </> : <section className="editor" aria-labelledby="editor-heading">
        <div className="editor-top"><div><p className="eyebrow">THE RECEIPT STUDIO</p><h1 id="editor-heading" ref={editorHeading} tabIndex={-1}>Make it yours.</h1></div><button ref={switchButton} className="secondary" disabled={exporting} onClick={() => setConfirmReset(true)}>Ganti sumber ↗</button></div>
        <div className="import-summary" role="status"><strong>{data.source === "rss" ? "Diambil dari aktivitas publik terbaru" : "Dari diary yang kamu unggah"}</strong><span>{data.entries.length} entri tersedia · {observedRange(data.entries)}</span>
          {data.source === "rss" && <p>Kami menemukan {data.entries.length} entri terbaru yang tersedia. Ini bukan seluruh riwayat atau total akun. Upload ekspor untuk cakupan lebih lengkap.</p>}
          {data.skipped > 0 && <p>{data.skipped} {data.source === "rss" ? "item non-diary atau tanpa judul/tanggal valid" : "baris tanpa judul/tanggal valid atau format lengkap"} dilewati.</p>}
          {data.duplicates > 0 && <p>{data.duplicates} item dengan identitas entri yang sama diabaikan.</p>}
        </div>
        {confirmReset && <div className="confirm-box" role="region" aria-label="Konfirmasi ganti sumber"><p>Ganti sumber? Diary dan pengaturan saat ini akan dilepas dari halaman.</p><div className="button-row"><button className="secondary" ref={cancelReset} onClick={() => { setConfirmReset(false); switchButton.current?.focus(); }}>Batal</button><button onClick={resetSource}>Ya, ganti sumber</button></div></div>}
        <div className="editor-grid">
          <div className="preview-stage"><div className="preview-label"><span>LIVE PREVIEW</span><span>{selected?.rows.length} BARIS</span></div><div className="receipt-paper"><Receipt ref={receipt} entries={data.entries} settings={settings} source={data.source}/></div><p className="small muted">Preview mengikuti layar · PNG beresolusi 3×</p></div>
          <div className="controls"><fieldset disabled={exporting}><legend><span className="step">01</span> Isi</legend>
            <label htmlFor="receipt-name">Nama pada struk</label><input id="receipt-name" maxLength={48} value={settings.name} onChange={e => change("name", e.target.value)} placeholder="Nama atau aliasmu"/>
            <label htmlFor="receipt-title">Judul struk <span className="muted small">maks. 60 karakter</span></label><input id="receipt-title" maxLength={60} value={settings.title} onChange={e => change("title", e.target.value)} placeholder="My Movie Receipt"/>
            <label htmlFor="period">Periode</label><select id="period" value={settings.period} onChange={e => change("period", e.target.value)}><option value="all">Semua data tersedia</option><optgroup label="Tahun">{periods?.years.map(year => <option key={year} value={year}>{year}</option>)}</optgroup><optgroup label="Bulan">{periods?.months.map(month => <option key={month} value={month}>{month}</option>)}</optgroup></select>
            <div className="control-row"><div><label htmlFor="sort">Urutan</label><select id="sort" value={settings.sort} onChange={e => change("sort", e.target.value as ReceiptSettings["sort"])}><option value="newest">Terbaru</option><option value="oldest">Terlama</option><option value="rating" disabled={!rated}>Rating tertinggi{!rated ? " (tidak tersedia)" : ""}</option></select></div><div><label htmlFor="count">Jumlah baris</label><select id="count" value={settings.count} onChange={e => change("count", Number(e.target.value) as 10 | 20)}><option value={10}>10 baris</option><option value={20}>20 baris</option></select></div></div>
          </fieldset>
          <fieldset disabled={exporting}><legend><span className="step">02</span> Tampilan</legend>
            <span className="field-label" id="template-label">Template</span><div className="choice-row" role="group" aria-labelledby="template-label">{([['classic', 'Classic Receipt'], ['ticket', 'Cinema Ticket']] as const).map(([value, label]) => <button key={value} className={`choice ${settings.template === value ? "selected" : ""}`} aria-pressed={settings.template === value} onClick={() => change("template", value)}><span className={`template-symbol ${value}`} aria-hidden="true">▤</span>{label}{settings.template === value && <span aria-hidden="true"> ✓</span>}</button>)}</div>
            <span className="field-label" id="paper-label">Warna kertas</span><div className="choice-row" role="group" aria-labelledby="paper-label">{([['white', 'Putih'], ['cream', 'Krem']] as const).map(([value, label]) => <button key={value} className={`choice compact ${settings.paper === value ? "selected" : ""}`} aria-pressed={settings.paper === value} onClick={() => change("paper", value)}><span className={`swatch ${value}`} aria-hidden="true"/>{label}{settings.paper === value && <span aria-hidden="true">✓</span>}</button>)}</div>
          </fieldset>
          {!selected?.rows.length && <p className="notice" role="status">Tidak ada entri dalam periode ini. Pilih periode lain.</p>}
          <div className="download-panel"><button className="primary download" disabled={exporting || !selected?.rows.length} onClick={() => void download()}>{exporting ? "Menyiapkan gambar…" : "Download PNG"}<span aria-hidden="true">↓</span></button>{canShare && <button className="secondary share" disabled={exporting || !selected?.rows.length} onClick={() => void download(true)}>Bagikan ↗</button>}<p className="small muted">Siap disimpan. Siap dibagikan. Sepenuhnya milikmu.</p><p role="status" className="status">{exporting ? "Membuat PNG dari preview…" : notice}</p>{exportError && <div className="error" role="alert"><p>{exportError}</p><button className="text-button" onClick={() => void download()}>Coba lagi</button></div>}</div>
          </div>
        </div>
      </section>}
    </main>
    <footer className="site-footer shell"><span className="wordmark">slipboxd<span>✳</span></span><p>Proyek independen. Tidak berafiliasi dengan Letterboxd.</p><span className="small">MADE FOR THE CREDITS PEOPLE.</span></footer>
  </>;
}
