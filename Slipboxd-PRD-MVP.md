# Slipboxd — Product Requirements Document (MVP)

**Versi:** 1.0  
**Tanggal:** 3 Oktober 2026  
**Status:** Siap untuk desain dan implementasi MVP  
**Platform:** Web responsif, mobile-first  
**Stack yang dipilih:** Next.js + TypeScript

## 1. Ringkasan produk

Slipboxd mengubah catatan menonton film pengguna Letterboxd menjadi struk digital yang dapat dikustomisasi, diunduh sebagai PNG, dan dibagikan. Pengguna dapat memulai melalui dua cara: mengunggah ekspor akun miliknya (`.zip` atau `diary.csv`) atau mengetik username untuk memuat entri diary publik terbaru dari RSS Letterboxd. Hasil dari kedua cara tersebut menggunakan editor dan renderer struk yang sama.

**Janji produk:** "Your films. Your receipt."  
**Posisi produk:** proyek independen; bukan produk resmi atau afiliasi Letterboxd.

## 2. Masalah, pengguna, dan tujuan

Catatan menonton sudah tersimpan di Letterboxd, tetapi pengguna yang ingin membagikan ringkasan personal dalam format struk perlu membuatnya secara manual. Slipboxd mempersingkat pekerjaan itu menjadi alur impor, pilih isi, lihat preview, dan unduh.

**Pengguna awal:** pemilik akun Letterboxd yang mencatat film dalam diary dan ingin membuat gambar untuk dibagikan. Mode username juga dapat dipakai untuk profil publik lain; aplikasi tidak mengklaim bahwa orang yang memasukkan username adalah pemilik akun tersebut.

**Tujuan MVP:** pengguna berhasil membuat dan mengunduh struk yang akurat terhadap data sumber yang tersedia, dengan perbedaan cakupan antara ekspor dan username terlihat sebelum dan sesudah impor.

**Di luar MVP:** login Letterboxd, akses API resmi, scraping halaman profil/diary, database akun pengguna, penyimpanan ekspor di server, sinkronisasi historis otomatis, poster, runtime, sutradara, genre, analisis kepribadian, dan PDF. Jangan memakai label "seluruh history" untuk mode username.

## 3. Keputusan sumber data

| Mode | Input | Sumber | Cakupan yang boleh dijanjikan | Pengolahan |
| --- | --- | --- | --- | --- |
| **Upload data** | ZIP hasil ekspor Letterboxd atau `diary.csv` | File yang dipilih pengguna | Semua entri diary valid yang ada dalam file yang diunggah; bukan semua film yang hanya ditandai *watched* | Di browser, tanpa upload file ke server |
| **Username** | Username publik | Feed RSS publik akun tersebut | Entri diary terbaru yang tersedia dalam feed saat dimuat; jumlah dan rentang tidak dijamin | Next.js route di server mengambil feed dari host Letterboxd yang tetap |

