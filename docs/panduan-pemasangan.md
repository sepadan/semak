# Panduan SEMAK — Dari Mula Sampai Siap

**Untuk:** Windows · akaun GitHub sedia ada · sistem SEMAK sudah berjalan dengan data sebenar

Anggaran masa: **45 minit** (Bahagian 1: 15 min, Bahagian 2: 25 min, ujian: 5 min)

---

## Faham dulu: dua tempat, dua tujuan berbeza

Ramai keliru di sini. Baca sekali sahaja, kemudian semuanya jadi mudah:

| | **GitHub** | **Apps Script** |
|---|---|---|
| Apa | Gudang simpanan kod | Tempat kod sebenarnya berjalan |
| Fungsi | Simpan setiap versi. Kalau rosak, boleh patah balik | Yang guru & admin guna setiap hari |
| Kalau padam | Kod masih berjalan seperti biasa | Sistem terus mati |

**Push ke GitHub TIDAK mengemas kini sistem anda.** Ia cuma menyimpan salinan.
Untuk sistem berubah, anda mesti tampal kod dalam Apps Script dan **deploy**.

Sebab itu ada dua bahagian dalam panduan ini. Buat kedua-duanya.

---

# BAHAGIAN 0 — Backup dulu (5 minit) ⚠️

**Jangan langkau ini.** Anda ada markah murid sebenar dalam sistem.

1. Buka spreadsheet **SEMAK v1**
2. Menu **📘 SEMAK** → **🛡️ Backup Fail Sekarang**
3. Tunggu mesej pengesahan muncul
4. Semak: Google Drive → folder **SEMAK - Sistem Markah** → **Backup** — patut ada fail baharu bertarikh hari ini

Sekarang walau apa pun berlaku, data anda selamat.

---

# BAHAGIAN 1 — GitHub (15 minit)

Matlamat: kod tersimpan di github.com, boleh dicapai dari mana-mana.

## 1.1 Pasang Git

1. Pergi ke **https://git-scm.com/download/win**
2. Muat turun akan bermula sendiri (pilih "64-bit Git for Windows Setup" jika tidak)
3. Buka fail yang dimuat turun → **Next** untuk semua skrin (tetapan lalai sudah betul) → **Install**
4. Selesai

> Kenapa perlu? Git ialah alat yang menghantar kod ke GitHub. Ia juga memasang
> "Git Credential Manager" yang uruskan login GitHub anda secara automatik —
> anda tak perlu ingat token atau apa-apa.

## 1.2 Unzip fail repo

1. Cari fail **`semak-github.zip`** yang saya hantar (biasanya dalam folder **Downloads**)
2. Klik kanan → **Extract All...** → **Extract**
3. Anda akan dapat folder bernama **`semak`**

Buka folder itu dan pastikan ada: folder `src`, folder `docs`, fail `README.md`.

## 1.3 Cipta repo kosong di GitHub

1. Pergi ke **https://github.com/new**
2. Isi:
   - **Repository name:** `semak`
   - **Description:** `Sistem markah sekolah — SK Paya Redan` (pilihan)
   - Pilih **Public**
3. ⚠️ **JANGAN tanda** mana-mana kotak ini:
   - ❌ Add a README file
   - ❌ Add .gitignore
   - ❌ Choose a license

   Kalau ditanda, repo jadi tak kosong dan push nanti akan gagal.
4. Klik **Create repository**
5. Halaman seterusnya akan tunjuk URL seperti `https://github.com/namaanda/semak.git` —
   **biarkan tab ini terbuka**, kita perlukan URL itu sekejap lagi

## 1.4 Push kod ke GitHub

1. Buka folder **`semak`** yang anda unzip tadi
2. Klik kanan pada ruang kosong dalam folder → **Open Git Bash here**

   > Tak nampak pilihan itu? Pada Windows 11, klik kanan → **Show more options**
   > → barulah **Open Git Bash here** muncul.

3. Satu tetingkap hitam akan terbuka. Taip arahan ini satu per satu, tekan **Enter** selepas setiap satu.

   **Arahan 1** — sambungkan folder ini dengan repo GitHub anda
   (ganti `namaanda` dengan username GitHub sebenar):

   ```
   git remote add origin https://github.com/namaanda/semak.git
   ```

   **Arahan 2** — hantar kod:

   ```
   git push -u origin main
   ```

4. Tetingkap browser akan muncul minta anda login GitHub → klik
   **Authorize** / **Sign in with your browser** → login seperti biasa
5. Kembali ke Git Bash. Kalau nampak baris seperti
   `branch 'main' set up to track 'origin/main'` — **berjaya**.

## 1.5 Sahkan

Muat semula (refresh) halaman repo GitHub anda. Anda patut nampak
folder `src`, `docs`, dan README dipaparkan di bawah senarai fail.

