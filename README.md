# SEMAK — Sistem Markah Sekolah

Sistem permarkahan sekolah rendah berasaskan **Google Apps Script** + **Google Sheets**,
dipapar sebagai Web App. Dibangunkan untuk **SK Paya Redan**.

- Web App/PWA: https://sepadan.github.io/semak/
- Pangkalan data: Google Sheets (`SEMAK v1`)

---

## Ciri utama

| Modul | Keterangan |
|---|---|
| 📈 Dashboard | GPMP, % lulus, taburan gred, analisis per kelas & per murid |
| 📝 Isi Markah | Guru isi markah subjek yang ditugaskan; gred & TP dikira automatik |
| 📊 Status Pengisian | Matriks kelas × subjek — siapa sudah/belum isi |
| 🖨️ Cetak | Slip keputusan, markah semua subjek, laporan analisis kelas |
| 🧩 Tugasan Saya | Guru tetapkan sendiri subjek yang diajar (sinkron dengan admin) |
| ⚙️ Tetapan | Identiti sekolah, peperiksaan, tugasan guru, subjek, kelas, muat naik CSV murid |

Senarai guru juga boleh digabungkan dari **Tetapan Guru HADIR**. Import ini
tidak memadam guru atau kata laluan sedia ada, dan pengurusan guru terus dalam
SEMAK kekal berfungsi seperti biasa.

Upload murid atau guru dalam SEMAK turut menyelaraskan data asas melalui HADIR
ke AKSI. Markah, peperiksaan, subjek, tugasan, calon, sesi dan kata laluan tidak
dikongsi; semua syarat serta kebenaran SEMAK terus berkuat kuasa.

**Peranan:** Admin (akses penuh) dan Guru (hanya kelas + subjek yang ditugaskan).
Sesi disahkan melalui token rawak 6 jam dalam `ScriptProperties`, dengan
`CacheService` sebagai laluan pantas — kata laluan tidak disimpan dalam pelayar.

---

## Struktur repo

```
semak/
├─ AGENTS.md               # arahkan ChatGPT/Codex kepada blueprint utama
├─ CLAUDE.md               # arahkan Claude kepada blueprint utama
├─ index.html              # bingkai GitHub Pages dan status versi PWA
├─ manifest.webmanifest    # identiti pemasangan Android/iPhone
├─ pwa.js                  # pemasangan + semakan kemas kini automatik
├─ service-worker.js       # cache fail aplikasi sahaja, bukan data/markah
├─ offline.html            # mesej apabila internet tiada
├─ icons/                  # ikon SEMAK 32/48/180/192/512
├─ src/                     # kod yang di-push ke Apps Script (rootDir clasp)
│  ├─ Code.gs               # teras: konfigurasi, akses data, pemasangan, backup
│  ├─ AppBackend.gs         # API web app (api*) + kawalan akses
│  ├─ App.html              # antara muka penuh (HTML + CSS + JS)
│  └─ appsscript.json       # manifes projek
├─ docs/
│  ├─ SEMAK-Blueprint.md    # rujukan utama untuk AI/pembangun + rekod perubahan
│  ├─ struktur-sheet.md     # skema setiap sheet pangkalan data
│  └─ panduan-pemasangan.md # panduan langkah demi langkah (GitHub + Apps Script)
├─ .clasp.json.example      # salin ke .clasp.json dan isi scriptId anda
├─ .gitignore
├─ LICENSE
└─ README.md
```

## Pemasangan PWA

Versi semasa ialah **SEMAK v1.1.0 · PWA**. Pada Android gunakan pilihan
**Install app/Tambah ke skrin utama**. Pada iPhone buka melalui Safari → Share →
**Add to Home Screen**.

SEMAK menyemak versi baharu setiap kali dibuka dan memasangnya secara automatik.
Halaman yang sedang digunakan tidak dimuat semula secara paksa supaya markah
yang belum disimpan tidak hilang; versi baharu digunakan apabila aplikasi dibuka
semula. PWA hanya mencache fail statik dan tidak mencache markah, token, sesi,
data murid atau jawapan Apps Script.

