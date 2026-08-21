# SEMAK - Blueprint Utama untuk AI dan Pembangun

> **Fail rujukan utama projek.** ChatGPT, Claude atau pembangun yang menyambung
> kerja mesti membaca fail ini dahulu. Setiap pembaikan fungsi mesti mengemas
> kini kod **dan** bahagian `Rekod perubahan` dalam fail ini pada commit yang sama.

## 1. Status semasa

| Perkara | Nilai |
|---|---|
| Sistem | SEMAK - Sistem Markah SK Paya Redan |
| Tarikh disahkan | 21 Ogos 2026 |
| Commit kod fungsi terkini | `HEAD` - Cache berlapis dan muatan selari seluruh sistem |
| Deployment Apps Script | Versi 52 |
| Deployment ID | `AKfycbx306dN8vd3HR3Mu4xdum8MpG0PkbbwbKgsu88jx-nMG2LnEWszU350S2ez8TU_kX_H` |
| URL pengguna | <https://sepadan.github.io/semak/> |
| URL API | <https://script.google.com/macros/s/AKfycbx306dN8vd3HR3Mu4xdum8MpG0PkbbwbKgsu88jx-nMG2LnEWszU350S2ez8TU_kX_H/exec> |
| Repo | <https://github.com/sepadan/semak> |
| Spreadsheet ID | `1Manu3uoLZNZpOn2_qQZ_6CAm25Qik1ddWHGyFN9UD1M` |
| Script ID | `1gklRY6IzLZ0bIpHyt0M-fHuCMup_WjcDSI1M_YjVbAlJkXkj0ePT4AcY` |
| Zon waktu | `Asia/Kuala_Lumpur` |

Blueprint PDF bertarikh 20 Ogos 2026 ialah rekod lama. Fail Markdown ini ialah
rujukan hidup yang perlu dikemas kini selepas setiap perubahan.

## 2. Peraturan yang tidak boleh dilanggar

1. **IC/MyKad ialah ID unik murid.** Nama hanya untuk paparan manusia.
2. Jangan ubah nama sheet atau susunan lajur tanpa migrasi dan kemas kini
   Dashboard SePadan.
3. Jangan jalankan `pasangSistem()` pada spreadsheet yang sedang beroperasi.
4. Jangan padam atau ubah data murid/markah untuk tujuan ujian.
5. Ujian simpan mesti menggunakan semakan tanpa tulis, salinan spreadsheet, atau
   data sementara yang dibuang semula.
6. Jangan commit fail CSV murid, kata laluan, token sesi atau data peribadi.
7. Kekalkan nama fungsi, pemboleh ubah, komen dan mesej pengguna dalam Bahasa
   Melayu.
8. GitHub dan Apps Script mesti mengandungi versi kod yang sama.
9. Kemas kini deployment sedia ada melalui **Manage deployments -> Edit -> New
   version**. Jangan cipta deployment baharu kerana URL pengguna mesti kekal.
10. Setiap pembaikan mesti mengemas kini `Rekod perubahan` dan `Ujian pengesahan`
    dalam blueprint ini.

## 3. Seni bina ringkas

```text
GitHub Pages: sepadan.github.io/semak
        |
        | index.html memuat src/App.html
        | App.html menghantar RPC melalui POST borang tersembunyi
        v
Apps Script Web App: doPost / fungsi api*
        |
        | SpreadsheetApp
        v
Google Sheets SEMAK v1
        |
        +--> Dashboard SePadan membaca agregat sahaja
```

Sistem tiada pangkalan data atau pelayan lain. Google Sheets ialah pangkalan data
tunggal. Apps Script ialah backend. GitHub Pages ialah paparan pengguna.

### Dua cara `App.html` berjalan

- **Apps Script asli:** `google.script.run` disediakan oleh Apps Script.
- **GitHub Pages:** `pasangJambatanAppsScript()` mencipta penyesuai
  `google.script.run` dan menghantar panggilan ke `HUJUNG_API` melalui `doPost`.

`HUJUNG_API` ditulis dalam `src/App.html`. Jika deployment ID berubah, GitHub
Pages akan gagal. Sebab itu deployment sedia ada mesti dikemas kini, bukan
diganti.

### Prestasi muatan awal