✅ **Bahagian 1 selesai.** Kod anda kini tersimpan kekal.

### Kalau tersangkut

| Mesej ralat | Sebab & penyelesaian |
|---|---|
| `remote origin already exists` | Sudah pernah taip arahan 1. Guna `git remote set-url origin https://github.com/namaanda/semak.git` |
| `Updates were rejected` | Repo GitHub tak kosong (ada README). Padam repo, cipta semula tanpa tanda apa-apa kotak |
| `repository not found` | Salah eja username atau nama repo. Semak semula URL |
| `git: command not found` | Git belum dipasang, atau perlu tutup dan buka semula Git Bash |

---

# BAHAGIAN 2 — Apps Script (25 minit)

Matlamat: ganti kod lama dengan versi bersih, tanpa menyentuh data markah.

> **Data anda tidak akan terjejas.** Kod dan data adalah dua benda berasingan.
> Kod ada dalam editor Apps Script; markah ada dalam tab spreadsheet
> (MURID, MARKAH, dan lain-lain). Menukar kod tidak menyentuh tab tersebut.

## 2.1 Buka editor

1. Buka spreadsheet **SEMAK v1**
2. Menu **Extensions** → **Apps Script**
3. Tab baharu terbuka. Di sebelah **kiri** ada senarai **Files** — anda patut
   nampak `Code.gs`, `AppBackend.gs`, `App.html`

## 2.2 Ganti kandungan tiga fail

Buat satu per satu. Corak yang sama untuk ketiga-tiganya:

**Untuk `Code.gs`:**

1. Dalam komputer, buka `semak\src\Code.gs` dengan **Notepad**
   (klik kanan → Open with → Notepad)
2. Tekan **Ctrl+A** (pilih semua) kemudian **Ctrl+C** (salin)
3. Kembali ke Apps Script, klik `Code.gs` dalam senarai kiri
4. Klik dalam ruang kod, tekan **Ctrl+A** kemudian **Delete**
5. Tekan **Ctrl+V** (tampal)

**Ulang perkara sama untuk:**
- `semak\src\AppBackend.gs` → fail `AppBackend.gs` dalam Apps Script
- `semak\src\App.html` → fail `App.html` dalam Apps Script

> ⚠️ Pastikan padam kandungan lama **sepenuhnya** sebelum tampal. Kalau kod
> lama dan baharu bercampur, sistem akan rosak.

Kemudian tekan **Ctrl+S** untuk simpan.

## 2.3 Kemas kini fail tetapan projek (appsscript.json)

Fail ini tersembunyi secara lalai:

1. Klik ikon **⚙️ Project Settings** (roda gear, sebelah kiri)
2. Tanda kotak **"Show 'appsscript.json' manifest file in editor"**
3. Kembali ke **Editor** (ikon `<>`) — sekarang `appsscript.json` muncul dalam senarai fail
4. Ganti kandungannya dengan isi `semak\src\appsscript.json` (cara sama seperti di atas)
5. **Ctrl+S**

> Fail ini menetapkan zon waktu ke Asia/Kuala_Lumpur dan kebenaran yang
> diperlukan sistem. Kalau anda langkau langkah ini pun sistem masih jalan,
> cuma tarikh "dikemaskini" mungkin guna zon waktu lain.

## 2.4 Deploy versi baharu ⚠️ LANGKAH PALING PENTING

**Ini yang paling ramai orang terlepas.** Menyimpan kod (Ctrl+S) tidak
mengubah apa yang guru nampak. Web app masih menyajikan kod lama sehingga
anda deploy versi baharu.

1. Butang **Deploy** (biru, atas kanan) → **Manage deployments**
2. Anda akan nampak deployment sedia ada. Klik ikon **✏️ pensel (Edit)** di atas kanan
3. Pada dropdown **Version**, pilih **New version**
4. Dalam **Description**, taip sesuatu yang bermakna, contoh:
   `Versi bersih — betulkan panel muat naik murid & tetapan sistem`
5. Klik **Deploy**
6. Klik **Done**

> ### ❌ JANGAN pilih "New deployment"
>
> "New deployment" mencipta **URL baharu**. Link lama yang guru sudah simpan
> (dan sambungan ke semak-skpr.web.app) akan terus tunjuk kod lama.
>
> Yang betul: **Manage deployments → Edit (pensel) → New version**.
> Cara ini kekalkan URL yang sama, cuma tukar kod di belakangnya.

## 2.5 Beri kebenaran (jika diminta)

Kalau skrin kebenaran muncul:

1. **Review permissions** → pilih akaun Google anda
2. Skrin amaran "**Google hasn't verified this app**" akan muncul — ini **normal**
   untuk skrip yang anda tulis sendiri, bukan tanda bahaya
3. Klik **Advanced** (kecil, bawah kiri) → **Go to SEMAK (unsafe)**
4. **Allow**

---

