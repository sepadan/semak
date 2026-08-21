// ================================================================
// SENARAI CALON MENGIKUT PEPERIKSAAN
//
// Setiap peperiksaan menyimpan salinan muridnya sendiri. IC/MyKad
// ialah pengenal utama. Sheet ini diwujudkan secara automatik dan
// disembunyikan supaya tidak mengganggu helaian kerja harian.
// ================================================================

var SH_CALON_PEPERIKSAAN = "CALON_PEPERIKSAAN";
var REKOD_CALON = "CALON";
var REKOD_SNAPSHOT = "SNAPSHOT";
var PENANDA_MIGRASI_CALON = "__MIGRASI_SISTEM__";

function _teksCalon(v) {
  return v == null ? "" : v.toString().trim();
}

function _kunciCalon(m) {
  var ic = _teksCalon(m.ic);
  if (ic) return "IC|" + ic;
  return "NAMA|" + _teksCalon(m.kelas).toUpperCase() + "|" +
    _teksCalon(m.nama).toUpperCase();
}

function _sheetCalonPeperiksaan(cipta) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s = ss.getSheetByName(SH_CALON_PEPERIKSAAN);
  if (!s && cipta === false) return null;
  if (!s) s = ss.insertSheet(SH_CALON_PEPERIKSAAN);

  // Laluan bacaan biasa tidak perlu mengubah freeze/hide/header setiap kali.
  if (cipta === false) return s;

  var tajuk = ["PEPERIKSAAN", "IC/MYKAD", "NAMA", "JANTINA", "KELAS", "TAHUN", "AGAMA", "JENIS_REKOD"];
  if (s.getLastRow() === 0) s.getRange(1, 1, 1, tajuk.length).setValues([tajuk]);
  else if (!_teksCalon(s.getRange(1, 1).getValue())) s.getRange(1, 1, 1, tajuk.length).setValues([tajuk]);

  s.setFrozenRows(1);
  try { s.hideSheet(); } catch (e) {}
  return s;
}

function _barisCalonDalamSheet() {
  var s = _sheetCalonPeperiksaan(false);
  if (!s || s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, 8).getValues();
}

function _adaSnapshotCalon(peperiksaan, baris) {
  peperiksaan = _teksCalon(peperiksaan);
  baris = baris || _barisCalonDalamSheet();
  return baris.some(function (r) {
    return _teksCalon(r[0]) === peperiksaan && _teksCalon(r[7]) === REKOD_SNAPSHOT;
  });
}

function _barisSnapshot(peperiksaan, murid) {
  var hasil = [[peperiksaan, "", "", "", "", "", "", REKOD_SNAPSHOT]];
  var sudah = {};
  (murid || []).forEach(function (m) {
    var kunci = _kunciCalon(m);
    if (!kunci || sudah[kunci]) return;
    sudah[kunci] = true;
    hasil.push([
      peperiksaan,
      _teksCalon(m.ic),
      _teksCalon(m.nama),
      _teksCalon(m.jantina),
      _teksCalon(m.kelas),
      _teksCalon(m.tahun),
      _teksCalon(m.agama),
      REKOD_CALON
    ]);
  });
  return hasil;
}

function _calonLamaDaripadaMarkah(peperiksaan, muridSemasa, db) {
  var ikutIC = {};
  (muridSemasa || []).forEach(function (m) {
    var ic = _teksCalon(m.ic);
    if (ic) ikutIC[ic] = m;
  });

  var sudah = {};
  var hasil = [];
  (db || []).forEach(function (r) {
    if (_teksCalon(r[0]) !== peperiksaan) return;
    var ic = _teksCalon(r[8]);
    var nama = _teksCalon(r[2]);
    var kelas = _teksCalon(r[1]);
    var kunci = ic ? "IC|" + ic : "NAMA|" + kelas.toUpperCase() + "|" + nama.toUpperCase();
    if (!nama || sudah[kunci]) return;
    sudah[kunci] = true;

    var asal = ic && ikutIC[ic] ? ikutIC[ic] : {};
    hasil.push({
      ic: ic,
      nama: nama,
      jantina: _teksCalon(asal.jantina),
      kelas: kelas,
      tahun: _teksCalon(asal.tahun) || (kelas.match(/^[1-6]/) || [""])[0],
      agama: _teksCalon(asal.agama)
    });
  });
  return hasil;
}

