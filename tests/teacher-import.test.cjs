const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const backend = fs.readFileSync(path.join(__dirname, '..', 'src', 'AppBackend.gs'), 'utf8');
const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'Code.gs'), 'utf8');
const calon = fs.readFileSync(path.join(__dirname, '..', 'src', 'CalonBackend.gs'), 'utf8');
assert.doesNotThrow(() => new vm.Script(backend), 'AppBackend.gs: sintaks mesti sah');
assert.doesNotThrow(() => new vm.Script(code), 'Code.gs: sintaks mesti sah');
assert.doesNotThrow(() => new vm.Script(calon), 'CalonBackend.gs: sintaks mesti sah');

const importGuru = backend.match(
  /function apiImportGuru\([\s\S]*?(?=\nfunction |$)/
);
assert.ok(importGuru, 'API import guru HADIR mesti wujud');
assert.match(importGuru[0], /semakAdmin\(kata\)/,
  'Import guru mesti memerlukan pengesahan admin');
assert.match(importGuru[0], /simpanSenaraiGuruSemak_\(senaraiGuru, mod\)/,
  'Import guru mesti menggunakan penulis status berpusat');
assert.doesNotMatch(importGuru[0], /clear(?:Contents)?\(|deleteRow\(/,
  'Import guru merge-only tidak boleh memadam guru sedia ada');
assert.match(importGuru[0], /Kata laluan dan sejarah dikekalkan/,
  'Kontrak pemeliharaan kata laluan mesti jelas');
assert.match(importGuru[0], /asalSync[\s\S]*!== "HADIR"/,
  'Import guru daripada HADIR tidak boleh mencetuskan relay semula');

const uploadMuridSemua = [...backend.matchAll(/function apiUploadMurid\(senarai, kata, asalSync\)/g)];
assert.equal(uploadMuridSemua.length, 2,
  'Kedua-dua takrif apiUploadMurid yang masih wujud mesti menerima penanda asal');
const blokUploadMurid = [...backend.matchAll(
  /function apiUploadMurid\(senarai, kata, asalSync\) \{[\s\S]*?(?=\nfunction |$)/g
)];
assert.equal(blokUploadMurid.length, 2);
blokUploadMurid.forEach((padan, i) => {
  assert.match(padan[0], /LockService\.getScriptLock\(\)/,
    `apiUploadMurid salinan ${i + 1} mesti mengunci ganti penuh MURID`);
  assert.match(padan[0], /finally[\s\S]*lock\.releaseLock\(\)/,
    `apiUploadMurid salinan ${i + 1} mesti sentiasa melepaskan kunci`);
  assert.match(padan[0], /segerakCalonPeperiksaanAktif\(true\)[\s\S]*finally[\s\S]*lock\.releaseLock\(\)/,
    `apiUploadMurid salinan ${i + 1} mesti mengemas kini MURID dan calon di bawah kunci yang sama`);
});
const blokSimpanPeperiksaan = [...backend.matchAll(
  /function apiSimpanPeperiksaan\(nama, konfigurasi, kunci, kata\) \{[\s\S]*?(?=\nfunction |$)/g
)];
assert.equal(blokSimpanPeperiksaan.length, 2);
blokSimpanPeperiksaan.forEach((padan, i) => {
  assert.match(padan[0], /LockService\.getScriptLock\(\)/,
    `apiSimpanPeperiksaan salinan ${i + 1} mesti mengunci konfigurasi`);
});
const blokSimpanMarkah = [...backend.matchAll(
  /function apiSimpanMarkah\(peperiksaan, namaKelas, subjek, data, auth\) \{[\s\S]*?(?=\nfunction |$)/g
)];
assert.equal(blokSimpanMarkah.length, 2);
blokSimpanMarkah.forEach((padan, i) => {
  assert.match(padan[0], /lock\.waitLock\(20000\)[\s\S]*_semakKebenaranSimpan\(/,
    `apiSimpanMarkah salinan ${i + 1} mesti menyemak semula kebenaran selepas mendapat kunci`);
});
const blokSegerakMurid = code.match(/function segerakMurid\([\s\S]*?(?=\nfunction |$)/)[0];
assert.match(blokSegerakMurid,
  /LockService\.getScriptLock\(\)/,
  'Segerak MURID dari Sheet1 mesti dikunci');
assert.match(blokSegerakMurid,
  /segerakCalonPeperiksaanAktif\(true\)[\s\S]*finally[\s\S]*lock\.releaseLock\(\)/,
  'Segerak MURID dan calon mesti dibuat di bawah kunci yang sama tanpa kunci bersarang');
const blokSegerakCalonAktif = calon.match(
  /function segerakCalonPeperiksaanAktif\(sudahDikunci\)[\s\S]*?(?=\nfunction |$)/
);
assert.ok(blokSegerakCalonAktif, 'Penyelaras calon aktif mesti menerima konteks kunci');
assert.match(blokSegerakCalonAktif[0],
  /waitLock\(20000\)[\s\S]*segerakCalonPeperiksaan\(aktif, null, true\)/,
  'Penyelaras calon aktif awam mesti memegang kunci sebelum menyerahkan kerja');
const blokSegerakCalon = calon.match(
  /function segerakCalonPeperiksaan\(peperiksaan, murid, sudahDikunci\)[\s\S]*?(?=\nfunction |$)/
);
assert.ok(blokSegerakCalon, 'Penulis calon mesti menyokong panggilan apabila kunci sudah dipegang');
assert.match(blokSegerakCalon[0],
  /waitLock\(20000\)[\s\S]*murid = murid \|\| getMuridSemua\(\)/,
  'Penulis calon awam mesti membaca MURID hanya selepas memperoleh kunci');
const blokTetapkanAktif = [...backend.matchAll(
  /function apiTetapkanAktif\(nama, kata\) \{[\s\S]*?(?=\nfunction |$)/g
)];
assert.equal(blokTetapkanAktif.length, 2);
blokTetapkanAktif.forEach((padan, i) => {
  assert.match(padan[0], /LockService\.getScriptLock\(\)[\s\S]*waitLock\(20000\)/,
    `apiTetapkanAktif salinan ${i + 1} mesti berkongsi kunci dengan simpan markah`);
  assert.match(padan[0], /pastikanSnapshotCalonPeperiksaan\(nama, true\)/,
    `apiTetapkanAktif salinan ${i + 1} tidak boleh mengambil kunci calon bersarang`);
});
assert.match(calon,
  /function pastikanSnapshotCalonPeperiksaan\(peperiksaan, sudahDikunci\)/,
  'Pencipta snapshot calon mesti menerima konteks kunci');
const simpanGuruSemua = [...backend.matchAll(/function apiSimpanGuru\(senaraiGuru, guruBesar, kata, asalSync\)/g)];
assert.equal(simpanGuruSemua.length, 2,
  'Kedua-dua takrif apiSimpanGuru mesti menyokong relay tanpa gelung');
assert.match(backend, /function sepadanHantarKeHadirSemak_/,
  'Relay SEMAK ke HADIR mesti wujud');
assert.match(backend, /getProperty\("SEPADAN_SYNC_SECRET"\)/,
  'Rahsia relay mesti dibaca daripada Script Properties');
assert.doesNotMatch(backend, /SEPADAN_SYNC_SECRET\s*=/,
  'Nilai rahsia relay tidak boleh disimpan dalam kod');
assert.match(backend, /kaedah: jenis === "guru" \? "terimaSyncGuru" : "terimaSyncMurid"/,
  'Relay mesti membezakan muatan guru dan murid');
assert.match(backend, /argumen: \[senarai \|\| \[\], "SEMAK", rahsia, String\(mod/,
  'Relay mesti menanda SEMAK sebagai sumber');
assert.match(code, /function simpanSenaraiGuruSemak_[\s\S]*LockService\.getScriptLock\(\)[\s\S]*TIDAK AKTIF/,
  'Penulis guru berpusat mesti dikunci dan menggunakan status tidak aktif');
assert.doesNotMatch(code.match(/function simpanSenaraiGuruSemak_[\s\S]*?(?=\nfunction |$)/)[0], /clear(?:Contents)?\(|deleteRow\(/,
  'Guru tidak boleh dipadam secara fizikal');

const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.html'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8');
assert.match(app, /Semua sistem telah diselaraskan/,
  'Paparan mesti memberitahu keputusan penyelarasan');
assert.match(index, /SEMAK v1\.2\.0 · PWA/,
  'Versi paparan SEMAK mesti dinaikkan');
assert.match(index, /src\/App\.html\?v=61/,
  'Iframe SEMAK mesti memintas cache App.html lama');
assert.match(worker, /semak-shell-v1\.2\.0-20260828-6/,
  'Cache Service Worker SEMAK mesti dinaikkan');
const subjekSertaiSemua = [...app.matchAll(
  /function subjekSertai\(cfg, kelas\) \{[\s\S]*?\n\}/g
)];
assert.ok(subjekSertaiSemua.length >= 2, 'Takrif aktif subjekSertai tidak ditemui');
assert.match(subjekSertaiSemua.at(-1)[0], /cfg\.subjekT1[\s\S]*cfg\.subjekT2/,
  'Takrif aktif subjekSertai mesti menyokong lajur T1/T2 peperiksaan lama');

const doPost = backend.match(/function doPost\([\s\S]*?(?=\nfunction _jawapanRpcGitHub|$)/);
assert.ok(doPost, 'Penghala RPC mesti wujud');
assert.match(doPost[0], /apiImportGuru: apiImportGuru/,
  'apiImportGuru mesti disenaraikan dalam penghala RPC');
assert.match(doPost[0], /Upload\|Import\|Tetapkan/,
  'Import guru berjaya mesti membatalkan cache SEMAK');

console.log('Ujian guru SEMAK lulus: admin, gabung/sync penuh, status, relay dan cache selamat.');