- `apiInit()` ialah laluan baca sahaja. Ia tidak boleh menjalankan migrasi IC
  untuk keseluruhan `MARKAH` setiap kali halaman dibuka. Pautan IC lama masih
  dilakukan dalam aliran pemasangan, segerak atau muat naik murid sebelum daftar
  murid diganti.
- Senarai `MURID` yang sudah dibaca oleh `apiInit()` dihantar kepada
  `getKelasSemua(murid)` supaya sheet yang sama tidak dibaca dua kali.
- `getTetapan()` membaca `B2:B7` dalam satu operasi kelompok.
- `getMuridPeperiksaan()` membaca snapshot calon sekali pada laluan biasa dan
  hanya menjalankan migrasi jika penanda migrasi benar-benar belum wujud.
- `INIT` dan analisis dashboard terakhir disimpan maksimum 30 minit dalam
  `sessionStorage`. Ketika refresh tab yang sama, paparan itu digunakan dahulu
  dan data langsung disegarkan di latar. Cache ini hilang apabila tab/browser
  ditutup dan tidak menggantikan Google Sheets sebagai sumber data sebenar.
- `index.html` menambah nombor versi pada `src/App.html` (contoh `?v=55`) supaya
  pelayar tidak terus menggunakan frontend lama selepas deployment baharu.
- Cache paparan hanya untuk kelajuan dan tidak digunakan bagi pengesahan sesi,
  kebenaran menyimpan atau sebarang operasi tulis.
- Bacaan `apiInit`, kelas, markah, status dan analisis menggunakan `CacheService`
  sebagai laluan pantas sehingga enam jam. Nilai besar dimampatkan; jika cache
  tiada atau dibuang Google, fungsi jatuh semula kepada bacaan Sheets biasa.
- Cache data pelayan mempunyai nombor revisi dalam `ScriptProperties`. Simpanan
  markah serta perubahan pentadbiran menaikkan revisi, jadi data lama tidak
  digunakan selepas perubahan berjaya.
- Isi Markah meminta senarai murid dan peta markah kelas sekali melalui
  `apiIsiKelas()`. Peta markah satu kelas diguna semula apabila guru menukar
  subjek dan disimpan dalam `sessionStorage` untuk refresh tab yang sama.
- Selepas login, kelas pertama yang mempunyai tugasan sah untuk guru (atau kelas
  pertama untuk admin) dipramuat bersama markahnya di latar.
- Status Pengisian dipramuat selepas sesi guru/admin disahkan. Apabila tab Status
  dibuka, cache dipaparkan segera sementara salinan terkini disegarkan di latar.
- `apiMula()` menghantar data permulaan bersama ringkasan analisis dalam satu RPC
  kecil. Jika cache analisis belum ada, ringkasan asas daripada `apiInit()`
  dipaparkan dahulu; analisis murid penuh dilengkapkan di latar selepas dashboard
  muncul dan serentak menyediakan cache Isi Markah serta Status.

## 4. Peta fail

| Fail | Tanggungjawab |
|---|---|
| `index.html` | Bingkai penuh yang memuatkan `src/App.html` di GitHub Pages |
| `src/Code.gs` | Pemalar, akses data, formula, pemasangan, segerak dan backup |
| `src/AppBackend.gs` | Login, sesi, semua API web, kawalan akses, `doGet`/`doPost` |
| `src/CalonBackend.gs` | Snapshot calon bagi setiap peperiksaan |
| `src/App.html` | Semua HTML, CSS, JavaScript, carta dan cetakan |
| `src/appsscript.json` | Zon waktu, runtime, web app dan skop OAuth |
| `docs/struktur-sheet.md` | Huraian terperinci sheet |
| `docs/panduan-pemasangan.md` | Cara memasang dan deploy |
| `docs/SEMAK-Blueprint.md` | Kontrak sistem dan rekod perubahan semasa |

### Hutang teknikal penting

- `AppBackend.gs` masih mempunyai salinan fungsi backend berganda. Takrifan yang
  berada kemudian berkuat kuasa. Jika fungsi berkaitan diubah, ubah **kedua-dua
  salinan** sehingga kerja pembersihan dibuat dan diuji.
- `App.html` mempunyai beberapa fungsi Isi Markah berganda. Versi terakhir
  berkuat kuasa.
- Jangan membersihkan kod berganda bersama pembaikan kecil yang tidak berkaitan.
  Buat sebagai perubahan berasingan dengan ujian regresi lengkap.

