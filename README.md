# Slipboxd

MVP web responsif untuk mengubah diary Letterboxd menjadi struk PNG. Dibangun dengan Next.js App Router, React, dan TypeScript berdasarkan [PRD](./Slipboxd-PRD-MVP.md).

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

- **Upload ekspor:** pilih ZIP resmi atau `diary.csv`. Pembacaan, dekompresi, parsing, normalisasi, preview, dan PNG berlangsung di browser. Batas ZIP 20 MB; CSV hasil dekompresi 10 MB. Hanya `diary.csv` diekstrak. ZIP multipart, ZIP64, dan ZIP berkata sandi ditolak dengan pemulihan ke CSV langsung. Integritas central directory dan CRC diary diperiksa.
- **Username:** `GET /api/rss?username=…` mengambil satu feed `https://letterboxd.com/{username}/rss/`. Validasi username, host tetap, redirect ditolak, timeout 8 detik termasuk pembacaan body, maksimum respons 2 MB. Tidak ada pengambilan HTML, pagination, login, atau API resmi.
- **Cache RSS:** hanya entri publik yang sudah dinormalisasi, 60 detik, maksimum 100 username per proses. Cache memori tidak dibagi antar-instance; tidak ada database. XML/review tidak disimpan. Respons sukses boleh di-cache paling lama sisa TTL tersebut.
- **Editor:** nama/judul, semua data/tahun/bulan yang benar-benar ditemukan, urutan terbaru/terlama/rating, 10/20 baris, Classic Receipt/Cinema Ticket, putih/krem. Perubahan langsung memperbarui struk.
- **PNG:** SVG preview yang sama dirasterisasi menjadi PNG 3× (lebar 1320 px), tanpa kontrol editor. Nama file disanitasi. Berbagi memakai Web Share jika tersedia, dengan fallback download; pembatalan dialog berbagi tidak memaksa download.

Tanggal hanya berasal dari `Watched Date` (CSV) atau `letterboxd:watchedDate` (RSS), disimpan sebagai tanggal kalender `YYYY-MM-DD`. `Date` dan `pubDate` tidak menjadi pengganti. Rating kosong tidak menjadi nol. Film yang ditonton ulang tetap sesi terpisah; film unik dihitung berdasarkan URI film kanonis atau fallback judul+tahun. CSV tidak dideduplikasi karena tidak memiliki ID sesi stabil; RSS hanya dideduplikasi lewat GUID yang hadir.

Mode RSS selalu ditandai sebagai aktivitas publik terbaru. Jumlah/rentang feed tidak menjamin riwayat lengkap. Jumlah sesi/film unik dihitung untuk seluruh periode yang dipilih sebelum pembatasan jumlah baris.

## Privasi dan release gate

Tidak ada endpoint upload, analytics, localStorage, atau penyimpanan diary. File yang dipilih hanya dibaca di browser; data dilepas saat ganti sumber atau halaman ditutup. `.gitignore` mengecualikan direktori `letterboxd-*`, ZIP, dan CSV selain fixture fiktif di `tests/fixtures`. Jangan memindahkan ekspor asli ke `public/` atau fixture. Folder ekspor lokal yang sudah ada tidak diubah dan tidak diperlukan aplikasi.

Sebelum rilis publik, putuskan kelayakan penggunaan RSS berdasarkan ketentuan Letterboxd yang berlaku. Set `RSS_ENABLED=false` di `.env.local` atau environment deployment untuk menyembunyikan input username dan menonaktifkan route (503), lalu restart server. Upload tetap tersedia. Nilai ini dibaca server saat request; tidak dibekukan dalam bundle klien. Contoh ada di `.env.example`.

