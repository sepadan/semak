// ================================================================
//  SISTEM MARKAH SEKOLAH (SMS) v2 — TERAS (Code.gs)
//  Web App sepenuhnya + LOGIN (Admin / Guru)
//
//  SHEET PANGKALAN DATA:
//  - Sheet1      : data mentah murid (sedia ada — TIDAK diubah)
//  - MURID       : daftar murid bersih (dijana dari Sheet1)
//  - MARKAH      : semua markah, semua peperiksaan (IC sebagai ID unik murid)
//  - TETAPAN     : nama sekolah, tahun, kata laluan admin
//  - PEPERIKSAAN : senarai peperiksaan + matriks kelas/subjek + kunci
//  - GURU        : senarai nama guru
//  - TUGASAN     : kelas | subjek | guru (siapa mengajar apa)
// ================================================================

// ════════════════════════════════════════════════════════════════
// KONFIGURASI
// ════════════════════════════════════════════════════════════════

var NAMA_SISTEM        = "SEMAK - Sistem Markah";
var NAMA_SEKOLAH_LALAI = "SK PAYA REDAN";
var TAHUN_LALAI        = "2026";
var PEPERIKSAAN_LALAI  = "UJIAN PERTENGAHAN SESI AKADEMIK";
var KATALALUAN_LALAI   = "admin";
var KATAGURU_LALAI     = "guru";

var SH_MURID       = "MURID";
var SH_MARKAH      = "MARKAH";
var SH_TETAPAN     = "TETAPAN";
var SH_PEPERIKSAAN = "PEPERIKSAAN";
var SH_GURU        = "GURU";
var SH_TUGASAN     = "TUGASAN";
var SH_KELAS       = "KELAS";
var SH_SUBJEK      = "SUBJEK";

// Kedudukan lajur dalam Sheet1 (indeks 0-based)
var S1_NAMA = 2, S1_IC = 3, S1_JANTINA = 16, S1_TAHUN = 9, S1_KELAS = 10, S1_AGAMA = 18;

// Senarai subjek LALAI — digunakan untuk seed sheet SUBJEK semasa pemasangan
// dan sebagai fallback jika sheet SUBJEK belum wujud. Selepas pemasangan,
// senarai sebenar diurus admin melalui sheet SUBJEK / panel Tetapan.
var SUBJEK_LALAI = [
  { n: "B. MELAYU",   w: "#fce5cd" },
  { n: "B. INGGERIS", w: "#d9ead3" },
  { n: "MATEMATIK",   w: "#fff2cc" },
  { n: "SAINS",       w: "#d9d2e9" },
  { n: "PEND. ISLAM", w: "#cfe2f3", islamSahaja: true },
  { n: "SEJARAH",     w: "#f4cccc", tahap2Sahaja: true },
  { n: "B. ARAB",     w: "#ffe0b2" },
  { n: "PJPK",        w: "#e8f5e9" },
  { n: "PSV",         w: "#fce4ec" },
  { n: "RBT",         w: "#e3f2fd", tahap2Sahaja: true },
  { n: "MUZIK",       w: "#f3e5f5" },
  { n: "P. MORAL",    w: "#d0e0e3", bukanIslamSahaja: true }
];

// Alias keserasian — untuk kod lama yang masih merujuk SUBJEK_SEMUA.
// Kod baharu hendaklah menggunakan getSubjekSemua().
var SUBJEK_SEMUA = SUBJEK_LALAI;

// Palet warna untuk subjek baharu yang ditambah admin
var PALET_SUBJEK = ["#ffe0b2", "#c8e6c9", "#b3e5fc", "#f8bbd0", "#d1c4e9",
                    "#fff9c4", "#ffccbc", "#b2dfdb", "#dcedc8", "#f0f4c3"];

// Senarai subjek SEBENAR — dari sheet SUBJEK (boleh diurus admin)
var _cacheSubjek = null;
function getSubjekSemua() {
  if (_cacheSubjek) return _cacheSubjek;
  var sS = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_SUBJEK);
  if (!sS || sS.getLastRow() < 2) { _cacheSubjek = SUBJEK_LALAI; return _cacheSubjek; }
  var senarai = [];
  sS.getRange(2, 1, sS.getLastRow() - 1, 4).getValues().forEach(function (r) {
    var n = r[0] ? r[0].toString().trim().toUpperCase() : "";
    if (!n) return;
    var tahap  = (r[2] === null || r[2] === undefined) ? "" : r[2].toString().trim();
    var syarat = (r[3] || "").toString().trim().toUpperCase();
    senarai.push({
      n: n,
      w: (r[1] || "#e8eaf6").toString().trim(),
      tahap1Sahaja: tahap === "1",
      tahap2Sahaja: tahap === "2",
      islamSahaja: syarat === "ISLAM",
      bukanIslamSahaja: syarat === "BUKAN ISLAM"
    });
  });
  _cacheSubjek = senarai.length ? senarai : SUBJEK_LALAI;
  return _cacheSubjek;
}