## 5. Skema data yang mesti dikekalkan

### `Sheet1` - sumber APDM/iDMe, baca sahaja

Data bermula pada baris 8. Indeks 0-based yang digunakan:

| Medan | Indeks |
|---|---:|
| Nama | 2 |
| IC/MyKad | 3 |
| Tahun | 9 |
| Kelas | 10 |
| Jantina | 16 |
| Agama | 18 |

Baris prasekolah dilangkau.

### `MURID`

```text
A NAMA | B JANTINA | C KELAS | D TAHUN | E AGAMA | F IC
```

- Dijana semula apabila data murid disegerak atau CSV dimuat naik.
- Rekod markah lama tidak dipadam; ia dipadankan semula menggunakan IC/MyKad.

### `MARKAH`

```text
A PEPERIKSAAN | B KELAS | C NAMA MURID | D SUBJEK | E MARKAH
F TP | G GURU | H DIKEMASKINI | I IC MURID
```

- Markah: `0-100`, `TH`, atau kosong.
- TP: `1-6`; Tahun 1-3 manual, Tahun 4-6 automatik.
- Simpan menggantikan blok `peperiksaan + kelas + subjek` yang sama.
- Sebelum `setValues`, backend menambah baris secara automatik jika jumlah rekod
  melebihi `getMaxRows()`.

### `TETAPAN`

| Sel | Nilai |
|---|---|
| B2 | Nama sekolah |
| B3 | Tahun |
| B4 | Peperiksaan aktif; kosong bermaksud pengisian ditutup |
| B5 | Kata laluan admin |
| B6 | Nama guru besar |
| B7 | ID logo Drive |

### `PEPERIKSAAN`

```text
A NAMA | B KELAS SERTAI | C SUBJEK TAHAP 1 | D SUBJEK TAHAP 2
E KUNCI | F KONFIGURASI KELAS-SUBJEK
```

- Lajur F ialah sumber kebenaran dalam bentuk JSON.
- Hanya satu peperiksaan boleh aktif pada satu masa melalui `TETAPAN!B4`.
- `KUNCI = YA` menutup pengisian bagi peperiksaan tersebut.
- Peperiksaan lama masih boleh dipilih untuk paparan dan cetakan.

### Sheet lain

| Sheet | Lajur utama | Fungsi |
|---|---|---|
| `SUBJEK` | Nama, warna, tahap, syarat | Senarai dan kelayakan subjek |
| `KELAS` | Kelas, guru kelas | Kelas manual dan tandatangan slip |
| `GURU` | Nama, kata laluan | Akaun guru; sheet tersembunyi |
| `TUGASAN` | Kelas, subjek, guru | Seorang guru bagi satu kelas-subjek |
| `CALON_PEPERIKSAAN` | Peperiksaan, IC, nama, jantina, kelas, tahun, agama, jenis | Snapshot murid mengikut peperiksaan |

## 6. Murid semasa dan peperiksaan lama

- `MURID` ialah senarai semasa.
- `CALON_PEPERIKSAAN` menyimpan snapshot calon bagi setiap peperiksaan.
- Murid berpindah tidak muncul dalam peperiksaan baharu selepas data murid
  disegerak, tetapi kekal dalam peperiksaan lama yang mempunyai snapshot.
- Murid baharu muncul dalam peperiksaan aktif selepas muat naik/segerak dan
  `segerakCalonPeperiksaanAktif()`.
- Semua padanan menggunakan IC/MyKad, bukan nama.

## 7. Peperiksaan dan pengisian markah

Syarat menyimpan markah:

1. Pengguna mempunyai sesi yang sah.
2. Peperiksaan dipilih ialah peperiksaan aktif.
3. Peperiksaan tidak dikunci.
4. Kelas terdapat dalam konfigurasi peperiksaan.
5. Subjek dipilih untuk kelas tersebut.
6. Guru ditugaskan kepada kombinasi kelas-subjek itu, atau pengguna ialah admin.
7. Setiap murid mempunyai IC/MyKad.
8. Markah dan TP berada dalam julat yang sah.

Peperiksaan lama atau dikunci boleh dipaparkan bersama markah dan calon sejarah,
tetapi tidak boleh diubah.

## 8. Sesi login - pelaksanaan semasa

