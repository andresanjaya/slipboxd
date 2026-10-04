# Slipboxd

MVP web responsif untuk mengubah diary Letterboxd menjadi struk PNG. Dibangun dengan Next.js App Router, React, TypeScript, Tailwind CSS, dan komponen shadcn/ui berdasarkan [PRD](./Slipboxd-PRD-MVP.md).

## Menjalankan

Gunakan Node.js 22 LTS atau lebih baru.

```sh
npm ci
npm run dev
```

Buka http://localhost:3000. Di PowerShell dengan execution policy yang memblokir `npm.ps1`, gunakan `npm.cmd` untuk perintah npm.

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
npm start
```

Tes browser memakai Google Chrome yang terpasang, desktop dan emulasi Pixel 7. Untuk lingkungan tanpa Chrome, pasang dengan `npx playwright install chrome`, atau ubah `channel` di `playwright.config.ts` ke browser Chromium yang tersedia. Emulasi mobile bukan pengganti pengujian perangkat asli.

## Alur dan batas data

- **Upload ekspor:** unduh ekspor resmi Letterboxd, ekstrak, lalu unggah file `diary.csv` di dalamnya. UI menerima `diary.csv` hingga 10 MB; ZIP tidak ditawarkan sebagai pilihan upload. Pembacaan, parsing, normalisasi, preview, dan PNG berlangsung di browser. Parser ZIP lama tetap ada untuk kompatibilitas internal, tetapi tidak dipakai dalam alur upload UI.
- **Username:** `GET /api/rss?username=…` mengambil satu feed `https://letterboxd.com/{username}/rss/`. Validasi username, host tetap, redirect ditolak, timeout 8 detik termasuk pembacaan body, maksimum respons 2 MB. Tidak ada pengambilan HTML, pagination, login, atau API resmi.
- **Cache RSS:** hanya entri publik yang sudah dinormalisasi, 60 detik, maksimum 100 username per proses. Cache memori tidak dibagi antar-instance; tidak ada database. XML/review tidak disimpan. Respons sukses boleh di-cache paling lama sisa TTL tersebut.
- **Editor:** nama pada struk, semua data/tahun/bulan yang ditemukan, urutan terbaru/terlama/rating, 10/20 baris, pilihan nilai **rating** (default) atau **menit** (TMDB), dan empat jenis kertas dari `public/assets/`. Perubahan langsung memperbarui struk.
- **PNG:** SVG preview yang sama dirasterisasi menjadi PNG 3× (lebar 1320 px), tanpa kontrol editor. Font lokal Merchant Copy dan texture kertas aktif ditunggu lalu di-embed ke salinan SVG sebelum rasterisasi. Nama file disanitasi. Berbagi memakai Web Share jika tersedia, dengan fallback download; pembatalan dialog berbagi tidak memaksa download.
- **Metadata TMDB:** film unik pada periode terpilih dikirim sebagai judul dan tahun rilis ke route internal `POST /api/tmdb`. Route server memakai Bearer token, maksimal 25 film per batch, tiga request paralel, timeout tujuh detik, dan penanganan per film. Cache browser hanya hidup selama sesi. Hasil ambigu atau tahun yang tidak cocok dibiarkan kosong.
- **Rating, runtime, dan Viewing Profile:** kolom `RATING` dan rata-rata memakai data CSV/RSS yang diimpor. Saat memilih menit, kolom `MIN` dan total runtime hanya memakai film yang cocok dengan yakin di TMDB. Viewing Profile merangkum paling banyak tiga genre dari film unik yang cocok dan bukan penilaian psikologis.
- **Bahasa:** seluruh landing, editor, receipt, status, error, serta halaman `/about` tersedia dalam Bahasa Indonesia dan English. Bahasa awal mengikuti `navigator.language`; pilihan manual `ID | EN` disimpan di `localStorage`. Mengganti bahasa tidak memuat ulang halaman atau menghapus data impor.

Tanggal hanya berasal dari `Watched Date` (CSV) atau `letterboxd:watchedDate` (RSS), disimpan sebagai tanggal kalender `YYYY-MM-DD`. `Date` dan `pubDate` tidak menjadi pengganti. Rating kosong tidak menjadi nol. Film yang ditonton ulang tetap sesi terpisah; film unik dihitung berdasarkan URI film kanonis atau fallback judul+tahun. CSV tidak dideduplikasi karena tidak memiliki ID sesi stabil; RSS hanya dideduplikasi lewat GUID yang hadir.

Mode RSS selalu ditandai sebagai aktivitas publik terbaru. Jumlah/rentang feed tidak menjamin riwayat lengkap. Jumlah sesi/film unik dihitung untuk seluruh periode yang dipilih sebelum pembatasan jumlah baris.

## Konfigurasi TMDB

Tambahkan API Read Access Token TMDB ke file lokal yang diabaikan Git:

```sh
TMDB_API_READ_ACCESS_TOKEN=your_bearer_token
```

Gunakan nama environment variable yang sama di **Vercel Project Settings → Environment Variables**, lalu redeploy. Token hanya dibaca route server dan tidak dimasukkan ke bundle browser. Tanpa variable ini, import, editor, dan export tetap bekerja; runtime serta insight genre ditandai tidak tersedia.

Empat texture receipt dipetakan di `src/config/receipt-backgrounds.ts`; `paper-bg-2` adalah default. Pilihan editor berlaku untuk preview dan PNG yang diunduh.

## Privasi dan release gate