// Migrasi sekali: peperiksaan aktif menggunakan senarai MURID semasa;
// peperiksaan lama dibina daripada rekod MARKAH supaya sejarahnya kekal.
function migrasiCalonPeperiksaanSekali() {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var s = _sheetCalonPeperiksaan();
    var sedia = s.getLastRow() > 1 ? s.getRange(2, 1, s.getLastRow() - 1, 8).getValues() : [];
    var selesai = sedia.some(function (r) {
      return _teksCalon(r[0]) === PENANDA_MIGRASI_CALON && _teksCalon(r[7]) === REKOD_SNAPSHOT;
    });
    if (selesai) return;

    var muridSemasa = getMuridSemua();
    var aktif = _teksCalon(getTetapan().aktif);
    var db = _bacaDBMarkah();
    var baharu = [[PENANDA_MIGRASI_CALON, "", "", "", "", "", "", REKOD_SNAPSHOT]];

    getPeperiksaanSemua().forEach(function (p) {
      var calon = p.nama === aktif
        ? muridSemasa
        : _calonLamaDaripadaMarkah(p.nama, muridSemasa, db);
      baharu = baharu.concat(_barisSnapshot(p.nama, calon));
    });

    if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, 8).clearContent();
    if (baharu.length) s.getRange(2, 1, baharu.length, 8).setValues(baharu);
  } finally {
    lock.releaseLock();
  }
}

function getMuridPeperiksaan(peperiksaan) {
  peperiksaan = _teksCalon(peperiksaan);
  if (!peperiksaan) return getMuridSemua();

  var baris = _barisCalonDalamSheet();
  var migrasiSelesai = baris.some(function (r) {
    return _teksCalon(r[0]) === PENANDA_MIGRASI_CALON &&
      _teksCalon(r[7]) === REKOD_SNAPSHOT;
  });
  if (!migrasiSelesai) {
    migrasiCalonPeperiksaanSekali();
    baris = _barisCalonDalamSheet();
  }
  if (!_adaSnapshotCalon(peperiksaan, baris)) return getMuridSemua();

  return baris.filter(function (r) {
    return _teksCalon(r[0]) === peperiksaan && _teksCalon(r[7]) === REKOD_CALON;
  }).map(function (r) {
    return {
      ic: _teksCalon(r[1]),
      nama: _teksCalon(r[2]),
      jantina: _teksCalon(r[3]),
      kelas: _teksCalon(r[4]),
      tahun: _teksCalon(r[5]),
      agama: _teksCalon(r[6])
    };
  });
}

function segerakCalonPeperiksaan(peperiksaan) {
  peperiksaan = _teksCalon(peperiksaan);
  if (!peperiksaan) return 0;
  migrasiCalonPeperiksaanSekali();

  var murid = getMuridSemua();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var s = _sheetCalonPeperiksaan();
    var lama = s.getLastRow() > 1 ? s.getRange(2, 1, s.getLastRow() - 1, 8).getValues() : [];
    var kekal = lama.filter(function (r) { return _teksCalon(r[0]) !== peperiksaan; });
    var semua = kekal.concat(_barisSnapshot(peperiksaan, murid));

    if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, 8).clearContent();
    if (semua.length) s.getRange(2, 1, semua.length, 8).setValues(semua);
  } finally {
    lock.releaseLock();
  }
  return murid.length;
}

function pastikanSnapshotCalonPeperiksaan(peperiksaan) {
  peperiksaan = _teksCalon(peperiksaan);
  if (!peperiksaan) return 0;
  migrasiCalonPeperiksaanSekali();
  if (!_adaSnapshotCalon(peperiksaan)) return segerakCalonPeperiksaan(peperiksaan);
  return getMuridPeperiksaan(peperiksaan).length;
}

function segerakCalonPeperiksaanAktif() {
  var aktif = _teksCalon(getTetapan().aktif);
  return aktif ? segerakCalonPeperiksaan(aktif) : 0;
}

function padamCalonPeperiksaan(peperiksaan) {
  peperiksaan = _teksCalon(peperiksaan);
  if (!peperiksaan) return;
  // Dipanggil dari apiPadamPeperiksaan yang sudah memegang ScriptLock.
  var s = _sheetCalonPeperiksaan();
  var lama = s.getLastRow() > 1 ? s.getRange(2, 1, s.getLastRow() - 1, 8).getValues() : [];
  var kekal = lama.filter(function (r) { return _teksCalon(r[0]) !== peperiksaan; });
  if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, 8).clearContent();
  if (kekal.length) s.getRange(2, 1, kekal.length, 8).setValues(kekal);
}