// Senarai kelas SEBENAR: kesatuan kelas dari daftar MURID + kelas manual
// yang ditambah admin dalam sheet KELAS (lajur A)
function getKelasSemua(muridSedia) {
  var senarai = [];
  (muridSedia || getMuridSemua()).forEach(function (m) {
    if (m.kelas && senarai.indexOf(m.kelas) === -1) senarai.push(m.kelas);
  });
  var sK = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_KELAS);
  if (sK && sK.getLastRow() > 1) {
    sK.getRange(2, 1, sK.getLastRow() - 1, 1).getValues().forEach(function (r) {
      var k = r[0] ? r[0].toString().trim().toUpperCase() : "";
      if (k && senarai.indexOf(k) === -1) senarai.push(k);
    });
  }
  senarai.sort(function (a, b) { return a.localeCompare(b, "ms", { numeric: true }); });
  return senarai;
}

// ════════════════════════════════════════════════════════════════
// UTILITI GRED & TP
// ════════════════════════════════════════════════════════════════

function kiraGred(markah) {
  if (markah === "" || markah === null || markah === undefined) return "";
  if (markah === "TH" || markah === 0) return "TH";
  var m = Number(markah);
  if (isNaN(m)) return "";
  if (m >= 82) return "A";
  if (m >= 66) return "B";
  if (m >= 50) return "C";
  if (m >= 35) return "D";
  if (m >= 20) return "E";
  return "F";
}

function kiraTP(markah) { // Tahap 2 sahaja
  if (markah === "" || markah === null || markah === undefined) return "";
  if (markah === "TH" || markah === 0) return "TH";
  var m = Number(markah);
  if (isNaN(m)) return "";
  if (m >= 90) return 6;
  if (m >= 75) return 5;
  if (m >= 60) return 4;
  if (m >= 45) return 3;
  if (m >= 30) return 2;
  return 1;
}

function isIslam(agama) {
  if (!agama) return false;
  return agama.toString().toUpperCase().indexOf("ISLAM") > -1;
}

function isTahap1Kelas(namaKelas) {
  return ["1", "2", "3"].indexOf(namaKelas.toString().charAt(0)) > -1;
}

function subjekUntukKelas(namaKelas, muridKelas) {
  var tahap1 = isTahap1Kelas(namaKelas);
  var adaBukanIslam = muridKelas.some(function (m) { return !isIslam(m.agama); });
  return getSubjekSemua().filter(function (s) {
    if (s.tahap2Sahaja && tahap1) return false;
    if (s.tahap1Sahaja && !tahap1) return false;
    if (s.bukanIslamSahaja && !adaBukanIslam) return false;
    return true;
  });
}

function muridAmbilSubjek(murid, subjek) {
  var semua = getSubjekSemua();
  var def = null;
  for (var i = 0; i < semua.length; i++)
    if (semua[i].n === subjek) { def = semua[i]; break; }
  if (!def) return false;
  if (def.islamSahaja && !isIslam(murid.agama)) return false;
  if (def.bukanIslamSahaja && isIslam(murid.agama)) return false;
  return true;
}

// ════════════════════════════════════════════════════════════════
// MENU
// ════════════════════════════════════════════════════════════════

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("📘 SEMAK")
    .addItem("🌐 Buka Web App", "tunjukLinkWebApp")
    .addSeparator()
    .addItem("🔄 Segerak Data Murid (dari Sheet1)", "segerakMurid")
    .addItem("🛡️ Backup Fail Sekarang", "buatBackup")
    .addItem("📁 Pindah Fail ke Folder SEMAK", "pindahKeFolderSistem")
    .addSeparator()
    .addItem("🧹 Kemas Paparan (sembunyi tab sistem & tab lama)", "kemasPaparanSheet")
    .addItem("👁️ Tunjuk Semua Tab Semula", "tunjukSemuaSheet")
    .addItem("🗑️ Padam Tab Kelas Lama (backup dahulu)", "padamTabLama")
    .addSeparator()
    .addItem("🚀 Pasang Sistem (Sekali Sahaja)", "pasangSistem")
    .addToUi();
}

// ════════════════════════════════════════════════════════════════
// KEMAS PAPARAN SHEET
// ════════════════════════════════════════════════════════════════

var SHEET_SISTEM = [SH_MURID, SH_MARKAH, SH_TETAPAN, SH_PEPERIKSAAN,
                    SH_GURU, SH_TUGASAN, SH_KELAS, SH_SUBJEK];

function _ialahTabLama(nama) {
  return /^[1-6] /.test(nama) || nama.indexOf("(TOV/ETR)") > -1;
}