Punca pepijat 21 Ogos 2026: `CacheService` membuang token baru serta-merta dalam
persekitaran projek ini. Guru kelihatan sudah login pada UI tetapi backend menolak
simpan dengan mesej `Sila login untuk menyimpan markah.`

Pelaksanaan yang betul sekarang:

- Token rawak dijana oleh `_ciptaSesi()`.
- `ScriptProperties` ialah stor utama sesi.
- `CacheService` hanya laluan pantas dan bukan sumber tunggal.
- Rekod sesi mempunyai masa `luput` enam jam.
- `sahkanSesi()` melanjutkan tempoh enam jam apabila sesi digunakan.
- Frontend memanggil `apiSemakSesi()` setiap lima minit dan apabila tab kembali
  aktif.
- Token pelayar disimpan dalam `sessionStorage`: kekal ketika refresh, hilang
  apabila tab/browser ditutup.
- `apiLogout()` memadam token di backend ketika pengguna menekan Keluar.
- Jika sesi tamat ketika menyimpan, UI meminta login semula tanpa mengosongkan
  markah yang sedang ditaip.

Jangan kembali kepada sesi yang bergantung pada `CacheService` sahaja.

## 9. Peranan dan tab

| Tab | Tanpa login | Guru | Admin |
|---|:---:|:---:|:---:|
| Dashboard | Ya | Ya | Ya |
| Isi Markah | Tidak | Ya | Ya |
| Status Pengisian | Tidak | Ya | Ya |
| Cetak | Tidak | Ya | Ya |
| Tugasan Saya | Tidak | Ya | Tidak |
| Tetapan | Tidak | Tidak | Ya |

Guru hanya boleh menyimpan tugasan sendiri. Admin boleh menyimpan semua
kelas-subjek yang dibenarkan oleh peperiksaan aktif.

## 10. API utama

### Baca

| Fungsi | Kegunaan |
|---|---|
| `apiInit()` | Identiti sekolah, peperiksaan, kelas, subjek, guru dan tugasan |
| `apiKelas(kelas, peperiksaan)` | Calon dan subjek bagi kelas/peperiksaan |
| `apiMarkah(peperiksaan, kelas)` | Peta markah berasaskan IC |
| `apiStatus(peperiksaan)` | Status lengkap/separa/kosong |
| `apiAnalisis(peperiksaan)` | Analisis sekolah, kelas, subjek dan murid |
| `apiSemakSesi(token)` | Sahkan dan lanjutkan sesi |

### Tulis

| Fungsi | Kebenaran |
|---|---|
| `apiSimpanMarkah(...)` | Guru yang ditugaskan atau admin |
| `apiSimpanTugasanGuru(...)` | Guru |
| `apiLogout(token)` | Pengguna bersesi |
| Fungsi tetapan `apiTambah*`, `apiPadam*`, `apiSimpan*` | Admin |

Semua fungsi yang perlu dipanggil dari GitHub Pages mesti berada dalam senarai
putih `dibenarkan` di dalam `doPost()`.

## 11. Formula

### Gred

| Markah | Gred |
|---:|:---:|
| 82-100 | A |
| 66-81 | B |
| 50-65 | C |
| 35-49 | D |
| 20-34 | E |
| bawah 20 | F |
| 0 atau TH | TH |

### TP Tahun 4-6

| Markah | TP |
|---:|:---:|
| 90-100 | 6 |
| 75-89 | 5 |
| 60-74 | 4 |
| 45-59 | 3 |
| 30-44 | 2 |
| bawah 30 | 1 |

Tahun 1-3 mengisi TP secara manual. TH dan kosong tidak dikira dalam GPMP,
GPS atau peratus lulus.

## 12. Cetakan

Empat hasil cetak dijana di klien daripada `apiAnalisis()`:

1. Slip keputusan semua murid.
2. Slip seorang murid.
3. Markah semua subjek mengikut kelas dalam orientasi landskap.
4. Laporan analisis kelas.

Slip mengandungi nama guru kelas dan guru besar. Ruang tandatangan ibu bapa
tidak memaparkan nama; hanya tandatangan dan tarikh.

## 13. Kontrak dengan Dashboard SePadan

Dashboard SePadan membaca SEMAK secara baca sahaja. Jangan ubah perkara berikut
tanpa mengemas kini penyambung `Semak.gs` dalam projek Dashboard SePadan:

- Susunan lajur `MARKAH` dan `MURID`.
- Teks `PEPERIKSAAN AKTIF` dalam `TETAPAN`.
- Lajur A dan F `PEPERIKSAAN`.
- Lajur A, E dan H `CALON_PEPERIKSAAN`.
- Format nama kelas.
- Ambang gred dan TP.

Tiada nama murid, IC atau markah individu boleh dieksport ke repo dashboard awam.

## 14. Ujian pengesahan

### Keputusan terakhir - 21 Ogos 2026

- Sebelum pengoptimuman, ujian muatan pertama GitHub Pages mengambil kira-kira
  23.0 saat sehingga dashboard tersedia.
- Sintaks `Code.gs`, `AppBackend.gs`, `CalonBackend.gs` dan semua skrip dalaman
  `App.html` lulus selepas pengoptimuman.
- Apps Script berjaya dikemas kini sebagai deployment versi 49 menggunakan
  deployment ID dan URL sedia ada.
- Ujian akhir URL utama GitHub Pages versi 49: muatan pertama sehingga dashboard
  tersedia kira-kira 13.6 saat; refresh tab yang sama memaparkan cache dashboard
  dalam kira-kira 0.7 saat sambil data langsung disegarkan di latar.
- Sintaks semua fail backend dan empat skrip dalaman `App.html` lulus untuk versi
  50. Deployment 50 berjaya diterbitkan pada ID yang sama; ujian masa sebenar
  Isi Markah dan Status dicatat selepas GitHub Pages menerima frontend v50.
- Deployment 51 menambah `apiMula()` pada senarai putih GitHub dan berjaya
  diterbitkan pada deployment ID yang sama.
- Angka ujian API langsung yang pernah dicatat untuk versi 51/52 ditarik balik:
  alat ujian menggunakan nama medan POST yang salah dan tidak benar-benar memanggil
  fungsi RPC. Prestasi selepas versi 53 mesti dinilai melalui UI GitHub Pages.
- Deployment 55 mengecilkan muatan awal kepada ringkasan dashboard, melengkapkan
  analisis murid di latar, dan menggabungkan senarai kelas serta markah ke dalam
  satu RPC `apiIsiKelas`. Analisis awal turut menyediakan cache semua kelas dan
  Status supaya kedua-dua paparan tidak membaca Sheets semula selepas login.
- Spreadsheet mempunyai 26 tab dan kira-kira 979,934 sel diperuntukkan, iaitu
  9.8% daripada had 10 juta sel.
- `MARKAH` mempunyai 8,538 baris maksimum dan baris terakhir digunakan. Kod kini
  menambah baris sebelum rekod baharu ditulis.
- 22/22 akaun guru lulus semakan kata laluan.
- 22/22 akaun guru berjaya mencipta dan mengesahkan sesi selepas migrasi ke
  `ScriptProperties`.
- 19/19 guru yang mempunyai tugasan aktif lulus semua semakan kebenaran simpan.
- Tiga guru belum mempunyai tugasan aktif: KHAIRUL IZAM BIN ABD SAMAT, ANIZAN
  BIN AB AZIZ dan AMIRAH BINTI SHEIKH ISMAIL.
- Dashboard GitHub Pages berjaya memuat data daripada deployment versi 48.
- Tiada markah atau data murid diubah semasa ujian.

### Senarai semak wajib selepas perubahan

- [ ] Sintaks `App.html`, `AppBackend.gs`, `Code.gs` dan `CalonBackend.gs` lulus.
- [ ] Dashboard memuat tanpa ralat.
- [ ] Login admin berjaya.
- [ ] Login guru berjaya dan sesi kekal selepas refresh.
- [ ] Pilihan peperiksaan lama memaparkan calon serta markah sejarah.
- [ ] Peperiksaan aktif memaparkan kelas dan subjek yang betul.
- [ ] Guru yang ditugaskan melepasi kebenaran simpan.
- [ ] Guru tanpa tugasan ditolak dengan mesej yang tepat.
- [ ] Peperiksaan dikunci tidak boleh disimpan.
- [ ] Tab MARKAH mempunyai ruang mencukupi sebelum `setValues`.
- [ ] Cetakan slip seorang/semua murid berfungsi.
- [ ] Cetakan markah kelas berorientasi landskap.
- [ ] Tiada data sebenar berubah semasa ujian teknikal.
- [ ] GitHub dan Apps Script sepadan.
- [ ] Deployment sedia ada dikemas kini dan URL kekal.
- [ ] Blueprint ini dikemas kini dalam commit yang sama.