Letterboxd menyediakan [ekspor ZIP berisi CSV](https://letterboxd.com/user/exportdata/) dan menyebut [RSS feed untuk entri diary/review/list terbaru](https://letterboxd.com/api-beta/). Akses [API resmi melalui permohonan](https://letterboxd.com/api-beta/), sehingga tidak menjadi dependensi MVP. Jalur username memakai RSS publik; jika feed tidak tersedia atau tidak menghasilkan entri diary yang dapat dibaca, tampilkan kegagalan yang jelas dan tautkan jalur upload. Ketentuan Letterboxd membatasi [alat pengambilan data otomatis/scraping](https://letterboxd.com/legal/terms-of-use/); implementasi ini tidak memindai halaman profil atau pagination diary. Penilaian kelayakan penggunaan RSS pada rilis publik tetap perlu dilakukan terhadap ketentuan yang berlaku saat itu.

### 3.1 Prinsip kesetaraan fitur

Kedua mode menuju editor struk yang sama. Pilihan hanya muncul bila data pendukung tersedia. Misalnya, **rating tertinggi** dinonaktifkan jika semua entri tanpa rating. Filter tahun/bulan hanya ditawarkan dalam rentang tanggal yang benar-benar ditemukan. Mode username memakai label tetap **"Diambil dari aktivitas publik terbaru"**; angka totalnya menyebut **"entri tersedia"**, bukan total akun.

Tidak ada penggabungan otomatis hasil CSV dan RSS dalam MVP, sehingga pengguna tidak mendapat duplikasi atau jumlah yang menyesatkan. Mengganti sumber meminta konfirmasi ringan bila pengaturan yang sudah dibuat akan hilang.

## 4. Alur pengguna

1. Halaman awal menampilkan nama Slipboxd, contoh struk, dan dua pilihan yang setara: **"Upload ekspor"** serta **"Pakai username"**. Penjelasan cakupan terlihat di bawah masing-masing pilihan.
2. **Upload ekspor:** tombol **"Buka halaman ekspor Letterboxd"** membuka `https://letterboxd.com/user/exportdata/` di tab baru. Setelah login dan mengunduh data, pengguna kembali untuk memilih ZIP atau `diary.csv`. Aplikasi membaca `diary.csv` dari ZIP secara otomatis.
3. **Pakai username:** pengguna mengisi username lalu menekan **"Muat aktivitas terbaru"**. Tampilkan status memuat. Jika berhasil, tampilkan jumlah entri yang dapat dipakai dan periode teramati; jika gagal, sediakan **"Coba lagi"** dan **"Upload ekspor"**.
4. Setelah sumber tervalidasi, pengguna masuk editor: isi nama pada struk, pilih rentang/urutan/jumlah, ubah template, lalu melihat preview yang langsung diperbarui.
5. Pengguna menekan **"Download PNG"**. Jika perangkat mendukung, **"Bagikan"** dapat membuka dialog berbagi; download selalu tersedia sebagai fallback. Pengguna dapat kembali mengubah pengaturan atau mengganti sumber.

**Copy untuk pilihan sumber:**

> Upload ekspor — Untuk membuat struk dari diary yang kamu ekspor sendiri. Terima file ZIP atau `diary.csv`.

> Pakai username — Cara cepat memakai aktivitas diary publik terbaru. Riwayat lama atau privat mungkin tidak tersedia.

Istilah **"Download Data Letterboxd"** tidak dipakai pada tombol yang hanya membuka halaman eksternal, karena klik tersebut belum memulai unduhan. Nama aksi harus sesuai perilakunya.

## 5. Kebutuhan fungsional

### 5.1 Impor ZIP / CSV

- Terima `.zip` resmi dan `diary.csv`; cocokkan ekstensi serta isi yang dapat dibaca. Tunjukkan pesan khusus untuk file rusak, ZIP tanpa diary, CSV dengan kolom yang tidak dikenali, file terlalu besar, dan file tanpa entri bertanggal.
- Parser CSV menangani UTF-8, baris ber-quote, koma di dalam judul, line break, dan header dengan spasi. Struktur kolom ekspor final diverifikasi memakai sampel ekspor asli sebelum implementasi dibekukan.
- Gunakan kolom **`Watched Date`** sebagai tanggal menonton. Kolom `Date` (tanggal entri/aktivitas) tidak boleh diam-diam menggantikannya. Baris tanpa tanggal menonton yang valid dilewati dari generator periode, dengan jumlah baris yang dilewati ditampilkan.
- Ambil judul, tahun rilis, URI film jika ada, rating 0,5–5 jika ada, penanda rewatch jika ada, dan tanggal menonton. Tidak meminta atau menyimpan review pribadi untuk kebutuhan receipt.
- Pembacaan file, normalisasi, dan komposisi struk berjalan di browser. Jangan kirim isi file ke route/server/analytics. Tutup atau buang referensi data dari memori aplikasi saat sumber diganti atau halaman ditutup.

### 5.2 Username / RSS publik

- Terima username yang wajar saja; trim spasi dan izinkan bentuk username Letterboxd, bukan URL arbitrer. Server membangun URL feed dari host yang ditetapkan aplikasi; pengguna tidak boleh menentukan domain tujuan.
- Route server mengambil RSS publik dengan timeout, batas respons, cache singkat, dan penanganan error. Jangan memakai kredensial Letterboxd, browser milik pengguna, scraping HTML, atau pengambilan berantai untuk mencari seluruh riwayat.
- Parse item diary yang punya tanggal menonton valid; abaikan item list/review yang tidak dapat dipetakan menjadi sesi menonton bertanggal. Gunakan field yang benar-benar hadir di RSS; field yang hilang tampil sebagai kosong/"—" dan tidak diisi dengan perkiraan.
- Nyatakan **jumlah entri dan rentang tanggal yang diterima**. Jangan mengubah jumlah dalam feed menjadi "total film akun" atau mengizinkan filter periode di luar data teramati seolah-olah hasilnya lengkap.
- Keadaan: username kosong/tidak valid, akun/feed tidak ditemukan, akun privat atau feed tidak tersedia, feed kosong, tidak ada entri diary valid, layanan sumber gagal, serta respons terlalu lambat. Semua keadaan menyediakan langkah pemulihan.

### 5.3 Model data normalisasi

Kedua sumber diubah menjadi bentuk internal berikut sebelum editor bekerja:

```ts
type WatchEntry = {
  source: 'export' | 'rss';
  filmKey: string;          // URI/ID stabil bila tersedia, fallback judul + tahun
  title: string;
  releaseYear?: number;
  watchedDate: string;      // tanggal kalender YYYY-MM-DD, tanpa konversi zona waktu
  rating?: number;          // 0.5 sampai 5
  rewatch?: boolean;
};
```

Satu sesi menonton = satu entri diary valid. Film yang sama ditonton pada tanggal berbeda tetap dua sesi. Jumlah film unik memakai `filmKey`. Jika sumber menyajikan item identik lebih dari sekali, lakukan deduplikasi hanya dengan identitas entri yang benar-benar stabil; jangan menghapus dua sesi yang kebetulan memiliki judul sama. Untuk entri dengan tanggal kalender, parse sebagai tanggal tanpa menggeser hari melalui UTC.

### 5.4 Editor dan preview

| Kontrol | Perilaku MVP |
| --- | --- |
| Nama pada struk | Input manual; default username dari mode RSS, kosong atau nama profil yang terverifikasi dari ekspor jika tersedia. Bisa diedit. |
| Judul struk | Input singkat dengan batas panjang dan contoh; default "My Movie Receipt". |
| Periode | Semua data tersedia, tahun tertentu, atau bulan tertentu; opsi dihitung dari entri valid. |
| Urutan | Terbaru, terlama, rating tertinggi (jika ada rating). Ikatan dipecahkan dengan tanggal lalu judul secara deterministik. |
| Jumlah baris | 10 atau 20; jika data kurang, tampilkan jumlah aktual. |
| Isi baris | Nomor, judul, tahun rilis jika ada, tanggal menonton, rating jika ada, indikator rewatch jika ada. |
| Template | Classic Receipt dan Cinema Ticket; keduanya memakai data yang sama. |
| Warna kertas | Putih atau krem, dengan teks tetap terbaca. |

Perubahan kontrol memperbarui preview tanpa tombol generate kedua. Judul panjang membungkus, kolom rating tidak bertabrakan dengan judul, dan ukuran kertas hasil menyesuaikan jumlah baris. Ringkasan di footer membedakan **sesi tersedia dalam periode**, **film unik dalam periode**, dan **baris yang ditampilkan**. Untuk mode RSS, ringkasan diberi label **"berdasarkan entri yang tersedia"**. Rating kosong memakai "—" dan tidak dihitung sebagai nol.

### 5.5 Unduhan dan berbagi

- PNG harus sesuai preview yang terlihat, tanpa tombol editor/overlay, dengan tipografi dan padding tetap terbaca setelah disimpan pada ponsel.
- Nama file yang aman, misalnya `slipboxd-andre-2026-10.png`; jangan memasukkan path atau karakter berbahaya dari input pengguna.
- Jika ekspor gagal, pertahankan pengaturan, tampilkan error, dan izinkan coba lagi. Berbagi menggunakan kemampuan perangkat bila ada; fallback mengunduh PNG.

## 6. UI, responsivitas, dan aksesibilitas

**Desktop:** preview kiri; panel **Isi** dan **Tampilan** kanan.  
**Mobile:** pilih sumber → editor satu kolom dengan preview di atas → kontrol di bawah; tombol download mudah ditemukan dan tidak menutupi konten. Preview proporsional mengikuti layar, file unduhan mempertahankan resolusi tinggi. Ponsel dapat memilih file dari Files/Downloads tanpa drag-and-drop.

Arah visual: bersih, editorial, nuansa struk bioskop; dua template cukup berbeda namun tidak meniru UI Receiptify secara identik. Ada contoh struk dari data fiktif pada landing; contoh diberi label "Contoh" agar tidak dikira hasil akun pengguna. Gunakan label yang tetap terlihat, status loading yang diumumkan, pesan kesalahan terkait inputnya, fokus keyboard jelas, serta dukungan pembesaran dan layar sentuh. Jangan membuat warna atau hover sebagai satu-satunya penanda status.

## 7. Keadaan dan pesan pemulihan

| Kondisi | Pesan inti | Aksi |
| --- | --- | --- |
| ZIP tanpa `diary.csv` | "Kami tidak menemukan diary.csv di file ini." | Pilih file lain / buka panduan ekspor |
| CSV tidak dikenali | "Format kolom diary tidak dikenali." | Pilih file lain; tampilkan kolom yang ditemukan tanpa menampilkan isi pribadi |
| Tidak ada tanggal tonton | "Belum ada entri diary bertanggal yang bisa dibuat struk." | Ganti file / panduan mencatat diary |
| Username/feed gagal | "Aktivitas publik belum bisa dimuat." | Coba lagi / upload ekspor |
| RSS hanya sedikit entri | "Kami menemukan N entri terbaru yang tersedia." | Lanjut / upload ekspor untuk cakupan lebih lengkap |
| Periode tanpa hasil | "Tidak ada entri dalam periode ini." | Pilih periode lain |
| Ekspor PNG gagal | "Gambar belum berhasil dibuat." | Coba lagi; pengaturan tidak hilang |

## 8. Ukuran keberhasilan dan validasi

**Outcome utama:** proporsi sesi pengguna yang berhasil mengunduh PNG setelah memilih sumber. Denominator: sesi yang memulai impor file atau submit username, dihitung terpisah per mode. Metrik pendukung: keberhasilan parsing file, keberhasilan memuat RSS, waktu sampai preview, error ekspor PNG, dan jumlah pengguna yang pindah dari mode username ke upload. Ini adalah definisi instrumentasi yang diusulkan, bukan baseline yang sudah diukur. Jangan mengirim judul film, nama pengguna, rating, atau isi ekspor ke analytics.

**Validasi sebelum rilis:** uji task di ponsel dan desktop dengan pengguna Letterboxd yang benar-benar memiliki diary; minta mereka membuat struk bulan tertentu dan mengunduhnya tanpa panduan. Amati apakah mereka paham cara ekspor, beda cakupan dua mode, dan arti total film. Periksa hasil PNG pada iPhone/Android dan keyboard desktop. Batas target kuantitatif ditetapkan setelah tes awal, bukan dikarang di dokumen ini.

## 9. Kriteria penerimaan rilis

1. Dari landing, dua metode input dapat dipilih tanpa akun Slipboxd; tombol ekspor membuka halaman resmi, bukan mengklaim file sudah diunduh.
2. ZIP Letterboxd dan `diary.csv` valid menghasilkan preview dari entri diary bertanggal tanpa mengirim konten file ke server.
3. Username publik dengan entri RSS diary valid menghasilkan preview dan label "aktivitas publik terbaru"; mode ini tidak menyebut total akun atau seluruh history.
4. Untuk kedua mode, perubahan periode, urutan, jumlah baris, judul, template, dan warna langsung tercermin pada preview dan PNG.
5. Sesi menonton ulang dihitung sebagai sesi; film unik tidak bertambah. Rating kosong tidak berubah menjadi nol; tanggal tidak bergeser satu hari.
6. Semua keadaan gagal utama menampilkan jalan keluar dan tidak menghapus pengaturan yang masih relevan.
7. Alur impor → edit → download dapat dijalankan lewat sentuhan pada ponsel dan keyboard desktop; gambar yang disimpan terbaca dan bebas kontrol editor.
8. Mode username hanya mengambil RSS dari domain Letterboxd yang ditetapkan dan tidak mengakses URL yang diberikan secara bebas oleh pengguna.

## 10. Risiko, asumsi, dan keputusan terbuka

- **RSS adalah feed terbaru, bukan arsip lengkap.** Jumlah dan isi item dapat berubah. Produk harus menyajikan keterbatasan ini dalam UI. Jika akses RSS bermasalah atau interpretasi ketentuan tidak mendukung penggunaan publiknya, nonaktifkan opsi username pada rilis dan pertahankan alur upload; ini keputusan gerbang rilis, bukan perubahan diam-diam pada data.
- **Skema ekspor dan RSS perlu diuji dengan sampel nyata.** Kolom, namespace, dan entri review/list dapat berbeda. Finalisasi parser setelah memeriksa contoh yang disediakan pengguna atau fixture nonpribadi yang diizinkan.
- **Penamaan Slipboxd:** belum ada pemeriksaan domain dan merek. Cantumkan disclaimer independen dan jangan memakai identitas visual Letterboxd seolah resmi.
- **Data film tambahan:** runtime, director, genre, poster memerlukan sumber metadata dan pencocokan judul/ID. Jangan menampilkan angka perkiraan pada MVP.

## 11. Urutan pembangunan

1. Siapkan fixture yang representatif untuk ekspor ZIP/CSV dan RSS: rating kosong, rewatch, judul dengan koma, tanggal tidak valid, judul sama, dan item non-diary.
2. Bangun parser serta normalisasi bersama; verifikasi jumlah sesi/film unik dan aturan tanggal.
3. Bangun dua input dan penanganan kegagalannya; route RSS memakai host tetap.
4. Bangun editor, dua template responsif, dan ekspor PNG.
5. Uji tugas end-to-end di desktop dan ponsel; periksa hasil file, aksesibilitas dasar, batas sumber, dan kejelasan copy.

**Selesai untuk MVP:** kriteria penerimaan di atas terpenuhi pada kedua mode; keputusan gerbang RSS diselesaikan sebelum rilis publik.