// Sembunyikan tab sistem + tab kelas lama. Hanya Sheet1 kekal kelihatan.
// Tiada data dipadam — semuanya boleh dikembalikan dengan "Tunjuk Semua Tab".
function kemasPaparanSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var bil = 0;
  ss.getSheets().forEach(function (sheet) {
    var nama = sheet.getName();
    if (nama === "Sheet1") return; // sumber data murid — kekal
    if (SHEET_SISTEM.indexOf(nama) > -1 || _ialahTabLama(nama)) {
      if (!sheet.isSheetHidden()) { sheet.hideSheet(); bil++; }
    }
  });
  ui.alert("🧹 " + bil + " tab disembunyikan.\n\n" +
    "Tiada data dipadam. Semua tab boleh dikembalikan melalui menu\n" +
    "'👁️ Tunjuk Semua Tab Semula', atau View > Hidden sheets.");
}

function tunjukSemuaSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var bil = 0;
  ss.getSheets().forEach(function (sheet) {
    if (sheet.isSheetHidden()) { sheet.showSheet(); bil++; }
  });
  SpreadsheetApp.getUi().alert("👁️ " + bil + " tab ditunjukkan semula.\n\n" +
    "Nota: tab TETAPAN & GURU mengandungi kata laluan — " +
    "sembunyikan semula selepas selesai.");
}

// Padam KEKAL tab kelas lama (cth "1 BIJAK") & tab TOV/ETR.
// Markah sudah berada dalam pangkalan data MARKAH; backup dibuat dahulu.
function padamTabLama() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  var sasaran = ss.getSheets().filter(function (sheet) {
    return _ialahTabLama(sheet.getName());
  });
  if (!sasaran.length) { ui.alert("Tiada tab kelas lama ditemui."); return; }

  var jawab = ui.alert(
    "🗑️ Padam Tab Kelas Lama",
    "Tab berikut akan DIPADAM KEKAL:\n\n" +
    sasaran.map(function (s) { return "• " + s.getName(); }).join("\n") +
    "\n\nMarkah sudah selamat dalam pangkalan data MARKAH.\n" +
    "Backup penuh akan dibuat dahulu secara automatik.\n\nTeruskan?",
    ui.ButtonSet.YES_NO
  );
  if (jawab !== ui.Button.YES) return;

  var namaBackup = buatBackup(true);
  sasaran.forEach(function (sheet) { ss.deleteSheet(sheet); });
  ui.alert("✅ " + sasaran.length + " tab lama dipadam.\n\n🛡️ Backup: " + namaBackup);
}

function tunjukLinkWebApp() {
  var url = "";
  try { url = ScriptApp.getService().getUrl(); } catch (e) {}
  var html = url
    ? '<div style="font-family:Arial;text-align:center;padding:20px">' +
      '<a href="' + url + '" target="_blank" style="display:inline-block;' +
      'background:#1a237e;color:white;padding:12px 28px;border-radius:6px;' +
      'text-decoration:none;font-weight:bold">🌐 Buka Sistem Markah</a></div>'
    : '<div style="font-family:Arial;padding:20px">Web App belum di-deploy.<br>' +
      'Deploy > New deployment > Web app dahulu.</div>';
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(420).setHeight(140), "🌐 Web App");
}

// ════════════════════════════════════════════════════════════════
// BACKUP
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// FOLDER SISTEM — semua fail sistem dalam satu folder Drive
// SEMAK - Sistem Markah/
//   ├─ (fail spreadsheet ini)
//   └─ Backup/
// ════════════════════════════════════════════════════════════════

function getFolderSistem() {
  var iter = DriveApp.getRootFolder().getFoldersByName(NAMA_SISTEM);
  return iter.hasNext() ? iter.next()
       : DriveApp.getRootFolder().createFolder(NAMA_SISTEM);
}

function getSubFolderSistem(nama) {
  var induk = getFolderSistem();
  var iter = induk.getFoldersByName(nama);
  return iter.hasNext() ? iter.next() : induk.createFolder(nama);
}

// Pindahkan fail spreadsheet ini ke dalam folder sistem
function pindahKeFolderSistem(senyap) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var fail = DriveApp.getFileById(ss.getId());
  var folder = getFolderSistem();
  // Jangan pindah jika sudah berada dalam folder sistem
  var induk = fail.getParents();
  while (induk.hasNext()) {
    if (induk.next().getId() === folder.getId()) {
      if (senyap !== true)
        SpreadsheetApp.getUi().alert("📁 Fail sudah berada dalam folder '" + NAMA_SISTEM + "'.");
      return;
    }
  }
  fail.moveTo(folder);
  if (senyap !== true)
    SpreadsheetApp.getUi().alert(
      "📁 Fail dipindahkan ke folder Drive:\n'" + NAMA_SISTEM + "'");
}

function buatBackup(senyap) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var fail = DriveApp.getFileById(ss.getId());
  var folder = getSubFolderSistem("Backup");
  var cap = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH.mm");
  var salinan = fail.makeCopy("BACKUP " + cap + " — " + ss.getName(), folder);
  if (senyap !== true)
    SpreadsheetApp.getUi().alert(
      "🛡️ Backup berjaya: " + salinan.getName() +
      "\n\nLokasi: Drive > " + NAMA_SISTEM + " > Backup");
  return salinan.getName();
}

