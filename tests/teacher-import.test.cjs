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

const doPost = backend.match(/function doPost\([\s\S]*?(?=\nfunction _jawapanRpcGitHub|$)/);
assert.ok(doPost, 'Penghala RPC mesti wujud');
assert.match(doPost[0], /apiImportGuru: apiImportGuru/,
  'apiImportGuru mesti disenaraikan dalam penghala RPC');
assert.match(doPost[0], /Upload\|Import\|Tetapkan/,
  'Import guru berjaya mesti membatalkan cache SEMAK');

console.log('Ujian import guru SEMAK lulus: admin, merge-only, tulisan pukal dan cache selamat.');