> **Menyambung kerja dengan ChatGPT atau Claude?** Baca
> [`docs/SEMAK-Blueprint.md`](docs/SEMAK-Blueprint.md) dahulu. Setiap perubahan
> fungsi mesti mengemas kini blueprint itu dalam commit yang sama.

---

## Pemasangan

### 1. Sediakan spreadsheet

Spreadsheet mesti mempunyai tab **`Sheet1`** — eksport mentah senarai murid dari
APDM/iDMe. Baris data bermula pada baris 8; pemetaan lajur (0-based) ada dalam
`Code.gs`:

```js
var S1_NAMA = 2, S1_IC = 3, S1_JANTINA = 16, S1_TAHUN = 9, S1_KELAS = 10, S1_AGAMA = 18;
```

### 2. Push kod

**Cara A — clasp (disyorkan):**

```bash
npm install -g @google/clasp
clasp login
cp .clasp.json.example .clasp.json     # isi scriptId dari Apps Script > Project Settings
clasp push
```

**Cara B — salin manual:** buka Extensions → Apps Script, cipta fail
`Code.gs`, `AppBackend.gs`, `App.html`, kemudian tampal kandungan dari `src/`.

### 3. Jalankan pemasangan

Muat semula spreadsheet → menu **📘 SEMAK** → **🚀 Pasang Sistem (Sekali Sahaja)**.

Ini akan: backup penuh → cipta sheet sistem → import murid dari Sheet1 →
import markah dari tab kelas lama (jika ada).

### 4. Deploy Web App

Apps Script → **Deploy → New deployment → Web app**
- Execute as: **Me**
- Who has access: ikut keperluan sekolah

### 5. Login pertama

Kata laluan admin lalai: **`admin`** — **tukar segera** melalui
Tetapan → Sistem → Tukar kata laluan admin.
Guru baharu diberi kata laluan lalai **`guru`**.

---

## Formula gred & TP

**Gred** (semua tahun):

| Markah | 82+ | 66–81 | 50–65 | 35–49 | 20–34 | <20 | 0 / kosong |
|---|---|---|---|---|---|---|---|
| Gred | A | B | C | D | E | F | TH |

**TP** (Tahun 4–6, dikira automatik; Tahun 1–3 diisi manual):

| Markah | 90+ | 75–89 | 60–74 | 45–59 | 30–44 | <30 |
|---|---|---|---|---|---|---|
| TP | 6 | 5 | 4 | 3 | 2 | 1 |

**GPMP** = purata gred point (A=1 … F=6). Nilai **rendah lebih baik**.

---

## Nota keselamatan

Sistem ini direka untuk kegunaan dalaman sekolah, bukan data awam.
Perkara yang perlu diketahui:

- Kata laluan admin & guru disimpan sebagai **teks biasa** dalam sheet
  `TETAPAN` dan `GURU`. Kedua-dua sheet disembunyikan semasa pemasangan,
  tetapi sesiapa yang ada akses edit pada spreadsheet boleh melihatnya.
  **Jangan kongsi spreadsheet dengan sesiapa yang tidak sepatutnya jadi admin.**
- Token sesi tamat selepas 6 jam, disimpan di backend melalui
  `ScriptProperties` + cache, dan disimpan dalam `sessionStorage` pelayar.
- `apiInit`, `apiKelas`, `apiMarkah`, `apiStatus`, `apiAnalisis` tidak
  memerlukan login — sesiapa yang ada URL web app boleh melihat markah.
  Hadkan akses deployment jika ini tidak diingini.
- Backup automatik dibuat sebelum operasi berisiko (pemasangan, padam tab lama,
  padam peperiksaan dengan pilihan backup) ke folder Drive
  `SEMAK - Sistem Markah/Backup/`.

---

## Sumbangan

Sebelum menghantar perubahan:

1. Uji dalam salinan spreadsheet, bukan fail sebenar sekolah.
2. Jangan commit data murid sebenar (fail `.csv` dan folder `data/` sudah
   diabaikan dalam `.gitignore`).
3. Kekalkan komen dan nama fungsi dalam Bahasa Melayu untuk konsistensi.

## Lesen

MIT — lihat [LICENSE](LICENSE).