// ════════════════════════════════════════════════════════════════
// PEMASANGAN (sekali sahaja)
// ════════════════════════════════════════════════════════════════

function pasangSistem() {
  var ui = SpreadsheetApp.getUi();
  var jawab = ui.alert(
    "🚀 Pasang Sistem Markah",
    "1. Backup penuh fail (automatik)\n" +
    "2. Bina sheet TETAPAN, PEPERIKSAAN, SUBJEK, GURU, KELAS, TUGASAN, MURID, MARKAH\n" +
    "3. Import senarai murid dari Sheet1\n" +
    "4. Import markah dari tab kelas lama (jika ada)\n\n" +
    "Tab kelas & data sedia ada TIDAK diubah atau dipadam.\n\nTeruskan?",
    ui.ButtonSet.YES_NO
  );
  if (jawab !== ui.Button.YES) return;

  var namaBackup = buatBackup(true);
  pindahKeFolderSistem(true); // fail sistem masuk folder SEMAK
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // TETAPAN
  var sT = ss.getSheetByName(SH_TETAPAN);
  if (!sT) {
    sT = ss.insertSheet(SH_TETAPAN);
    sT.getRange("A1:B1").setValues([["TETAPAN", "NILAI"]])
      .setFontWeight("bold").setBackground("#1a237e").setFontColor("white");
    sT.getRange("A2:B7").setValues([
      ["NAMA SEKOLAH",       NAMA_SEKOLAH_LALAI],
      ["TAHUN",              TAHUN_LALAI],
      ["PEPERIKSAAN AKTIF",  PEPERIKSAAN_LALAI],
      ["KATA LALUAN ADMIN",  KATALALUAN_LALAI],
      ["NAMA GURU BESAR",    ""],
      ["LOGO (ID FAIL)",     ""]
    ]);
    sT.getRange("A2:A7").setFontWeight("bold");
    sT.setColumnWidth(1, 240); sT.setColumnWidth(2, 340);
    sT.hideSheet(); // ada kata laluan — sembunyikan
  } else if (!sT.getRange("B5").getValue()) {
    sT.getRange("A5").setValue("KATA LALUAN ADMIN").setFontWeight("bold");
    sT.getRange("B5").setValue(KATALALUAN_LALAI);
  }
  if (!sT.getRange("A6").getValue()) sT.getRange("A6").setValue("NAMA GURU BESAR").setFontWeight("bold");
  if (!sT.getRange("A7").getValue()) sT.getRange("A7").setValue("LOGO (ID FAIL)").setFontWeight("bold");

  // PEPERIKSAAN
  var sP = ss.getSheetByName(SH_PEPERIKSAAN);
  if (!sP) {
    sP = ss.insertSheet(SH_PEPERIKSAAN);
    sP.getRange(1, 1, 1, 6).setValues([[
      "NAMA", "KELAS SERTAI", "SUBJEK TAHAP 1", "SUBJEK TAHAP 2", "KUNCI", "KONFIGURASI KELAS-SUBJEK"
    ]]).setFontWeight("bold").setBackground("#1a237e").setFontColor("white");
    sP.getRange(2, 1, 1, 5).setValues([[PEPERIKSAAN_LALAI, "SEMUA", "SEMUA", "SEMUA", ""]]);
    sP.setFrozenRows(1);
    sP.setColumnWidth(1, 300); sP.setColumnWidth(2, 300);
    sP.setColumnWidth(3, 300); sP.setColumnWidth(4, 300);
  } else if ((sP.getRange("C1").getValue() || "").toString() === "SUBJEK SERTAI") {
    // Naik taraf format lama (satu senarai subjek) → dua senarai T1/T2
    sP.insertColumnAfter(3);
    sP.getRange("C1").setValue("SUBJEK TAHAP 1");
    sP.getRange("D1").setValue("SUBJEK TAHAP 2")
      .setFontWeight("bold").setBackground("#1a237e").setFontColor("white");
    var lr = sP.getLastRow();
    if (lr > 1) {
      var lama = sP.getRange(2, 3, lr - 1, 1).getValues();
      sP.getRange(2, 4, lr - 1, 1).setValues(lama);
    }
  }
  // Lajur F menyimpan konfigurasi matriks kelas × subjek. Lajur B-D
  // dikekalkan supaya rekod lama masih boleh dibaca.
  if (sP.getMaxColumns() < 6) sP.insertColumnAfter(sP.getMaxColumns());
  if (!sP.getRange("F1").getValue()) {
    sP.getRange("F1").setValue("KONFIGURASI KELAS-SUBJEK")
      .setFontWeight("bold").setBackground("#1a237e").setFontColor("white");
  }
  sP.setColumnWidth(6, 360);

  // GURU (nama + kata laluan)
  var sG = ss.getSheetByName(SH_GURU);
  if (!sG) {
    sG = ss.insertSheet(SH_GURU);
    sG.getRange(1, 1, 1, 2).setValues([["NAMA GURU", "KATA LALUAN"]])
      .setFontWeight("bold").setBackground("#1a237e").setFontColor("white");
    sG.setFrozenRows(1);
    sG.setColumnWidth(1, 300); sG.setColumnWidth(2, 160);
    sG.hideSheet(); // ada kata laluan — sembunyikan
  } else if (!sG.getRange("B1").getValue()) {
    sG.getRange("B1").setValue("KATA LALUAN")
      .setFontWeight("bold").setBackground("#1a237e").setFontColor("white");
  }

  // TUGASAN
  var sTg = ss.getSheetByName(SH_TUGASAN);
  if (!sTg) {
    sTg = ss.insertSheet(SH_TUGASAN);
    sTg.getRange(1, 1, 1, 3).setValues([["KELAS", "SUBJEK", "GURU"]])
      .setFontWeight("bold").setBackground("#1a237e").setFontColor("white");
    sTg.setFrozenRows(1);
    sTg.setColumnWidth(2, 160); sTg.setColumnWidth(3, 300);
  }

  // KELAS (guru kelas untuk tandatangan pada slip keputusan + kelas manual)
  var sK = ss.getSheetByName(SH_KELAS);
  if (!sK) {
    sK = ss.insertSheet(SH_KELAS);
    sK.getRange(1, 1, 1, 2).setValues([["KELAS", "GURU KELAS"]])
      .setFontWeight("bold").setBackground("#1a237e").setFontColor("white");
    sK.setFrozenRows(1);
    sK.setColumnWidth(1, 160); sK.setColumnWidth(2, 300);
  }

  // SUBJEK (senarai mata pelajaran — boleh diurus admin melalui web app)
  var sS = ss.getSheetByName(SH_SUBJEK);
  if (!sS) {
    sS = ss.insertSheet(SH_SUBJEK);
    sS.getRange(1, 1, 1, 4).setValues([[
      "NAMA", "WARNA", "TAHAP (1/2/kosong=semua)", "SYARAT (ISLAM/BUKAN ISLAM/kosong=semua)"
    ]]).setFontWeight("bold").setBackground("#1a237e").setFontColor("white");
    sS.setFrozenRows(1);
    sS.setColumnWidth(1, 180); sS.setColumnWidth(3, 200); sS.setColumnWidth(4, 260);
    var seedSubjek = SUBJEK_LALAI.map(function (s) {
      return [s.n, s.w,
        s.tahap2Sahaja ? "2" : (s.tahap1Sahaja ? "1" : ""),
        s.islamSahaja ? "ISLAM" : (s.bukanIslamSahaja ? "BUKAN ISLAM" : "")];
    });
    sS.getRange(2, 1, seedSubjek.length, 4).setValues(seedSubjek);
  }

  // MURID
  var sMu = ss.getSheetByName(SH_MURID);
  if (!sMu) {
    sMu = ss.insertSheet(SH_MURID);
    sMu.getRange(1, 1, 1, 6).setValues([["NAMA", "JANTINA", "KELAS", "TAHUN", "AGAMA", "IC"]])
      .setFontWeight("bold").setBackground("#1a237e").setFontColor("white");
    sMu.setFrozenRows(1);
  }
  var bilMurid = segerakMurid(true);

  // MARKAH
  var sMk = ss.getSheetByName(SH_MARKAH);
  var markahBaru = !sMk;
  if (markahBaru) {
    sMk = ss.insertSheet(SH_MARKAH);
    sMk.getRange(1, 1, 1, 9).setValues([[
      "PEPERIKSAAN", "KELAS", "NAMA MURID", "SUBJEK", "MARKAH", "TP", "GURU", "DIKEMASKINI", "IC MURID"
    ]]).setFontWeight("bold").setBackground("#1a237e").setFontColor("white");
    sMk.setFrozenRows(1);
  }
  if (sMk.getMaxColumns() < 9) sMk.insertColumnAfter(sMk.getMaxColumns());
  if (!sMk.getRange("I1").getValue()) {
    sMk.getRange("I1").setValue("IC MURID")
      .setFontWeight("bold").setBackground("#1a237e").setFontColor("white");
  }

  // Elakkan rekod import lama berganda apabila menu pemasangan dijalankan semula.
  var bilImport = markahBaru ? importMarkahTabLama(PEPERIKSAAN_LALAI) : 0;

  ui.alert(
    "✅ Pemasangan selesai!\n\n" +
    "🛡️ Backup: " + namaBackup + "\n" +
    "👦 " + bilMurid + " murid diimport dari Sheet1\n" +
    "💾 " + bilImport + " rekod markah diimport dari tab kelas lama\n\n" +
    "⚠️ KATA LALUAN ADMIN LALAI: " + KATALALUAN_LALAI + "\n" +
    "   (tukar dalam web app selepas login pertama!)\n\n" +
    "Seterusnya: Deploy > New deployment > Web app,\n" +
    "kemudian login sebagai Admin untuk daftar guru & tugasan."
  );
}