Referensi: [dokumentasi App Router Next.js](https://nextjs.org/docs/app/getting-started/installation), [informasi RSS/API Letterboxd](https://letterboxd.com/api-beta/), [ekspor Letterboxd](https://letterboxd.com/user/exportdata/). Proyek independen, tidak berafiliasi dengan Letterboxd.

## Struktur

| Lokasi | Peran |
| --- | --- |
| `src/app/` | App Router, layout, styling, halaman/error boundary, route RSS |
| `src/components/slipboxd.tsx` | Input, status/pemulihan, editor, ganti sumber, aksi download/share |
| `src/components/receipt.tsx` | SVG bersama untuk preview dan PNG; pembungkusan judul |
| `src/lib/model.ts` | WatchEntry, aturan tanggal/rating/identitas, filter, urutan, ringkasan |
| `src/lib/import-export.ts`, `zip-integrity.ts` | Impor CSV/ZIP lokal dan validasi integritas |
| `src/lib/rss.ts` | Parser XML dan fetch RSS terbatas |
| `src/lib/download.ts` | SVG → canvas → PNG dan download |
| `tests/fixtures/` | CSV dan RSS fiktif; tidak berisi data pengguna |
| `tests/*.test.ts` | Tes parser, aturan data, batas, timeout, cache, release gate |
| `tests/e2e/flows.spec.ts` | Alur browser desktop/mobile dan pemulihan |
| `scripts/check-rss.ts` | Smoke check RSS nyata opsional, mencetak agregat tanpa menyimpan feed |

Smoke check eksternal opsional:

```sh
npx tsx scripts/check-rss.ts USERNAME_PUBLIK
```

## Verifikasi implementasi — 3 Oktober 2026

- Typecheck dan production build lulus.
- 16 tes unit/integrasi lulus: CSV quote/koma/newline/BOM, tanggal, rewatch, rating kosong, judul sama, sesi identik, ZIP valid/rusak/terlalu besar/missing diary, RSS non-diary/GUID/empty/error, host/redirect, timeout dan ukuran response, cache serta gate.
- 12 tes browser lulus (6 skenario × desktop/mobile): CSV/ZIP/RSS fixture sampai preview/PNG, kontrol editor, dua template/warna, nama file/resolusi PNG, pemulihan, data upload tidak terkirim, tanpa persistence, keyboard, dan API menolak URL arbitrer.
- Screenshot landing/editor desktop/mobile serta PNG fiktif diperiksa secara visual. Artefak tes ada di `test-results/` dan diabaikan Git.
- `diary.csv` asli yang sudah ada di workspace diperiksa **secara lokal**: 152 sesi valid, 148 film unik, 0 baris dilewati. Alur impor browser sampai PNG 20 baris juga berhasil, tanpa request upload/API. Isi pribadi tidak disalin ke source/fixture atau dicetak; PNG smoke test dihapus setelah verifikasi.
- Smoke test feed publik nyata melalui build produksi berhasil: HTTP 200, 50 entri valid, editor 20 baris sampai download PNG, tanpa error browser. Feed tidak disimpan sebagai fixture.

Masih perlu divalidasi sebelum rilis:

1. Arsip ZIP resmi utuh dari Letterboxd (yang tersedia lokal adalah hasil ekstraknya), serta variasi ekspor dari akun lain, bukan hanya CSV asli satu akun dan ZIP sintetis.
2. Safari/iPhone dan Android fisik: pemilihan file, keterbacaan PNG 10/20 baris, download, zoom, pembaca layar, dan dialog berbagi native.
3. Uji tugas dengan pengguna Letterboxd untuk memastikan cakupan RSS dan perbedaan sesi/film unik dipahami; target kuantitatif belum ditetapkan.
4. Keputusan release gate RSS, domain/nama merek, dan uji akses RSS dari lingkungan deployment yang sebenarnya. Keberhasilan smoke test lokal tidak menjamin ketersediaan feed setiap akun atau setiap waktu.

`AGENTS.md` dan `CLAUDE.md` di root dibuat otomatis oleh Next.js saat server pengembangan dijalankan. PRD asli tidak diubah.
