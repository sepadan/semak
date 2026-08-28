const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const backend = fs.readFileSync(path.join(__dirname, '..', 'src', 'AppBackend.gs'), 'utf8');
assert.doesNotThrow(() => new vm.Script(backend), 'AppBackend.gs: sintaks mesti sah');

const importGuru = backend.match(
  /function apiImportGuru\([\s\S]*?(?=\nfunction |$)/
);
assert.ok(importGuru, 'API import guru HADIR mesti wujud');
assert.match(importGuru[0], /semakAdmin\(kata\)/,
  'Import guru mesti memerlukan pengesahan admin');
assert.match(importGuru[0], /LockService\.getScriptLock\(\)/,
  'Import guru mesti dilindungi daripada tulisan serentak');
assert.match(importGuru[0], /setValues\(baris\)/,
  'Guru baharu mesti ditulis secara pukal');
assert.doesNotMatch(importGuru[0], /clear(?:Contents)?\(|deleteRow\(/,
  'Import guru merge-only tidak boleh memadam guru sedia ada');
assert.match(importGuru[0], /KATAGURU_LALAI/,
  'Guru baharu perlu menerima kata laluan lalai SEMAK');
assert.match(importGuru[0], /Kata laluan dan guru sedia ada dikekalkan/,
  'Kontrak pemeliharaan kata laluan mesti jelas');
assert.match(importGuru[0], /asalSync[\s\S]*!== "HADIR"/,
  'Import guru daripada HADIR tidak boleh mencetuskan relay semula');

const uploadMuridSemua = [...backend.matchAll(/function apiUploadMurid\(senarai, kata, asalSync\)/g)];
assert.equal(uploadMuridSemua.length, 2,
  'Kedua-dua takrif apiUploadMurid yang masih wujud mesti menerima penanda asal');
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
assert.match(backend, /argumen: \[senarai \|\| \[\], "SEMAK", rahsia\]/,
  'Relay mesti menanda SEMAK sebagai sumber');

const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.html'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8');
assert.match(app, /Semua sistem telah diselaraskan/,
  'Paparan mesti memberitahu keputusan penyelarasan');
assert.match(index, /SEMAK v1\.1\.0 · PWA/,
  'Versi paparan SEMAK mesti dinaikkan');
assert.match(index, /src\/App\.html\?v=60/,
  'Iframe SEMAK mesti memintas cache App.html lama');
assert.match(worker, /semak-shell-v1\.1\.0-20260828-5/,
  'Cache Service Worker SEMAK mesti dinaikkan');

const doPost = backend.match(/function doPost\([\s\S]*?(?=\nfunction _jawapanRpcGitHub|$)/);
assert.ok(doPost, 'Penghala RPC mesti wujud');
assert.match(doPost[0], /apiImportGuru: apiImportGuru/,
  'apiImportGuru mesti disenaraikan dalam penghala RPC');
assert.match(doPost[0], /Upload\|Import\|Tetapkan/,
  'Import guru berjaya mesti membatalkan cache SEMAK');

console.log('Ujian import SEMAK lulus: admin, merge-only, relay murid/guru dan cache selamat.');