// ════════════════════════════════════════════════════════════════
// SEGERAK MURID DARI SHEET1
// ════════════════════════════════════════════════════════════════

function segerakMurid(senyap) {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var s1  = ss.getSheetByName("Sheet1");
  var sMu = ss.getSheetByName(SH_MURID);
  if (!s1 || !sMu) {
    if (senyap !== true) SpreadsheetApp.getUi().alert("Sheet1 atau MURID tidak ditemui.");
    return 0;
  }

  // Pautkan rekod markah lama kepada IC sebelum daftar MURID ditulis semula.
  isiICMarkahDaripadaMurid(getMuridSemua());
  var raw = s1.getDataRange().getValues();
  var mapTahun = {
    "TAHUN SATU":"1","TAHUN DUA":"2","TAHUN TIGA":"3",
    "TAHUN EMPAT":"4","TAHUN LIMA":"5","TAHUN ENAM":"6"
  };

  var senarai = [];
  for (var i = 7; i < raw.length; i++) {
    var nama = raw[i][S1_NAMA];
    var tahunMentah = raw[i][S1_TAHUN];
    if (!nama || nama.toString().trim() === "") continue;
    if (!tahunMentah ||
        tahunMentah.toString().toUpperCase().indexOf("PRASEKOLAH") > -1) continue;

    var digit = mapTahun[tahunMentah.toString().toUpperCase()] ||
                tahunMentah.toString().trim();
    var kelas = digit + " " + (raw[i][S1_KELAS]
                ? raw[i][S1_KELAS].toString().toUpperCase().trim() : "");
    var jantina = "";
    if (raw[i][S1_JANTINA])
      jantina = raw[i][S1_JANTINA].toString().toUpperCase() === "LELAKI" ? "L" : "P";

    senarai.push([
      nama.toString().trim(), jantina, kelas, digit,
      raw[i][S1_AGAMA] || "", raw[i][S1_IC] || ""
    ]);
  }

  var lastRow = sMu.getLastRow();
  if (lastRow > 1) sMu.getRange(2, 1, lastRow - 1, 6).clearContent();
  if (senarai.length) sMu.getRange(2, 1, senarai.length, 6).setValues(senarai);
  if (typeof segerakCalonPeperiksaanAktif === "function")
    segerakCalonPeperiksaanAktif();

  if (senyap !== true)
    SpreadsheetApp.getUi().alert("🔄 " + senarai.length + " murid disegerak dari Sheet1.");
  return senarai.length;
}