Tidak ada endpoint upload, analytics, atau penyimpanan diary. File yang dipilih hanya dibaca di browser; data dilepas saat ganti sumber atau halaman ditutup. Saat enrichment aktif, hanya judul dan tahun rilis dari periode terpilih yang dikirim melalui server Slipboxd ke TMDB. `localStorage` hanya menyimpan kode bahasa manual (`id` atau `en`), bukan data film atau username. Mode username mengirim username ke server untuk meminta RSS publik; penyedia hosting mungkin menyimpan log teknis rutin. `.gitignore` mengecualikan direktori `letterboxd-*`, ZIP, dan CSV selain fixture fiktif di `tests/fixtures`. Jangan memindahkan ekspor asli ke `public/` atau fixture.

Sebelum rilis publik, putuskan kelayakan penggunaan RSS berdasarkan ketentuan Letterboxd yang berlaku. Set `RSS_ENABLED=false` di `.env.local` atau environment deployment untuk menyembunyikan input username dan menonaktifkan route (503), lalu restart server. Upload tetap tersedia. Nilai ini dibaca server saat request; tidak dibekukan dalam bundle klien. Contoh ada di `.env.example`.

Referensi: [dokumentasi App Router Next.js](https://nextjs.org/docs/app/getting-started/installation), [informasi RSS/API Letterboxd](https://letterboxd.com/api-beta/), [ekspor Letterboxd](https://letterboxd.com/user/exportdata/). Proyek independen, tidak berafiliasi dengan Letterboxd.

## Struktur

| Lokasi | Peran |
| --- | --- |
| `src/app/` | App Router, layout, styling, halaman/error boundary, route RSS |
| `src/components/slipboxd-app.tsx` | Input, status/pemulihan, editor, ganti sumber, aksi download/share |
| `src/components/receipt-v2.tsx` | SVG receipt Figma bersama untuk preview dan PNG; runtime, asset, dan tanggal cetak |
| `src/config/receipt-backgrounds.ts` | Pemetaan texture dan satu nilai default untuk preview/export |
| `src/components/about.tsx`, `site-chrome.tsx` | About/FAQ, accordion, header/footer, navigasi, toggle bahasa |
| `src/i18n/` | Dictionary typed ID/EN, provider persistence, format tanggal dan angka |
| `src/lib/model.ts` | WatchEntry, aturan tanggal/rating/identitas, filter, urutan, ringkasan |
| `src/lib/import-export.ts`, `zip-integrity.ts` | Impor CSV/ZIP lokal dan validasi integritas |
| `src/lib/rss.ts` | Parser XML dan fetch RSS terbatas |
| `src/lib/tmdb-server.ts`, `src/app/api/tmdb/route.ts` | Pencarian/detail TMDB server-only, pencocokan konservatif, batch, dan timeout |
| `src/lib/tmdb.ts` | Model metadata, cache key, dan aturan deterministik Viewing Profile |
| `src/lib/download.ts` | Menunggu/meng-embed font dan texture, SVG → canvas → PNG, serta download |
| `tests/fixtures/` | CSV dan RSS fiktif; tidak berisi data pengguna |
| `tests/*.test.ts` | Tes parser, aturan data, batas, timeout, cache, release gate |
| `tests/e2e/` | Alur desktop/mobile, persistence bahasa, switch setelah impor, FAQ keyboard, dan pemulihan |
| `scripts/check-rss.ts` | Smoke check RSS nyata opsional, mencetak agregat tanpa menyimpan feed |

Smoke check eksternal opsional:

```sh
npx tsx scripts/check-rss.ts USERNAME_PUBLIK
```

## Verifikasi implementasi — 4 Oktober 2026

- Typecheck dan production build lulus.
- 24 tes unit/integrasi lulus: cakupan parser/route, kesetaraan dictionary, format tanggal/angka ID/EN, serta pemetaan asset receipt lokal.
- 22 tes browser lulus (11 skenario × desktop/mobile): upload `diary.csv`, penolakan ZIP dengan petunjuk pemulihan, RSS dan PNG, font/texture receipt, export 10/20 entri, navigator default, persistence manual, `document.lang`, switch bahasa setelah impor tanpa kehilangan state, route About, accordion keyboard, kredit/tautan, dan overflow.
- Screenshot landing/editor/About desktop/mobile serta PNG fiktif diperiksa secara visual. Artefak tes ada di `test-results/` dan diabaikan Git.
- `diary.csv` asli yang sudah ada di workspace diperiksa **secara lokal**: 152 sesi valid, 148 film unik, 0 baris dilewati. Alur impor browser sampai PNG 20 baris juga berhasil, tanpa request upload/API. Isi pribadi tidak disalin ke source/fixture atau dicetak; PNG smoke test dihapus setelah verifikasi.
- Smoke test feed publik nyata melalui build produksi berhasil: HTTP 200, 50 entri valid, editor 20 baris sampai download PNG, tanpa error browser. Feed tidak disimpan sebagai fixture.

Masih perlu divalidasi sebelum rilis:

1. File `diary.csv` dari variasi ekspor dan akun Letterboxd lain, bukan hanya fixture fiktif dan satu CSV lokal.
2. Safari/iPhone dan Android fisik: pemilihan file, keterbacaan PNG 10/20 baris, download, zoom, pembaca layar, dan dialog berbagi native.
3. Uji tugas dengan pengguna Letterboxd untuk memastikan cakupan RSS dan perbedaan sesi/film unik dipahami; target kuantitatif belum ditetapkan.
4. Keputusan release gate RSS, domain/nama merek, dan uji akses RSS dari lingkungan deployment yang sebenarnya. Keberhasilan smoke test lokal tidak menjamin ketersediaan feed setiap akun atau setiap waktu.

`AGENTS.md` dan `CLAUDE.md` di root dibuat otomatis oleh Next.js saat server pengembangan dijalankan. PRD asli tidak diubah.