# BAHAGIAN 3 — Uji sistem (5 minit)

Buka web app anda dan semak satu per satu:

| # | Ujian | Patut berlaku |
|---|---|---|
| 1 | Buka web app | Dashboard muncul, carta terpapar |
| 2 | Login sebagai admin | Tab ⚙️ Tetapan muncul |
| 3 | Tetapan → Muat Naik Data Murid | **Panel ini kini berfungsi** (sebelum ini mati) |
| 4 | Tetapan → Sistem → butang Segerak & Backup | **Kini berfungsi** (sebelum ini mati) |
| 5 | Isi Markah → pilih kelas & subjek | Senarai murid dan markah sedia ada terpapar |
| 6 | Buka satu kelas, semak markah | **Markah lama masih ada** — data selamat |
| 7 | Cetak → Slip Keputusan | Slip terpapar dengan betul |

**Kalau ujian 6 gagal** (markah hilang) — berhenti, jangan buat apa-apa lagi,
beritahu saya. Backup di Bahagian 0 boleh pulihkan semuanya.

## ⛔ Jangan jalankan "Pasang Sistem"

Menu **📘 SEMAK → 🚀 Pasang Sistem** adalah untuk pemasangan **kali pertama sahaja**.
Sistem anda sudah dipasang. Menjalankannya semula tidak diperlukan dan
berisiko menambah rekod markah berganda.

---

# BAHAGIAN 4 — Selepas ini: rutin bila ada perubahan

Setiap kali kod berubah, kemas kini **kedua-dua tempat**. Urutan yang betul:

```
1. Baca dan kemas kini docs/SEMAK-Blueprint.md
        ↓
2. Ubah kod dalam folder semak di komputer
        ↓
3. Uji kod dan pastikan data sebenar tidak berubah
        ↓
4. Simpan kod + blueprint ke GitHub
        ↓
5. Tampal versi sama ke Apps Script
        ↓
6. Deploy versi baharu pada deployment sedia ada
```

**Langkah 2 dalam Git Bash** (klik kanan dalam folder `semak` → Open Git Bash here):

```
git add -A
git commit -m "Terangkan apa yang berubah di sini"
git push
```

Tiga arahan itu sahaja, setiap kali. `git add -A` kumpul semua perubahan,
`git commit` rekodkannya dengan catatan, `git push` hantar ke GitHub.

Tulis catatan commit yang bermakna — `"Betulkan ralat slip keputusan tahun 6"`
jauh lebih berguna daripada `"update"` bila anda cari semula enam bulan nanti.

---

# Kalau berlaku masalah

## Patah balik ke kod lama (Apps Script)

1. **Deploy** → **Manage deployments** → ✏️ **Edit**
2. Pada dropdown **Version**, pilih nombor versi yang lebih lama
3. **Deploy**

Sistem serta-merta kembali ke kod lama. Data tidak terjejas.

## Pulihkan data yang rosak

1. Google Drive → **SEMAK - Sistem Markah** → **Backup**
2. Cari fail backup bertarikh sebelum masalah berlaku
3. Klik kanan → **Make a copy**, atau buka dan salin tab yang diperlukan

## Web app tunjuk kod lama walaupun sudah deploy

Tekan **Ctrl+Shift+R** dalam browser (muat semula paksa). Browser kadangkala
simpan versi lama dalam cache.

---

# Rujukan pantas

| Perkara | Di mana |
|---|---|
| Repo GitHub | `https://github.com/namaanda/semak` |
| Kod di komputer | folder `semak\src\` |
| Editor Apps Script | Spreadsheet → Extensions → Apps Script |
| Backup | Drive → SEMAK - Sistem Markah → Backup |
| Struktur setiap sheet | `semak\docs\struktur-sheet.md` |
| Kata laluan admin lalai | `admin` — tukar segera jika belum |
| Kata laluan guru lalai | `guru` |

---

## Nanti bila sudah selesa: `clasp` (pilihan, tidak wajib)

Salin-tampal manual menjadi meleceh kalau kod kerap berubah. Alat bernama
**clasp** boleh hantar kod dari komputer terus ke Apps Script dengan satu arahan.

Sekali sahaja:

```
npm install -g @google/clasp
clasp login
```

Kemudian salin `.clasp.json.example` jadi `.clasp.json`, isikan **Script ID**
(dapatkan dari Apps Script → ⚙️ Project Settings → Script ID). Selepas itu,
setiap kali ada perubahan cuma taip:

```
clasp push
```

Ia menggantikan seluruh Bahagian 2.2 dan 2.3. **Deploy versi baharu (2.4)
masih perlu dibuat secara manual** — clasp hanya hantar kod, tidak deploy.

Perlukan Node.js dipasang dahulu (**https://nodejs.org** → versi LTS).
Buat ini nanti sahaja, selepas cara manual sudah berjaya sekali.
