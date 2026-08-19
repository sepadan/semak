# Struktur Sheet Pangkalan Data

Semua sheet ini dicipta automatik oleh **📘 SEMAK → 🚀 Pasang Sistem**.
Jangan ubah nama sheet atau susunan lajur — kod merujuk kedudukan lajur secara terus.

---

## `Sheet1` — sumber data murid (baca sahaja)

Eksport mentah dari APDM/iDMe. **Tidak pernah diubah oleh sistem.**
Baris data bermula pada **baris 8** (baris 1–7 ialah tajuk & header).

Lajur yang digunakan (indeks 0-based, seperti dalam `Code.gs`):

| Indeks | Lajur | Pemboleh ubah |
|---|---|---|
| 2 | NAMA | `S1_NAMA` |
| 3 | NO. PENGENALAN | `S1_IC` |
| 9 | TAHUN / TINGKATAN | `S1_TAHUN` |
| 10 | NAMA KELAS | `S1_KELAS` |
| 16 | JANTINA | `S1_JANTINA` |
| 18 | AGAMA | `S1_AGAMA` |

Baris **PRASEKOLAH** dilangkau automatik semasa segerak.

---

## `MURID` — daftar murid bersih

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| NAMA | JANTINA | KELAS | TAHUN | AGAMA | IC |

- `JANTINA`: `L` atau `P`
- `KELAS`: format `<digit tahun> <nama kelas>`, cth `4 BIJAK`
- `IC` ialah **ID unik murid** — digunakan untuk memadan rekod markah

Dijana semula sepenuhnya setiap kali **Segerak Data Murid** atau **Muat Naik CSV**.

---

## `MARKAH` — semua markah, semua peperiksaan

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| PEPERIKSAAN | KELAS | NAMA MURID | SUBJEK | MARKAH | TP | GURU | DIKEMASKINI | IC MURID |

- `MARKAH`: nombor 0–100, atau `TH` (tidak hadir), atau kosong
- `TP`: 1–6 (Tahun 1–3 manual; Tahun 4–6 dikira dari markah)
- `GURU`: `ADMIN`, nama guru, atau `IMPORT`
- `IC MURID` ialah kunci padanan sebenar; lajur `NAMA MURID` disimpan untuk
  rujukan manusia sahaja

Menyimpan markah akan **menggantikan semua baris** bagi kombinasi
peperiksaan + kelas + subjek yang sama.

---

## `TETAPAN` — konfigurasi sistem (tersembunyi)

| Sel | Kandungan |
|---|---|
| B2 | NAMA SEKOLAH |
| B3 | TAHUN |
| B4 | PEPERIKSAAN AKTIF (kosong = pengisian ditutup) |
| B5 | KATA LALUAN ADMIN |
| B6 | NAMA GURU BESAR |
| B7 | LOGO (ID fail Drive) |

⚠️ Mengandungi kata laluan — kekalkan sheet ini tersembunyi.

---

## `PEPERIKSAAN`

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| NAMA | KELAS SERTAI | SUBJEK TAHAP 1 | SUBJEK TAHAP 2 | KUNCI | KONFIGURASI KELAS-SUBJEK |

- Lajur **F** ialah sumber kebenaran: JSON `{"4 BIJAK":["B. MELAYU","SAINS"], ...}`
- Lajur B–D ialah ringkasan boleh baca sahaja (keserasian rekod lama)
- `KUNCI` = `YA` menutup pengisian markah untuk semua pengguna

---

## `SUBJEK` — senarai mata pelajaran

| A | B | C | D |
|---|---|---|---|
| NAMA | WARNA | TAHAP (1/2/kosong=semua) | SYARAT (ISLAM/BUKAN ISLAM/kosong=semua) |

- `TAHAP` = `1` untuk Tahun 1–3 sahaja, `2` untuk Tahun 4–6 sahaja
- `SYARAT` menapis ikut agama murid (cth PEND. ISLAM vs P. MORAL)

---

## `KELAS`

| A | B |
|---|---|
| KELAS | GURU KELAS |

Kelas dari data murid wujud automatik. Baris di sini digunakan untuk:
- kelas **manual** yang belum ada murid
- nama **guru kelas** untuk tandatangan pada slip keputusan

---

## `GURU` — senarai guru (tersembunyi)

| A | B |
|---|---|
| NAMA GURU | KATA LALUAN |

Guru baharu diberi kata laluan lalai `guru`.
⚠️ Mengandungi kata laluan — kekalkan sheet ini tersembunyi.

---

## `TUGASAN` — siapa mengajar apa

| A | B | C |
|---|---|---|
| KELAS | SUBJEK | GURU |

Satu subjek dalam satu kelas hanya boleh dipegang **seorang guru**.
Diurus oleh admin (Tetapan → Tugasan Guru) atau oleh guru sendiri
(tab 🧩 Tugasan Saya) — kedua-duanya menulis ke sheet yang sama.