// ════════════════════════════════════════════════════════════════
// IMPORT MARKAH DARI TAB KELAS LAMA (baca sahaja — sekali)
// ════════════════════════════════════════════════════════════════

function importMarkahTabLama(namaPeperiksaan) {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var sMk = ss.getSheetByName(SH_MARKAH);
  if (!sMk) return 0;

  var muridSemua = getMuridSemua();
  var cap = new Date();
  var rekod = [];

  ss.getSheets().forEach(function (sheet) {
    var nama = sheet.getName();
    if (!/^[1-6] /.test(nama) || nama.indexOf("(TOV/ETR)") > -1) return;
    var lastRow = sheet.getLastRow();
    if (lastRow < 7) return;

    var muridKelas = muridSemua.filter(function (m) { return m.kelas === nama; });
    if (!muridKelas.length) return;
    var subjekList = subjekUntukKelas(nama, muridKelas);
    var maxC = 3 + subjekList.length * 3;
    var data = sheet.getRange(7, 1, lastRow - 6, maxC).getValues();

    for (var i = 0; i < data.length; i++) {
      var nm = data[i][1];
      if (!nm || nm.toString().trim() === "" ||
          nm === "Lulus (A-E)" || nm === "JUMLAH MURID" ||
          nm === "ANALISIS"    || nm === "Gagal (F)") break;
      nm = nm.toString().trim();

      subjekList.forEach(function (s, sIdx) {
        var col    = 3 + sIdx * 3;
        var markah = data[i][col];
        var tp     = data[i][col + 2];
        if (markah === "N/A" || markah === "" || markah === null) return;
        var calon = muridKelas.filter(function (m) { return m.nama === nm; })[0];
        rekod.push([namaPeperiksaan, nama, nm, s.n, markah,
          (tp === null || tp === undefined || tp === "N/A") ? "" : tp,
          "IMPORT", cap, calon ? calon.ic : ""]);
      });
    }
  });

  if (rekod.length)
    sMk.getRange(sMk.getLastRow() + 1, 1, rekod.length, 9).setValues(rekod);
  return rekod.length;
}

// ════════════════════════════════════════════════════════════════
// AKSES DATA (digunakan oleh AppBackend.gs)
// ════════════════════════════════════════════════════════════════