## 15. Prosedur kerja untuk ChatGPT, Claude atau pembangun

1. Baca fail ini sepenuhnya.
2. Semak commit terkini dan kod sebenar; jangan bergantung pada perbualan lama.
3. Kenal pasti fungsi yang berkuat kuasa, terutama jika ada takrifan berganda.
4. Buat perubahan sekecil yang perlu dan jangan ubah data.
5. Jalankan ujian yang sepadan dengan risiko perubahan.
6. Kemas kini bahagian status, ujian dan rekod perubahan dalam fail ini.
7. Commit kod dan blueprint bersama-sama ke GitHub.
8. Salin versi sama ke Apps Script.
9. Deploy sebagai **New version** pada deployment ID sedia ada.
10. Uji URL GitHub Pages dan catat hasilnya di sini.

Format catatan perubahan:

```text
YYYY-MM-DD | commit | deployment | perubahan | ujian | kesan data
```

## 16. Rekod perubahan

| Tarikh | Commit | Deployment | Perubahan | Ujian | Kesan data |
|---|---|---:|---|---|---|
| 2026-08-21 | `HEAD` | 55 | Paparkan ringkasan asas tanpa menunggu analisis pada cache kosong; analisis penuh di latar menyediakan cache semua kelas+Status | Sintaks semua backend dan 5 skrip `App.html` lulus; ujian unit ringkasan, pakej Isi Markah dan pemanasan cache Status lulus | Tiada |
| 2026-08-21 | `deddb2d` | 54 | Sediakan cache semua kelas+Status ketika analisis awal | API selepas pemanasan: Isi Markah 1.63s, Status 1.31s; kerja analisis dialih keluar daripada laluan skrin pertama dalam v55 | Tiada |
| 2026-08-21 | `94d3d1d` | 53 | Ringkaskan muatan awal dan gabungkan data kelas+markah | Dashboard GitHub Pages 2.9s; cache Isi Markah 1.35s; bacaan pertama mendorong pemanasan awal tambahan dalam v54 | Tiada |
| 2026-08-21 | `920e68b` | 52 | Pramuat kelas bertugasan pertama dan markahnya selepas login supaya kelewatan bacaan pertama berlaku di latar | Sintaks lulus; deployment 52 pada ID sama. Angka API lama tidak sah dan tidak digunakan | Tiada |
| 2026-08-21 | `HEAD` | 51 | Gabungkan `apiInit` dan analisis dalam satu RPC `apiMula` untuk membuang muatan rangkaian berturutan | Sintaks lulus; deployment 51 pada ID sama | Tiada |
| 2026-08-21 | `HEAD` | 50 | Cache data pelayan berasaskan revisi, muatan kelas+markah selari, guna semula markah antara subjek, cache tab dan pramuat Status Pengisian | Sintaks backend/frontend lulus; deployment 50 pada ID sama | Tiada |
| 2026-08-21 | `HEAD` | 49 | Ringankan `apiInit`, bacaan tetapan dan snapshot calon; tambah paparan segera daripada cache tab sambil segar semula di latar; versi bingkai GitHub untuk elak frontend lama | Sintaks empat fail lulus; ujian akhir URL utama: muatan pertama 13.6s, refresh cache 0.7s; deployment 49 berjaya pada ID sama | Tiada |
| 2026-08-21 | `cfc8380` | 48 | Ganti sesi Cache sahaja dengan ScriptProperties + Cache, tambah `apiLogout` | 22/22 login dan sesi; 19/19 guru bertugasan lulus kebenaran simpan | Tiada |
| 2026-08-21 | `8b77198` | 47/48 | Tambah baris `MARKAH` secara automatik sebelum `setValues` | Metadata mengesahkan baris 8,538 telah digunakan | Tiada |
| 2026-08-21 | `d41f037` | 47/48 | Heartbeat sesi, login semula tanpa hilang markah ditaip | Sintaks dan simulasi sesi lulus | Tiada |
| 2026-08-21 | - | 48 | Cipta blueprint Markdown mesra AI sebagai rujukan utama | Semakan kandungan terhadap kod, Sheets dan blueprint PDF lama | Tiada |