// Lengkapkan IC dalam MARKAH lama menggunakan daftar MURID sebelum senarai murid dikemas kini.
function isiICMarkahDaripadaMurid(murid) {
  var sMk = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_MARKAH);
  if (!sMk || sMk.getLastRow() < 2 || !murid || !murid.length) return 0;
  if (sMk.getMaxColumns() < 9) sMk.insertColumnAfter(sMk.getMaxColumns());
  if (!sMk.getRange("I1").getValue()) sMk.getRange("I1").setValue("IC MURID");
  var data = sMk.getRange(2, 1, sMk.getLastRow() - 1, 9).getValues();
  var peta = {};
  murid.forEach(function (m) {
    if (m.ic) peta[m.kelas + "\u0001" + m.nama] = m.ic.toString().trim();
  });
  var berubah = false;
  data.forEach(function (r) {
    if (!r[8]) {
      var ic = peta[(r[1] || "").toString().trim() + "\u0001" + (r[2] || "").toString().trim()];
      if (ic) { r[8] = ic; berubah = true; }
    }
  });
  if (berubah) sMk.getRange(2, 1, data.length, 9).setValues(data);
  return berubah ? data.filter(function (r) { return !!r[8]; }).length : 0;
}

function getMuridSemua() {
  var sMu = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_MURID);
  if (!sMu) return [];
  var lastRow = sMu.getLastRow();
  if (lastRow < 2) return [];
  return sMu.getRange(2, 1, lastRow - 1, 6).getValues()
    .filter(function (r) { return r[0] && r[0].toString().trim() !== ""; })
    .map(function (r) {
      return { nama: r[0].toString().trim(), jantina: r[1], kelas: r[2],
               tahun: r[3].toString(), agama: r[4], ic: r[5] };
    });
}

function getTetapan() {
  var sT = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_TETAPAN);
  var t = { sekolah: NAMA_SEKOLAH_LALAI, tahun: TAHUN_LALAI,
            aktif: PEPERIKSAAN_LALAI, guruBesar: "" };
  if (!sT) return t;
  // Satu bacaan kelompok lebih pantas daripada lima panggilan berasingan.
  var nilai = sT.getRange("B2:B7").getValues();
  t.sekolah = nilai[0][0] || t.sekolah;
  t.tahun   = (nilai[1][0] || t.tahun).toString();
  // Nilai kosong disengajakan untuk menutup sementara pengisian markah.
  var aktif = nilai[2][0];
  t.aktif = (aktif === null || aktif === undefined) ? t.aktif : aktif.toString();
  t.guruBesar = (nilai[4][0] || "").toString().trim();
  t.logoId = (nilai[5][0] || "").toString().trim();
  return t;
}

// ════════════════════════════════════════════════════════════════
// CACHE DATA BACAAN (bukan cache sesi/login)
// Cache ini hanya mempercepat paparan. Google Sheets kekal sumber sebenar dan
// kegagalan/eviction cache sentiasa jatuh semula kepada bacaan Sheets biasa.
// ════════════════════════════════════════════════════════════════
var VERSI_CACHE_DATA = "v56";
var KUNCI_REVISI_CACHE_DATA = "SEMAK_REVISI_CACHE_DATA";

function _kunciCacheData(ruang, bahagian) {
  var revisi = PropertiesService.getScriptProperties()
    .getProperty(KUNCI_REVISI_CACHE_DATA) || "0";
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(bahagian || ""),
    Utilities.Charset.UTF_8
  );
  return "SEMAK_" + VERSI_CACHE_DATA + "_" + ruang + "_" + revisi + "_" +
    Utilities.base64EncodeWebSafe(digest).substring(0, 24);
}

function bacaCacheData(ruang, bahagian) {
  try {
    var mentah = CacheService.getScriptCache().get(_kunciCacheData(ruang, bahagian));
    if (!mentah) return null;
    var json = mentah.substring(1);
    if (mentah.charAt(0) === "Z") {
      json = Utilities.ungzip(Utilities.newBlob(
        Utilities.base64Decode(json)
      )).getDataAsString(Utilities.Charset.UTF_8);
    }
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function simpanCacheData(ruang, bahagian, nilai, saat) {
  try {
    var json = JSON.stringify(nilai);
    var muatan = "J" + json;
    if (muatan.length > 90000) {
      muatan = "Z" + Utilities.base64Encode(
        Utilities.gzip(Utilities.newBlob(json, "application/json")).getBytes()
      );
    }
    // Had satu nilai CacheService ialah kira-kira 100 KB.
    if (muatan.length <= 95000) {
      CacheService.getScriptCache().put(
        _kunciCacheData(ruang, bahagian), muatan, saat || 300
      );
    }
  } catch (e) {
    // Cache tidak kritikal; abaikan dan terus guna data langsung.
  }
  return nilai;
}

function batalCacheData() {
  PropertiesService.getScriptProperties().setProperty(
    KUNCI_REVISI_CACHE_DATA, String(Date.now())
  );
}

function semakAdmin(kataLaluan) {
  // Semua tindakan admin dari web app menggunakan token sesi enam jam.
  // Semakan kata laluan dikekalkan untuk keserasian fungsi lama dalam spreadsheet.
  var sesi = sahkanSesi(kataLaluan);
  if (sesi && sesi.peranan === "admin") return true;
  var sT = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_TETAPAN);
  var betul = sT ? (sT.getRange("B5").getValue() || KATALALUAN_LALAI) : KATALALUAN_LALAI;
  return (kataLaluan || "").toString() === betul.toString();
}

function getGuruSemua() {
  var sG = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_GURU);
  if (!sG) return [];
  var lastRow = sG.getLastRow();
  if (lastRow < 2) return [];
  var senarai = [];
  sG.getRange(2, 1, lastRow - 1, 1).getValues().forEach(function (r) {
    var v = r[0] ? r[0].toString().trim() : "";
    if (v && senarai.indexOf(v) === -1) senarai.push(v);
  });
  return senarai;
}

// Peta nama guru → kata laluan (kosong = kata laluan lalai)
function getGuruKataMap() {
  var sG = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_GURU);
  var peta = {};
  if (!sG) return peta;
  var lastRow = sG.getLastRow();
  if (lastRow < 2) return peta;
  sG.getRange(2, 1, lastRow - 1, 2).getValues().forEach(function (r) {
    var nm = r[0] ? r[0].toString().trim() : "";
    if (nm) peta[nm] = (r[1] === null || r[1] === undefined || r[1] === "")
                       ? KATAGURU_LALAI : r[1].toString();
  });
  return peta;
}

function semakGuru(nama, kata) {
  var peta = getGuruKataMap();
  if (!peta.hasOwnProperty(nama)) return false;
  return (kata || "").toString() === peta[nama];
}

// [{nama, kelas: [], konfigurasi: {"1 BIJAK":["B. MELAYU", ...]}, kunci}]
// Rekod lama tanpa konfigurasi matriks masih disokong melalui lajur B-D.
function getPeperiksaanSemua() {
  var sP = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_PEPERIKSAAN);
  if (!sP) return [{ nama: PEPERIKSAAN_LALAI, kelas: null,
                     subjekT1: null, subjekT2: null, kunci: false }];
  var lastRow = sP.getLastRow();
  if (lastRow < 2) return [];
  var bilLajur = Math.min(6, sP.getLastColumn());
  return sP.getRange(2, 1, lastRow - 1, bilLajur).getValues()
    .filter(function (r) { return r[0] && r[0].toString().trim() !== ""; })
    .map(function (r) {
      var pecah = function (v) {
        v = (v || "").toString().trim();
        if (v === "" || v.toUpperCase() === "SEMUA") return null;
        return v.split(",").map(function (x) { return x.trim(); })
                .filter(function (x) { return x !== ""; });
      };
      var konfigurasi = null;
      var mentahKonfig = r[5];
      if (mentahKonfig) {
        try {
          var calon = JSON.parse(mentahKonfig.toString());
          if (calon && typeof calon === "object") konfigurasi = calon;
        } catch (e) {}
      }
      return {
        nama:     r[0].toString().trim(),
        kelas:    konfigurasi ? Object.keys(konfigurasi) : pecah(r[1]),
        subjekT1: pecah(r[2]),
        subjekT2: pecah(r[3]),
        kunci:    (r[4] || "").toString().toUpperCase() === "YA",
        konfigurasi: konfigurasi
      };
    });
}

// Senarai subjek peperiksaan untuk satu kelas (ikut tahap kelas itu)
function subjekCfgUntukKelas(cfg, namaKelas) {
  if (!cfg) return null;
  if (cfg.konfigurasi) return cfg.konfigurasi.hasOwnProperty(namaKelas)
    ? cfg.konfigurasi[namaKelas] : [];
  return isTahap1Kelas(namaKelas) ? cfg.subjekT1 : cfg.subjekT2;
}

// [{kelas, subjek, guru}]
function getTugasanSemua() {
  var sTg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_TUGASAN);
  if (!sTg) return [];
  var lastRow = sTg.getLastRow();
  if (lastRow < 2) return [];
  return sTg.getRange(2, 1, lastRow - 1, 3).getValues()
    .filter(function (r) { return r[0] && r[1] && r[2]; })
    .map(function (r) {
      return { kelas: r[0].toString().trim(), subjek: r[1].toString().trim(),
               guru: r[2].toString().trim() };
    });
}

// {"1 BIJAK": "NAMA GURU", ...}
function getGuruKelasMap() {
  var sK = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_KELAS);
  var peta = {};
  if (!sK || sK.getLastRow() < 2) return peta;
  sK.getRange(2, 1, sK.getLastRow() - 1, 2).getValues().forEach(function (r) {
    var kelas = r[0] ? r[0].toString().trim() : "";
    var guru = r[1] ? r[1].toString().trim() : "";
    if (kelas && guru) peta[kelas] = guru;
  });
  return peta;
}
