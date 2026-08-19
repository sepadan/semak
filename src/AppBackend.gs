// ================================================================
//  SISTEM MARKAH SEKOLAH v2 — API WEB APP (AppBackend.gs)
//  Berpasangan dengan App.html
//  auth = { peranan: "admin"|"guru", guru: "...", kata: "..." }
// ================================================================

function doGet() {
  var t = getTetapan();
  return HtmlService.createHtmlOutputFromFile("App")
    .setTitle("SEMAK — " + t.sekolah)
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Sesi web bertahan sehingga enam jam. Yang disimpan di pelayar ialah token rawak,
// bukan kata laluan admin atau guru.
var TEMPOH_SESI_SAAT = 21600;

function _ciptaSesi(peranan, guru) {
  var token = Utilities.getUuid() + Utilities.getUuid();
  var data = { peranan: peranan, guru: guru || "" };
  CacheService.getScriptCache().put("SESI_" + token, JSON.stringify(data), TEMPOH_SESI_SAAT);
  return token;
}

function sahkanSesi(token) {
  if (!token) return null;
  var mentah = CacheService.getScriptCache().get("SESI_" + token);
  if (!mentah) return null;
  try { return JSON.parse(mentah); } catch (e) { return null; }
}

function apiSemakSesi(token) {
  var sesi = sahkanSesi(token);
  return sesi ? { ok: true, peranan: sesi.peranan, guru: sesi.guru } : { ok: false };
}

// ════════════════════════════════════════════════════════════════
// API: DATA PERMULAAN
// ════════════════════════════════════════════════════════════════

function apiInit() {
  var t     = getTetapan();
  var murid = getMuridSemua();
  isiICMarkahDaripadaMurid(murid);

  // Kesatuan kelas dari MURID + kelas manual dari sheet KELAS
  var kelasUnik = getKelasSemua();

  // Info setiap kelas: tahap1 & ada murid bukan Islam (untuk matriks tugasan)
  var kelasInfo = {};
  kelasUnik.forEach(function (k) {
    var mk = murid.filter(function (m) { return m.kelas === k; });
    kelasInfo[k] = {
      tahap1: isTahap1Kelas(k),
      // Kelas manual tanpa murid: benarkan P. Moral ditanda (admin tentukan)
      adaMoral: mk.length ? mk.some(function (m) { return !isIslam(m.agama); }) : true,
      bilMurid: mk.length
    };
  });

  // Logo sekolah (data URL — boleh terus dipapar & dicetak)
  var logo = "";
  if (t.logoId) {
    try {
      var blobLogo = DriveApp.getFileById(t.logoId).getBlob();
      logo = "data:" + blobLogo.getContentType() + ";base64," +
             Utilities.base64Encode(blobLogo.getBytes());
    } catch (e) {}
  }

  return {
    sekolah: t.sekolah, tahun: t.tahun, aktif: t.aktif, guruBesar: t.guruBesar,
    logo: logo,
    kelas: kelasUnik,
    kelasInfo: kelasInfo,
    subjekSemua: getSubjekSemua().map(function (s) {
      return { n: s.n, w: s.w, tahap2Sahaja: !!s.tahap2Sahaja,
               tahap1Sahaja: !!s.tahap1Sahaja,
               bukanIslamSahaja: !!s.bukanIslamSahaja };
    }),
    guru: getGuruSemua(),
    peperiksaan: getPeperiksaanSemua(),
    tugasan: getTugasanSemua(),
    guruKelas: getGuruKelasMap()
  };
}

// ════════════════════════════════════════════════════════════════
// API: LOGIN ADMIN
// ════════════════════════════════════════════════════════════════

function apiLoginAdmin(kata) {
  if (!semakAdmin(kata)) return { ok: false };
  return { ok: true, sesi: _ciptaSesi("admin", "") };
}

function apiLoginGuru(nama, kata) {
  if (!semakGuru(nama, kata)) return { ok: false };
  return { ok: true, sesi: _ciptaSesi("guru", nama) };
}

// ════════════════════════════════════════════════════════════════
// API: MURID & SUBJEK UNTUK SATU KELAS
// ════════════════════════════════════════════════════════════════

function apiKelas(namaKelas, peperiksaan) {
  var sumberMurid = peperiksaan ? getMuridPeperiksaan(peperiksaan) : getMuridSemua();
  var muridKelas = sumberMurid.filter(function (m) {
    return m.kelas === namaKelas;
  });
  var subjekList = subjekUntukKelas(namaKelas, muridKelas);
  return {
    tahap1: isTahap1Kelas(namaKelas),
    subjek: subjekList.map(function (s) { return { n: s.n, w: s.w }; }),
    murid: muridKelas.map(function (m, i) {
      var ambil = {};
      subjekList.forEach(function (s) { ambil[s.n] = muridAmbilSubjek(m, s.n); });
      return { bil: i + 1, nama: m.nama, jantina: m.jantina, ic: m.ic, ambil: ambil };
    })
  };
}

// ════════════════════════════════════════════════════════════════
// API: BACA MARKAH
// ════════════════════════════════════════════════════════════════

function apiMarkah(peperiksaan, namaKelas) {
  var peta = {};
  _bacaDBMarkah().forEach(function (r) {
    if (r[0] !== peperiksaan || r[1] !== namaKelas) return;
    var id = r[8] ? r[8].toString().trim() : (r[2] ? r[2].toString().trim() : "");
    if (!id) return;
    if (!peta[id]) peta[id] = {};
    peta[id][r[3]] = { m: r[4], tp: r[5] };
  });
  return peta;
}

// ════════════════════════════════════════════════════════════════
// KAWALAN AKSES SIMPAN MARKAH
// ════════════════════════════════════════════════════════════════

function _semakKebenaranSimpan(peperiksaan, namaKelas, subjek, auth) {
  auth = auth || {};
  var sesi = sahkanSesi(auth.sesi);
  var isAdmin = sesi && sesi.peranan === "admin";

  var tetapan = getTetapan();
  if (!tetapan.aktif)
    return { ok: false, mesej: "Tiada peperiksaan aktif. Pengisian markah sedang ditutup." };
  if (tetapan.aktif !== peperiksaan)
    return { ok: false, mesej: "Hanya peperiksaan aktif ('" + tetapan.aktif + "') boleh diisi sekarang." };

  // Konfigurasi peperiksaan
  var cfg = null;
  getPeperiksaanSemua().forEach(function (p) {
    if (p.nama === peperiksaan) cfg = p;
  });
  if (!cfg) return { ok: false, mesej: "Peperiksaan '" + peperiksaan + "' tidak wujud." };
  if (cfg.kunci)
    return { ok: false, mesej: "Peperiksaan ini telah DIKUNCI. Pengisian markah ditutup untuk semua pengguna." };
  if (cfg.kelas && cfg.kelas.indexOf(namaKelas) === -1)
    return { ok: false, mesej: "Kelas " + namaKelas + " tidak turut serta dalam peperiksaan ini." };
  var subjekCfg = subjekCfgUntukKelas(cfg, namaKelas);
  if (subjekCfg && subjekCfg.indexOf(subjek) === -1)
    return { ok: false, mesej: "Subjek " + subjek + " tiada dalam peperiksaan ini untuk kelas " + namaKelas + "." };

  if (isAdmin) return { ok: true };

  // Guru: mesti ditugaskan untuk kelas+subjek ini
  if (sesi && sesi.peranan === "guru" && sesi.guru) {
    var padan = getTugasanSemua().some(function (t) {
      return t.kelas === namaKelas && t.subjek === subjek && t.guru === sesi.guru;
    });
    if (padan) return { ok: true };
    return { ok: false, mesej: "Anda tidak ditugaskan untuk " + subjek +
             " kelas " + namaKelas + ". Hubungi admin." };
  }

  return { ok: false, mesej: "Sila login untuk menyimpan markah." };
}

// ════════════════════════════════════════════════════════════════
// API: SIMPAN MARKAH
// ════════════════════════════════════════════════════════════════

function apiSimpanMarkah(peperiksaan, namaKelas, subjek, data, auth) {
  try {
    if (!peperiksaan || !namaKelas || !subjek)
      return { ok: false, mesej: "Maklumat tidak lengkap." };

    var kebenaran = _semakKebenaranSimpan(peperiksaan, namaKelas, subjek, auth);
    if (!kebenaran.ok) return kebenaran;

    for (var i = 0; i < data.length; i++) {
      if (!data[i].ic || data[i].ic.toString().trim() === "")
        return { ok: false, mesej: "IC/MyKad tidak ditemui untuk " + data[i].nama + ". Sila segerak data murid dahulu." };
      var v = data[i].markah;
      if (v === "" || v === null || v === undefined || v === "TH") continue;
      var n = Number(v);
      if (isNaN(n) || n < 0 || n > 100)
        return { ok: false, mesej: "Markah tidak sah untuk " + data[i].nama +
                 " (" + v + "). Mesti 0-100 atau TH." };
      var tp = data[i].tp;
      if (tp !== "" && tp !== null && tp !== undefined && tp !== "TH") {
        var t = Number(tp);
        if (isNaN(t) || t < 1 || t > 6)
          return { ok: false, mesej: "TP tidak sah untuk " + data[i].nama +
                   " (" + tp + "). Mesti 1-6." };
      }
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sMk = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_MARKAH);
      if (!sMk) return { ok: false, mesej: "Sheet MARKAH tidak wujud." };
      if (sMk.getMaxColumns() < 9) sMk.insertColumnAfter(sMk.getMaxColumns());
      if (!sMk.getRange("I1").getValue()) sMk.getRange("I1").setValue("IC MURID");

      var cap = new Date();
      var lastRow = sMk.getLastRow();
      var kekal = [];
      if (lastRow > 1) {
        kekal = sMk.getRange(2, 1, lastRow - 1, 9).getValues().filter(function (r) {
          return !(r[0] === peperiksaan && r[1] === namaKelas && r[3] === subjek);
        });
      }

      var sesiPengisi = sahkanSesi(auth && auth.sesi);
      var pengisi = sesiPengisi && sesiPengisi.peranan === "admin" ? "ADMIN"
                   : (sesiPengisi ? sesiPengisi.guru : "");
      var baru = [];
      data.forEach(function (d) {
        var kosongM  = (d.markah === "" || d.markah === null || d.markah === undefined);
        var kosongTP = (d.tp === "" || d.tp === null || d.tp === undefined);
        if (kosongM && kosongTP) return;
        baru.push([peperiksaan, namaKelas, d.nama, subjek,
          kosongM ? "" : d.markah, kosongTP ? "" : d.tp, pengisi, cap]);
        baru[baru.length - 1].push((d.ic || "").toString().trim());
      });

      var semua = kekal.concat(baru);
      if (lastRow > 1) sMk.getRange(2, 1, lastRow - 1, 9).clearContent();
      if (semua.length) sMk.getRange(2, 1, semua.length, 9).setValues(semua);

      return { ok: true, mesej: baru.length + " markah " + subjek +
               " (" + namaKelas + ") disimpan." };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

// ════════════════════════════════════════════════════════════════
// API: STATUS PENGISIAN (ditapis ikut konfigurasi peperiksaan)
// ════════════════════════════════════════════════════════════════

function apiStatus(peperiksaan) {
  var murid = getMuridPeperiksaan(peperiksaan);
  var db    = _bacaDBMarkah();

  var cfg = null;
  getPeperiksaanSemua().forEach(function (p) { if (p.nama === peperiksaan) cfg = p; });

  var kelasUnik = [];
  murid.forEach(function (m) {
    if (m.kelas && kelasUnik.indexOf(m.kelas) === -1) kelasUnik.push(m.kelas);
  });
  kelasUnik.sort(function (a, b) { return a.localeCompare(b, "ms", { numeric: true }); });
  if (cfg && cfg.kelas) kelasUnik = kelasUnik.filter(function (k) {
    return cfg.kelas.indexOf(k) > -1;
  });

  var terisi = {};
  db.forEach(function (r) {
    if (r[0] !== peperiksaan) return;
    if (r[4] === "" || r[4] === null) return;
    var k = r[1], s = r[3];
    if (!terisi[k]) terisi[k] = {};
    if (!terisi[k][s]) terisi[k][s] = {};
    terisi[k][s][r[8] ? r[8].toString().trim() : r[2]] = true;
  });

  var tugasan = getTugasanSemua();
  var hasil = [];
  kelasUnik.forEach(function (k) {
    var muridKelas = murid.filter(function (m) { return m.kelas === k; });
    var subjekList = subjekUntukKelas(k, muridKelas);
    var subjekCfg = subjekCfgUntukKelas(cfg, k);
    if (subjekCfg) subjekList = subjekList.filter(function (s) {
      return subjekCfg.indexOf(s.n) > -1;
    });
    var baris = { kelas: k, subjek: [] };
    subjekList.forEach(function (s) {
    var patut = muridKelas.filter(function (m) {
      return muridAmbilSubjek(m, s.n);
    }).length;
      var ada = terisi[k] && terisi[k][s.n] ? Object.keys(terisi[k][s.n]).length : 0;
      var guru = "";
      tugasan.forEach(function (t) {
        if (t.kelas === k && t.subjek === s.n) guru = t.guru;
      });
      baris.subjek.push({ n: s.n, ada: ada, patut: patut, guru: guru });
    });
    hasil.push(baris);
  });

  // Header jadual: kesatuan subjek T1 + T2 yang turut serta
  var semuaSubjek = getSubjekSemua().map(function (s) { return s.n; });
  if (cfg && (cfg.subjekT1 || cfg.subjekT2)) {
    semuaSubjek = semuaSubjek.filter(function (s) {
      var dlmT1 = !cfg.subjekT1 || cfg.subjekT1.indexOf(s) > -1;
      var dlmT2 = !cfg.subjekT2 || cfg.subjekT2.indexOf(s) > -1;
      return dlmT1 || dlmT2;
    });
  }
  return { kelas: hasil, semuaSubjek: semuaSubjek, kunci: cfg ? cfg.kunci : false };
}

// ════════════════════════════════════════════════════════════════
// API: ANALISIS PENUH (ditapis ikut konfigurasi peperiksaan)
// ════════════════════════════════════════════════════════════════

function apiAnalisis(peperiksaan) {
  var t     = getTetapan();
  var murid = getMuridPeperiksaan(peperiksaan);
  var db    = _bacaDBMarkah();

  var cfg = null;
  getPeperiksaanSemua().forEach(function (p) { if (p.nama === peperiksaan) cfg = p; });

  var peta = {};
  db.forEach(function (r) {
    if (r[0] !== peperiksaan) return;
    var k = r[1], id = r[8] ? r[8].toString().trim() : (r[2] ? r[2].toString().trim() : "");
    if (!id) return;
    if (!peta[k]) peta[k] = {};
    if (!peta[k][id]) peta[k][id] = {};
    peta[k][id][r[3]] = { m: r[4], tp: r[5] };
  });

  var kelasUnik = [];
  murid.forEach(function (m) {
    if (m.kelas && kelasUnik.indexOf(m.kelas) === -1) kelasUnik.push(m.kelas);
  });
  kelasUnik.sort(function (a, b) { return a.localeCompare(b, "ms", { numeric: true }); });
  if (cfg && cfg.kelas) kelasUnik = kelasUnik.filter(function (k) {
    return cfg.kelas.indexOf(k) > -1;
  });

  var mapG = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6 };
  var hasilKelas = [];

  kelasUnik.forEach(function (k) {
    var muridKelas = murid.filter(function (m) { return m.kelas === k; });
    var subjekList = subjekUntukKelas(k, muridKelas);
    var subjekCfg = subjekCfgUntukKelas(cfg, k);
    if (subjekCfg) subjekList = subjekList.filter(function (s) {
      return subjekCfg.indexOf(s.n) > -1;
    });
    var tahap1 = isTahap1Kelas(k);

    var muridHasil = muridKelas.map(function (m, idx) {
      var rekod = [];
      var jM = 0, bM = 0, jGP = 0, bGP = 0, lulus = 0, gagal = 0, gredA = 0, th = 0;

      subjekList.forEach(function (s) {
        if (!muridAmbilSubjek(m, s.n)) return;
        var rec  = (peta[k] && peta[k][m.ic] && peta[k][m.ic][s.n]) || null;
        var mk   = rec ? rec.m : "";
        var gred = kiraGred(mk);
        var tp   = tahap1 ? (rec ? rec.tp : "") : kiraTP(mk);
        rekod.push({ subjek: s.n, markah: mk, gred: gred, tp: tp });

        if (mk === "" || mk === null) return;
        if (gred === "TH") { th++; return; }
        if (typeof mk === "number") { jM += mk; bM++; }
        if (gred === "F") gagal++; else if (mapG[gred]) lulus++;
        if (gred === "A") gredA++;
        if (mapG[gred]) { jGP += mapG[gred]; bGP++; }
      });

      return {
        bil: idx + 1, nama: m.nama, jantina: m.jantina, rekod: rekod,
        purata: bM > 0 ? +(jM / bM).toFixed(2) : null,
        gpmp:   bGP > 0 ? +(jGP / bGP).toFixed(2) : null,
        lulus: lulus, gagal: gagal, gredA: gredA, th: th, ambil: lulus + gagal
      };
    });

    muridHasil.slice().sort(function (a, b) {
      if (a.purata === null) return 1;
      if (b.purata === null) return -1;
      return b.purata - a.purata;
    }).forEach(function (m, i) { m.rank = (m.purata === null) ? null : i + 1; });

    var subjekStats = subjekList.map(function (s) {
      var st = { subjek: s.n, warna: s.w, A:0,B:0,C:0,D:0,E:0,F:0,
                 th:0, lulus:0, gagal:0, ambil:0, jGP:0, jM:0, bM:0 };
      muridHasil.forEach(function (m) {
        var r = null;
        for (var i = 0; i < m.rekod.length; i++)
          if (m.rekod[i].subjek === s.n) { r = m.rekod[i]; break; }
        if (!r || r.markah === "" || r.markah === null) return;
        if (r.gred === "TH") { st.th++; return; }
        if (st.hasOwnProperty(r.gred)) st[r.gred]++;
        if (r.gred === "F") st.gagal++;
        else if ("ABCDE".indexOf(r.gred) > -1) st.lulus++;
        if (mapG[r.gred]) { st.jGP += mapG[r.gred]; st.ambil++; }
        if (typeof r.markah === "number") { st.jM += r.markah; st.bM++; }
      });
      st.gpmp   = st.ambil > 0 ? +(st.jGP / st.ambil).toFixed(2) : null;
      st.purata = st.bM > 0 ? +(st.jM / st.bM).toFixed(1) : null;
      st.pLulus = st.ambil > 0 ? +((st.lulus / st.ambil) * 100).toFixed(1) : null;
      delete st.jGP; delete st.jM; delete st.bM;
      return st;
    });

    var totAmbil = 0, totLulus = 0, totGP = 0, totA = 0, totTH = 0;
    subjekStats.forEach(function (st) {
      totAmbil += st.ambil; totLulus += st.lulus;
      totA += st.A; totTH += st.th;
      if (st.gpmp !== null) totGP += st.gpmp * st.ambil;
    });

    hasilKelas.push({
      nama: k, tahap1: tahap1, murid: muridHasil, subjek: subjekStats,
      ringkasan: {
        jumlahMurid: muridKelas.length,
        lelaki:    muridKelas.filter(function (m) { return m.jantina === "L"; }).length,
        perempuan: muridKelas.filter(function (m) { return m.jantina === "P"; }).length,
        gpmp:   totAmbil > 0 ? +(totGP / totAmbil).toFixed(2) : null,
        pLulus: totAmbil > 0 ? +((totLulus / totAmbil) * 100).toFixed(1) : null,
        gredA: totA, th: totTH
      }
    });
  });

  return {
    sekolah: t.sekolah, tahun: t.tahun, peperiksaan: peperiksaan,
    dijana: new Date().toLocaleString("ms-MY"),
    kelas: hasilKelas
  };
}

// ════════════════════════════════════════════════════════════════
// API ADMIN — semua memerlukan kata laluan
// ════════════════════════════════════════════════════════════════

// Cipta rekod kosong terlebih dahulu supaya ia terus muncul dalam dropdown.
// Admin kemudian memilih tanda ✓ dalam matriks sebelum menekan Simpan Peperiksaan.
function apiTambahPeperiksaan(nama, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Kata laluan admin salah." };
    nama = (nama || "").toString().trim().toUpperCase();
    if (!nama) return { ok: false, mesej: "Nama peperiksaan kosong." };

    var sP = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_PEPERIKSAAN);
    if (!sP) return { ok: false, mesej: "Sheet PEPERIKSAAN tidak wujud." };
    var lastRow = sP.getLastRow();
    if (lastRow > 1) {
      var sedia = sP.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < sedia.length; i++) {
        if ((sedia[i][0] || "").toString().trim() === nama)
          return { ok: false, mesej: "Peperiksaan '" + nama + "' sudah wujud." };
      }
    }
    if (sP.getMaxColumns() < 6) sP.insertColumnAfter(sP.getMaxColumns());
    if (!sP.getRange("F1").getValue()) {
      sP.getRange("F1").setValue("KONFIGURASI KELAS-SUBJEK")
        .setFontWeight("bold").setBackground("#1a237e").setFontColor("white");
    }
    sP.getRange(lastRow + 1, 1, 1, 6).setValues([[nama, "", "", "", "", "{}"]]);
    return { ok: true, mesej: "Peperiksaan ditambah. Pilih kelas dan mata pelajaran dalam jadual.", nama: nama };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

// konfigurasi = [{kelas: "1 BIJAK", subjek: "B. MELAYU"}, ...]
// Setiap rekod ialah satu tanda ✓ dalam matriks kelas × subjek.
function apiSimpanPeperiksaan(nama, konfigurasi, kunci, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Kata laluan admin salah." };
    nama = (nama || "").toString().trim().toUpperCase();
    if (!nama) return { ok: false, mesej: "Nama peperiksaan kosong." };

    var sP = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_PEPERIKSAAN);
    if (!sP) return { ok: false, mesej: "Sheet PEPERIKSAAN tidak wujud." };

    var peta = {};
    (konfigurasi || []).forEach(function (item) {
      if (!item || !item.kelas || !item.subjek) return;
      var kelas = item.kelas.toString().trim();
      var subjek = item.subjek.toString().trim();
      if (!peta[kelas]) peta[kelas] = [];
      if (peta[kelas].indexOf(subjek) === -1) peta[kelas].push(subjek);
    });
    if (!Object.keys(peta).length)
      return { ok: false, mesej: "Tandakan sekurang-kurangnya satu mata pelajaran untuk satu kelas." };

    // Lindungi data jika ada panggilan terus ke API: hanya kelas dan subjek
    // yang wujud serta sah mengikut tahap kelas boleh disimpan.
    // (Kelas manual tanpa murid dibenarkan — validasi ikut tahap sahaja.)
    var semuaKelas = getKelasSemua();
    Object.keys(peta).forEach(function (kelas) {
      if (semuaKelas.indexOf(kelas) === -1)
        throw new Error("Kelas '" + kelas + "' tidak wujud.");
      var tahap1 = isTahap1Kelas(kelas);
      var sah = getSubjekSemua().filter(function (s) {
        if (s.tahap2Sahaja && tahap1) return false;
        if (s.tahap1Sahaja && !tahap1) return false;
        return true;
      }).map(function (s) { return s.n; });
      peta[kelas].forEach(function (subjek) {
        if (sah.indexOf(subjek) === -1)
          throw new Error("Subjek '" + subjek + "' tidak sah untuk kelas " + kelas + ".");
      });
    });

    // Ringkasan B-D membantu pembacaan manual dan kekalkan keserasian rekod lama.
    var kelasStr = Object.keys(peta).join(", ");
    var t1 = [], t2 = [];
    Object.keys(peta).forEach(function (kelas) {
      peta[kelas].forEach(function (subjek) {
        var sasaran = isTahap1Kelas(kelas) ? t1 : t2;
        if (sasaran.indexOf(subjek) === -1) sasaran.push(subjek);
      });
    });
    var t1Str = t1.join(", ");
    var t2Str = t2.join(", ");
    var kunciStr = kunci ? "YA" : "";
    var konfigStr = JSON.stringify(peta);

    if (sP.getMaxColumns() < 6) sP.insertColumnAfter(sP.getMaxColumns());
    if (!sP.getRange("F1").getValue()) {
      sP.getRange("F1").setValue("KONFIGURASI KELAS-SUBJEK")
        .setFontWeight("bold").setBackground("#1a237e").setFontColor("white");
    }

    var lastRow = sP.getLastRow();
    var barisJumpa = 0;
    if (lastRow > 1) {
      var namaSedia = sP.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < namaSedia.length; i++) {
        if ((namaSedia[i][0] || "").toString().trim() === nama) { barisJumpa = i + 2; break; }
      }
    }
    if (barisJumpa) {
      sP.getRange(barisJumpa, 2, 1, 4).setValues([[kelasStr, t1Str, t2Str, kunciStr]]);
      sP.getRange(barisJumpa, 6).setValue(konfigStr);
      return { ok: true, mesej: "Peperiksaan '" + nama + "' dikemaskini." };
    }
    sP.getRange(lastRow + 1, 1, 1, 6).setValues([[nama, kelasStr, t1Str, t2Str, kunciStr, konfigStr]]);
    return { ok: true, mesej: "Peperiksaan '" + nama + "' ditambah." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

// PADAM PENUH: keluarkan dari senarai DAN padam semua markahnya
// dari pangkalan data MARKAH. buatBackupDulu = true/false (pilihan admin).
function apiPadamPeperiksaan(nama, buatBackupDulu, kata) {
  try {
    // Keserasian dengan panggilan lama: apiPadamPeperiksaan(nama, kata)
    if (kata === undefined) { kata = buatBackupDulu; buatBackupDulu = false; }
    if (!semakAdmin(kata)) return { ok: false, mesej: "Kata laluan admin salah." };

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sP = ss.getSheetByName(SH_PEPERIKSAAN);
      if (!sP) return { ok: false, mesej: "Sheet PEPERIKSAAN tidak wujud." };

      // Pastikan peperiksaan wujud sebelum buat apa-apa
      var barisJumpa = 0;
      var lastRow = sP.getLastRow();
      if (lastRow > 1) {
        var namaSedia = sP.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < namaSedia.length; i++) {
          if ((namaSedia[i][0] || "").toString().trim() === nama) { barisJumpa = i + 2; break; }
        }
      }
      if (!barisJumpa) return { ok: false, mesej: "'" + nama + "' tidak ditemui." };

      // 1) Backup jika diminta (SEBELUM apa-apa dipadam)
      var namaBackup = "";
      if (buatBackupDulu === true) namaBackup = buatBackup(true);

      // 2) Padam semua markah peperiksaan ini dari MARKAH
      var bilMarkah = 0;
      var sMk = ss.getSheetByName(SH_MARKAH);
      if (sMk && sMk.getLastRow() > 1) {
        var lastMk = sMk.getLastRow();
        var bilLajur = Math.min(9, sMk.getLastColumn());
        var semua = sMk.getRange(2, 1, lastMk - 1, bilLajur).getValues();
        var kekal = semua.filter(function (r) {
          if ((r[0] || "").toString().trim() === nama) { bilMarkah++; return false; }
          return true;
        });
        if (bilMarkah > 0) {
          sMk.getRange(2, 1, lastMk - 1, bilLajur).clearContent();
          if (kekal.length) sMk.getRange(2, 1, kekal.length, bilLajur).setValues(kekal);
        }
      }

      // 3) Keluarkan dari senarai peperiksaan
      sP.deleteRow(barisJumpa);
      padamCalonPeperiksaan(nama);

      // 4) Kosongkan peperiksaan aktif jika ia yang dipadam
      var sTetapan = ss.getSheetByName(SH_TETAPAN);
      if (sTetapan && (sTetapan.getRange("B4").getValue() || "").toString() === nama)
        sTetapan.getRange("B4").clearContent();

      var mesej = "'" + nama + "' dipadam sepenuhnya (" + bilMarkah + " rekod markah dibuang).";
      if (namaBackup) mesej += "\n🛡️ Backup: " + namaBackup;
      else mesej += "\n⚠️ Tiada backup dibuat (pilihan anda).";
      return { ok: true, mesej: mesej };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

function apiSimpanGuru(senaraiGuru, guruBesar, kata) {
  try {
    // Kekal serasi dengan panggilan lama: apiSimpanGuru(senaraiGuru, kata).
    if (kata === undefined) { kata = guruBesar; guruBesar = null; }
    if (!semakAdmin(kata)) return { ok: false, mesej: "Kata laluan admin salah." };
    var sG = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_GURU);
    if (!sG) return { ok: false, mesej: "Sheet GURU tidak wujud." };

    var kataSedia = getGuruKataMap(); // kekalkan kata laluan guru sedia ada
    var bersih = [];
    (senaraiGuru || []).forEach(function (g) {
      var v = (g || "").toString().trim().toUpperCase();
      if (v && bersih.indexOf(v) === -1) bersih.push(v);
    });

    var lastRow = sG.getLastRow();
    if (lastRow > 1) sG.getRange(2, 1, lastRow - 1, 2).clearContent();
    if (bersih.length)
      sG.getRange(2, 1, bersih.length, 2).setValues(bersih.map(function (g) {
        return [g, kataSedia.hasOwnProperty(g) ? kataSedia[g] : KATAGURU_LALAI];
      }));
    if (guruBesar !== null && guruBesar !== undefined) {
      guruBesar = guruBesar.toString().trim().toUpperCase();
      if (!guruBesar || bersih.indexOf(guruBesar) === -1)
        return { ok: false, mesej: "Pilih Guru Besar daripada Senarai Guru." };
      var sT = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_TETAPAN);
      if (!sT) return { ok: false, mesej: "Sheet TETAPAN tidak wujud." };
      sT.getRange("A6").setValue("NAMA GURU BESAR").setFontWeight("bold");
      sT.getRange("B6").setValue(guruBesar);
    }
    return { ok: true, mesej: bersih.length + " guru disimpan. " +
             "Guru baharu diberi kata laluan lalai '" + KATAGURU_LALAI + "'.",
             senarai: bersih };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

function apiSimpanGuruBesar(nama, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Kata laluan admin salah." };
    nama = (nama || "").toString().trim().toUpperCase();
    if (!nama) return { ok: false, mesej: "Masukkan nama Guru Besar." };
    var sT = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_TETAPAN);
    if (!sT) return { ok: false, mesej: "Sheet TETAPAN tidak wujud." };
    sT.getRange("A6").setValue("NAMA GURU BESAR").setFontWeight("bold");
    sT.getRange("B6").setValue(nama);
    return { ok: true, mesej: "Nama Guru Besar disimpan." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

function apiSetKataGuru(nama, baru, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Kata laluan admin salah." };
    baru = (baru || "").toString().trim();
    if (baru.length < 4)
      return { ok: false, mesej: "Kata laluan guru mesti sekurang-kurangnya 4 aksara." };
    var sG = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_GURU);
    if (!sG) return { ok: false, mesej: "Sheet GURU tidak wujud." };
    var lastRow = sG.getLastRow();
    if (lastRow > 1) {
      var namaSedia = sG.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < namaSedia.length; i++) {
        if ((namaSedia[i][0] || "").toString().trim() === nama) {
          sG.getRange(i + 2, 2).setValue(baru);
          return { ok: true, mesej: "Kata laluan " + nama + " ditukar." };
        }
      }
    }
    return { ok: false, mesej: "Guru '" + nama + "' tidak ditemui." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

// kelasTerlibat = senarai kelas yang DIPAPAR semasa simpan (dengan penapis).
// Hanya tugasan kelas-kelas ini diganti; tugasan kelas lain KEKAL.
function apiSimpanTugasan(senarai, senaraiGuruKelas, kelasTerlibat, kata) {
  try {
    // Keserasian dengan panggilan lama: apiSimpanTugasan(senarai, guruKelas, kata)
    if (kata === undefined) { kata = kelasTerlibat; kelasTerlibat = null; }
    if (!semakAdmin(kata)) return { ok: false, mesej: "Kata laluan admin salah." };

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sTg = ss.getSheetByName(SH_TUGASAN);
      if (!sTg) return { ok: false, mesej: "Sheet TUGASAN tidak wujud." };

      var terlibat = (kelasTerlibat && kelasTerlibat.length) ? kelasTerlibat : null;
      var dlmTerlibat = function (kelas) {
        return !terlibat || terlibat.indexOf(kelas) > -1;
      };

      // Kekalkan tugasan kelas yang TIDAK terlibat dalam simpanan ini
      var kekal = [];
      var lastRow = sTg.getLastRow();
      if (lastRow > 1) {
        sTg.getRange(2, 1, lastRow - 1, 3).getValues().forEach(function (r) {
          if (r[0] && r[1] && r[2] && !dlmTerlibat(r[0].toString().trim()))
            kekal.push([r[0].toString().trim(), r[1].toString().trim(), r[2].toString().trim()]);
        });
      }
      (senarai || []).forEach(function (t) {
        if (t.kelas && t.subjek && t.guru)
          kekal.push([t.kelas, t.subjek, t.guru]);
      });
      if (lastRow > 1) sTg.getRange(2, 1, lastRow - 1, 3).clearContent();
      if (kekal.length) sTg.getRange(2, 1, kekal.length, 3).setValues(kekal);

      // Guru kelas — gabung cara sama
      var sK = ss.getSheetByName(SH_KELAS);
      if (!sK) {
        sK = ss.insertSheet(SH_KELAS);
        sK.getRange(1, 1, 1, 2).setValues([["KELAS", "GURU KELAS"]])
          .setFontWeight("bold").setBackground("#1a237e").setFontColor("white");
        sK.setFrozenRows(1);
      }
      var petaGK = {};
      var lastKelas = sK.getLastRow();
      if (lastKelas > 1) {
        sK.getRange(2, 1, lastKelas - 1, 2).getValues().forEach(function (r) {
          var kelas = r[0] ? r[0].toString().trim() : "";
          if (kelas) petaGK[kelas] = r[1] ? r[1].toString().trim() : "";
        });
      }
      // Kelas terlibat: kemaskini guru kelas (termasuk kosongkan jika tiada pilihan)
      if (terlibat) terlibat.forEach(function (kelas) {
        if (petaGK.hasOwnProperty(kelas)) petaGK[kelas] = petaGK[kelas]; // kekal baris
      });
      (senaraiGuruKelas || []).forEach(function (gk) {
        if (gk && gk.kelas) petaGK[gk.kelas.toString().trim()] =
          gk.guru ? gk.guru.toString().trim() : "";
      });
      var barisGK = Object.keys(petaGK).map(function (kelas) {
        return [kelas, petaGK[kelas]];
      });
      if (lastKelas > 1) sK.getRange(2, 1, lastKelas - 1, 2).clearContent();
      if (barisGK.length) sK.getRange(2, 1, barisGK.length, 2).setValues(barisGK);

      var bilBaru = (senarai || []).length;
      return { ok: true, mesej: bilBaru + " tugasan subjek disimpan" +
               (terlibat ? " (kelas: " + terlibat.join(", ") + ")" : "") +
               ". Tugasan kelas lain kekal." };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

function apiTukarKataLaluan(baru, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Sesi admin tidak sah." };
    baru = (baru || "").toString().trim();
    if (baru.length < 4)
      return { ok: false, mesej: "Kata laluan baharu mesti sekurang-kurangnya 4 aksara." };
    var sT = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_TETAPAN);
    if (!sT) return { ok: false, mesej: "Sheet TETAPAN tidak wujud." };
    sT.getRange("B5").setValue(baru);
    return { ok: true, mesej: "Kata laluan admin ditukar." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

// Muat naik data murid dari CSV (cth: eksport iDMe/APDM)
// senarai = [{nama, jantina, kelas, tahun, agama, ic}]
function apiUploadMurid(senarai, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Kata laluan admin salah." };
    if (!senarai || !senarai.length)
      return { ok: false, mesej: "Tiada data murid diterima." };

    var mapTahun = {
      "TAHUN SATU":"1","TAHUN DUA":"2","TAHUN TIGA":"3",
      "TAHUN EMPAT":"4","TAHUN LIMA":"5","TAHUN ENAM":"6",
      "1":"1","2":"2","3":"3","4":"4","5":"5","6":"6"
    };

    var baris = [];
    for (var i = 0; i < senarai.length; i++) {
      var m = senarai[i];
      var nama = (m.nama || "").toString().trim().toUpperCase();
      if (!nama) continue;

      var tahunRaw = (m.tahun || "").toString().trim().toUpperCase();
      var digit = mapTahun[tahunRaw] || "";
      if (!digit) {
        // cuba ekstrak digit dari teks (cth "TAHUN 4", "4 BIJAK")
        var padan = tahunRaw.match(/[1-6]/);
        if (padan) digit = padan[0];
      }
      if (!digit) continue; // langkau prasekolah / tiada tahun

      var kelasRaw = (m.kelas || "").toString().trim().toUpperCase();
      var kelas = /^[1-6] /.test(kelasRaw) ? kelasRaw
                : (digit + " " + kelasRaw).trim();

      var jRaw = (m.jantina || "").toString().trim().toUpperCase();
      var jantina = (jRaw === "L" || jRaw.indexOf("LELAKI") > -1) ? "L"
                  : (jRaw === "P" || jRaw.indexOf("PEREMPUAN") > -1) ? "P" : "";

      baris.push([nama, jantina, kelas, digit,
        (m.agama || "").toString().trim(), (m.ic || "").toString().trim()]);
    }

    if (!baris.length)
      return { ok: false, mesej: "Tiada baris murid yang sah. Semak pemetaan lajur." };

    var sMu = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_MURID);
    if (!sMu) return { ok: false, mesej: "Sheet MURID tidak wujud." };
    isiICMarkahDaripadaMurid(getMuridSemua());
    var lastRow = sMu.getLastRow();
    if (lastRow > 1) sMu.getRange(2, 1, lastRow - 1, 6).clearContent();
    sMu.getRange(2, 1, baris.length, 6).setValues(baris);
    segerakCalonPeperiksaanAktif();

    return { ok: true, mesej: baris.length + " murid dimuat naik. " +
             "Senarai murid lama digantikan sepenuhnya." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

// ════════════════════════════════════════════════════════════════
// API GURU: TETAPKAN SUBJEK YANG DIAJAR SENDIRI
// Sinkron dengan sheet TUGASAN yang sama digunakan admin:
// - Subjek yang sudah dipegang guru LAIN tidak boleh diambil
// - Tugasan admin untuk guru ini dipaparkan & boleh diubah oleh guru
// ════════════════════════════════════════════════════════════════

function apiSimpanTugasanGuru(namaKelas, senaraiSubjek, auth) {
  try {
    var sesi = sahkanSesi(auth && auth.sesi);
    if (!sesi || sesi.peranan !== "guru" || !sesi.guru)
      return { ok: false, mesej: "Sila login sebagai guru." };
    var saya = sesi.guru;

    if (!namaKelas || getKelasSemua().indexOf(namaKelas) === -1)
      return { ok: false, mesej: "Kelas tidak sah." };

    // Subjek mesti sah untuk tahap kelas ini
    var tahap1 = isTahap1Kelas(namaKelas);
    var sah = getSubjekSemua().filter(function (s) {
      if (s.tahap2Sahaja && tahap1) return false;
      if (s.tahap1Sahaja && !tahap1) return false;
      return true;
    }).map(function (s) { return s.n; });
    for (var i = 0; i < (senaraiSubjek || []).length; i++) {
      if (sah.indexOf(senaraiSubjek[i]) === -1)
        return { ok: false, mesej: "Subjek '" + senaraiSubjek[i] +
                 "' tidak sah untuk kelas " + namaKelas + "." };
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sTg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_TUGASAN);
      if (!sTg) return { ok: false, mesej: "Sheet TUGASAN tidak wujud." };

      var rows = [];
      var lastRow = sTg.getLastRow();
      if (lastRow > 1) {
        sTg.getRange(2, 1, lastRow - 1, 3).getValues().forEach(function (r) {
          if (r[0] && r[1] && r[2])
            rows.push({ kelas: r[0].toString().trim(), subjek: r[1].toString().trim(),
                        guru: r[2].toString().trim() });
        });
      }

      // Buang tugasan SAYA untuk kelas ini (akan diganti dengan pilihan baharu)
      rows = rows.filter(function (r) {
        return !(r.kelas === namaKelas && r.guru === saya);
      });

      // Tambah pilihan baharu — subjek milik guru lain tidak boleh diambil
      var konflik = [];
      (senaraiSubjek || []).forEach(function (s) {
        var lain = null;
        rows.forEach(function (r) {
          if (r.kelas === namaKelas && r.subjek === s) lain = r.guru;
        });
        if (lain) konflik.push(s + " (dipegang " + lain + ")");
        else rows.push({ kelas: namaKelas, subjek: s, guru: saya });
      });

      var baris = rows.map(function (r) { return [r.kelas, r.subjek, r.guru]; });
      if (lastRow > 1) sTg.getRange(2, 1, lastRow - 1, 3).clearContent();
      if (baris.length) sTg.getRange(2, 1, baris.length, 3).setValues(baris);

      var mesej = "Tugasan anda untuk " + namaKelas + " disimpan.";
      if (konflik.length)
        mesej += " Tidak dapat ambil: " + konflik.join(", ") + " — hubungi admin.";
      return { ok: true, mesej: mesej, konflik: konflik };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

// ════════════════════════════════════════════════════════════════
// API ADMIN: IDENTITI SEKOLAH (NAMA & LOGO)
// ════════════════════════════════════════════════════════════════

function apiSimpanSekolah(nama, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Sesi admin tidak sah." };
    nama = (nama || "").toString().trim().toUpperCase();
    if (!nama) return { ok: false, mesej: "Nama sekolah kosong." };
    var sT = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_TETAPAN);
    if (!sT) return { ok: false, mesej: "Sheet TETAPAN tidak wujud." };
    sT.getRange("B2").setValue(nama);
    return { ok: true, mesej: "Nama sekolah ditukar kepada '" + nama + "'." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

// base64 = kandungan imej (tanpa prefix data:), mime = cth "image/png"
function apiSimpanLogo(base64, mime, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Sesi admin tidak sah." };
    if (!base64) return { ok: false, mesej: "Tiada imej diterima." };
    if (["image/png", "image/jpeg", "image/gif", "image/webp"].indexOf(mime) === -1)
      return { ok: false, mesej: "Format imej tidak disokong. Guna PNG/JPG/GIF/WEBP." };

    var bait = Utilities.base64Decode(base64);
    if (bait.length > 512 * 1024)
      return { ok: false, mesej: "Imej terlalu besar (max 500KB). Kecilkan dahulu." };

    var blob = Utilities.newBlob(bait, mime, "Logo Sekolah");
    var folder = getFolderSistem();

    // Padam logo lama dalam folder
    var lama = folder.getFilesByName("Logo Sekolah");
    while (lama.hasNext()) lama.next().setTrashed(true);

    var fail = folder.createFile(blob);
    var sT = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_TETAPAN);
    if (!sT) return { ok: false, mesej: "Sheet TETAPAN tidak wujud." };
    sT.getRange("A7").setValue("LOGO (ID FAIL)").setFontWeight("bold");
    sT.getRange("B7").setValue(fail.getId());
    return { ok: true, mesej: "Logo disimpan dalam folder SEMAK." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

function apiPadamLogo(kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Sesi admin tidak sah." };
    var sT = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_TETAPAN);
    if (!sT) return { ok: false, mesej: "Sheet TETAPAN tidak wujud." };
    sT.getRange("B7").clearContent();
    return { ok: true, mesej: "Logo dibuang. Paparan kembali ke lalai 📘." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

// ════════════════════════════════════════════════════════════════
// API ADMIN: URUS MATA PELAJARAN & KELAS
// ════════════════════════════════════════════════════════════════

// tahap: "" (semua tahun) | "1" | "2"; syarat: "" | "ISLAM" | "BUKAN ISLAM"
function apiTambahSubjek(nama, tahap, syarat, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Sesi admin tidak sah." };
    nama = (nama || "").toString().trim().toUpperCase();
    if (!nama) return { ok: false, mesej: "Nama mata pelajaran kosong." };

    var wujud = getSubjekSemua().some(function (s) { return s.n === nama; });
    if (wujud) return { ok: false, mesej: "'" + nama + "' sudah wujud." };

    var sS = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_SUBJEK);
    if (!sS) return { ok: false, mesej: "Sheet SUBJEK tidak wujud. Jalankan Pasang Sistem semula." };

    var warna = PALET_SUBJEK[(sS.getLastRow() - 1) % PALET_SUBJEK.length];
    sS.getRange(sS.getLastRow() + 1, 1, 1, 4).setValues([[
      nama, warna,
      (tahap === "1" || tahap === "2") ? tahap : "",
      (syarat === "ISLAM" || syarat === "BUKAN ISLAM") ? syarat : ""
    ]]);
    _cacheSubjek = null;
    return { ok: true, mesej: "Mata pelajaran '" + nama + "' ditambah." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

function apiPadamSubjek(nama, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Sesi admin tidak sah." };
    var sS = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_SUBJEK);
    if (!sS) return { ok: false, mesej: "Sheet SUBJEK tidak wujud." };
    var lastRow = sS.getLastRow();
    if (lastRow > 1) {
      var sedia = sS.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < sedia.length; i++) {
        if ((sedia[i][0] || "").toString().trim().toUpperCase() === nama) {
          sS.deleteRow(i + 2);
          _cacheSubjek = null;
          return { ok: true, mesej: "'" + nama + "' dipadam dari senarai subjek. " +
                   "Markah sedia ada TIDAK dipadam dari pangkalan data." };
        }
      }
    }
    return { ok: false, mesej: "'" + nama + "' tidak ditemui." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

function apiTambahKelas(nama, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Sesi admin tidak sah." };
    nama = (nama || "").toString().trim().toUpperCase();
    if (!/^[1-6] .+/.test(nama))
      return { ok: false, mesej: "Format kelas: digit tahun + nama, cth '4 CERDIK'." };
    if (getKelasSemua().indexOf(nama) > -1)
      return { ok: false, mesej: "Kelas '" + nama + "' sudah wujud." };

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sK = ss.getSheetByName(SH_KELAS);
    if (!sK) {
      sK = ss.insertSheet(SH_KELAS);
      sK.getRange(1, 1, 1, 2).setValues([["KELAS", "GURU KELAS"]])
        .setFontWeight("bold").setBackground("#1a237e").setFontColor("white");
      sK.setFrozenRows(1);
    }
    sK.getRange(sK.getLastRow() + 1, 1).setValue(nama);
    return { ok: true, mesej: "Kelas '" + nama + "' ditambah. " +
             "Muat naik/segerak data murid untuk mengisi senarai muridnya." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

function apiPadamKelas(nama, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Sesi admin tidak sah." };
    var adaMurid = getMuridSemua().some(function (m) { return m.kelas === nama; });
    if (adaMurid)
      return { ok: false, mesej: "Kelas '" + nama + "' mempunyai murid — tidak boleh dipadam. " +
               "Hanya kelas manual tanpa murid boleh dipadam." };
    var sK = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_KELAS);
    if (!sK || sK.getLastRow() < 2)
      return { ok: false, mesej: "Kelas '" + nama + "' tidak ditemui dalam senarai manual." };
    var sedia = sK.getRange(2, 1, sK.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < sedia.length; i++) {
      if ((sedia[i][0] || "").toString().trim().toUpperCase() === nama) {
        sK.deleteRow(i + 2);
        return { ok: true, mesej: "Kelas '" + nama + "' dipadam." };
      }
    }
    return { ok: false, mesej: "Kelas '" + nama + "' tidak ditemui dalam senarai manual." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

function apiSegerakMuridAdmin(kata) {
  if (!semakAdmin(kata)) return { ok: false, mesej: "Kata laluan admin salah." };
  var bil = segerakMurid(true);
  return { ok: true, mesej: bil + " murid disegerak dari Sheet1." };
}

function apiBackupAdmin(kata) {
  if (!semakAdmin(kata)) return { ok: false, mesej: "Kata laluan admin salah." };
  var nama = buatBackup(true);
  return { ok: true, mesej: "Backup dibuat: " + nama };
}

function apiTetapkanAktif(nama, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Kata laluan admin salah." };
    var sT = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_TETAPAN);
    if (!sT) return { ok: false, mesej: "Sheet TETAPAN tidak wujud." };
    nama = (nama || "").toString().trim();
    if (nama) {
      var wujud = getPeperiksaanSemua().some(function (p) { return p.nama === nama; });
      if (!wujud) return { ok: false, mesej: "Peperiksaan dipilih tidak ditemui." };
    }
    sT.getRange("B4").setValue(nama);
    if (nama) pastikanSnapshotCalonPeperiksaan(nama);
    return { ok: true, mesej: nama
      ? "'" + nama + "' kini peperiksaan aktif untuk pengisian markah."
      : "Tiada peperiksaan aktif. Pengisian markah ditutup." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

// ════════════════════════════════════════════════════════════════
// DALAMAN
// ════════════════════════════════════════════════════════════════

function _bacaDBMarkah() {
  var sMk = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_MARKAH);
  if (!sMk) return [];
  var lastRow = sMk.getLastRow();
  if (lastRow < 2) return [];
  var bilLajur = Math.min(9, sMk.getLastColumn());
  var data = sMk.getRange(2, 1, lastRow - 1, bilLajur).getValues();
  return data.map(function (r) {
    while (r.length < 9) r.push("");
    return r;
  });
}

// ════════════════════════════════════════════════════════════════
// API UNTUK PAPARAN GITHUB PAGES
// GitHub menghantar panggilan melalui POST borang supaya data Sheet dan
// kata laluan tidak diletakkan pada URL. Hanya fungsi dalam senarai ini
// boleh dipanggil dari luar.
// ════════════════════════════════════════════════════════════════

function doPost(e) {
  var id = e && e.parameter ? String(e.parameter.id || "") : "";
  try {
    if (!e || !e.parameter || e.parameter.mode !== "rpc") {
      throw new Error("Permintaan tidak sah.");
    }

    var kaedah = String(e.parameter.kaedah || "");
    var dibenarkan = {
      apiAnalisis: apiAnalisis,
      apiInit: apiInit,
      apiKelas: apiKelas,
      apiLoginAdmin: apiLoginAdmin,
      apiLoginGuru: apiLoginGuru,
      apiMarkah: apiMarkah,
      apiPadamKelas: apiPadamKelas,
      apiPadamLogo: apiPadamLogo,
      apiPadamPeperiksaan: apiPadamPeperiksaan,
      apiPadamSubjek: apiPadamSubjek,
      apiSemakSesi: apiSemakSesi,
      apiSimpanGuru: apiSimpanGuru,
      apiSimpanGuruBesar: apiSimpanGuruBesar,
      apiSimpanLogo: apiSimpanLogo,
      apiSimpanMarkah: apiSimpanMarkah,
      apiSimpanPeperiksaan: apiSimpanPeperiksaan,
      apiSimpanSekolah: apiSimpanSekolah,
      apiSimpanTugasan: apiSimpanTugasan,
      apiSimpanTugasanGuru: apiSimpanTugasanGuru,
      apiStatus: apiStatus,
      apiTambahKelas: apiTambahKelas,
      apiTambahPeperiksaan: apiTambahPeperiksaan,
      apiTambahSubjek: apiTambahSubjek,
      apiTetapkanAktif: apiTetapkanAktif
    };

    if (!Object.prototype.hasOwnProperty.call(dibenarkan, kaedah)) {
      throw new Error("Fungsi tidak dibenarkan.");
    }

    var argumen = JSON.parse(e.parameter.argumen || "[]");
    if (!Array.isArray(argumen)) throw new Error("Argumen tidak sah.");
    var hasil = dibenarkan[kaedah].apply(null, argumen);
    return _jawapanRpcGitHub(id, true, hasil, "");
  } catch (ralat) {
    return _jawapanRpcGitHub(
      id,
      false,
      null,
      ralat && ralat.message ? ralat.message : String(ralat)
    );
  }
}

function _jawapanRpcGitHub(id, ok, hasil, ralat) {
  var muatan = JSON.stringify({
    sumber: "semak-rpc",
    id: id,
    ok: ok,
    hasil: hasil,
    ralat: ralat || ""
  });
  // Base64 memastikan nama murid atau data Sheet tidak boleh memecahkan
  // JavaScript di dalam respons HTML (termasuk aksara Unicode luar biasa).
  var muatan64 = Utilities.base64Encode(muatan, Utilities.Charset.UTF_8);

  var html = "<!doctype html><html><head><meta charset='utf-8'></head><body>" +
    "<script>(function(){var b=atob('" + muatan64 + "'),a=new Uint8Array(b.length);" +
    "for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);" +
    "var p=JSON.parse(new TextDecoder('utf-8').decode(a));" +
    "try{window.parent.postMessage(p,'*');}catch(e){}" +
    "try{window.parent.parent.postMessage(p,'https://sepadan.github.io');}catch(e){}" +
    "try{window.parent.parent.parent.postMessage(p,'https://sepadan.github.io');}catch(e){}" +
    "try{window.parent.parent.parent.parent.postMessage(p,'https://sepadan.github.io');}catch(e){}" +
    "try{window.top.postMessage(p,'https://sepadan.github.io');}catch(e){}" +
    "})();</script></body></html>";

  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
// ================================================================
//  SISTEM MARKAH SEKOLAH v2 — API WEB APP (AppBackend.gs)
//  Berpasangan dengan App.html
//  auth = { peranan: "admin"|"guru", guru: "...", kata: "..." }
// ================================================================

function doGet() {
  var t = getTetapan();
  return HtmlService.createHtmlOutputFromFile("App")
    .setTitle("SEMAK — " + t.sekolah)
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Sesi web bertahan sehingga enam jam. Yang disimpan di pelayar ialah token rawak,
// bukan kata laluan admin atau guru.
var TEMPOH_SESI_SAAT = 21600;

function _ciptaSesi(peranan, guru) {
  var token = Utilities.getUuid() + Utilities.getUuid();
  var data = { peranan: peranan, guru: guru || "" };
  CacheService.getScriptCache().put("SESI_" + token, JSON.stringify(data), TEMPOH_SESI_SAAT);
  return token;
}

function sahkanSesi(token) {
  if (!token) return null;
  var mentah = CacheService.getScriptCache().get("SESI_" + token);
  if (!mentah) return null;
  try { return JSON.parse(mentah); } catch (e) { return null; }
}

function apiSemakSesi(token) {
  var sesi = sahkanSesi(token);
  return sesi ? { ok: true, peranan: sesi.peranan, guru: sesi.guru } : { ok: false };
}

// ════════════════════════════════════════════════════════════════
// API: DATA PERMULAAN
// ════════════════════════════════════════════════════════════════

function apiInit() {
  var t     = getTetapan();
  var murid = getMuridSemua();
  isiICMarkahDaripadaMurid(murid);

  // Kesatuan kelas dari MURID + kelas manual dari sheet KELAS
  var kelasUnik = getKelasSemua();

  // Info setiap kelas: tahap1 & ada murid bukan Islam (untuk matriks tugasan)
  var kelasInfo = {};
  kelasUnik.forEach(function (k) {
    var mk = murid.filter(function (m) { return m.kelas === k; });
    kelasInfo[k] = {
      tahap1: isTahap1Kelas(k),
      // Kelas manual tanpa murid: benarkan P. Moral ditanda (admin tentukan)
      adaMoral: mk.length ? mk.some(function (m) { return !isIslam(m.agama); }) : true,
      bilMurid: mk.length
    };
  });

  // Logo sekolah (data URL — boleh terus dipapar & dicetak)
  var logo = "";
  if (t.logoId) {
    try {
      var blobLogo = DriveApp.getFileById(t.logoId).getBlob();
      logo = "data:" + blobLogo.getContentType() + ";base64," +
             Utilities.base64Encode(blobLogo.getBytes());
    } catch (e) {}
  }

  return {
    sekolah: t.sekolah, tahun: t.tahun, aktif: t.aktif, guruBesar: t.guruBesar,
    logo: logo,
    kelas: kelasUnik,
    kelasInfo: kelasInfo,
    subjekSemua: getSubjekSemua().map(function (s) {
      return { n: s.n, w: s.w, tahap2Sahaja: !!s.tahap2Sahaja,
               tahap1Sahaja: !!s.tahap1Sahaja,
               bukanIslamSahaja: !!s.bukanIslamSahaja };
    }),
    guru: getGuruSemua(),
    peperiksaan: getPeperiksaanSemua(),
    tugasan: getTugasanSemua(),
    guruKelas: getGuruKelasMap()
  };
}

// ════════════════════════════════════════════════════════════════
// API: LOGIN ADMIN
// ════════════════════════════════════════════════════════════════

function apiLoginAdmin(kata) {
  if (!semakAdmin(kata)) return { ok: false };
  return { ok: true, sesi: _ciptaSesi("admin", "") };
}

function apiLoginGuru(nama, kata) {
  if (!semakGuru(nama, kata)) return { ok: false };
  return { ok: true, sesi: _ciptaSesi("guru", nama) };
}

// ════════════════════════════════════════════════════════════════
// API: MURID & SUBJEK UNTUK SATU KELAS
// ════════════════════════════════════════════════════════════════

function apiKelas(namaKelas, peperiksaan) {
  var sumberMurid = peperiksaan ? getMuridPeperiksaan(peperiksaan) : getMuridSemua();
  var muridKelas = sumberMurid.filter(function (m) {
    return m.kelas === namaKelas;
  });
  var subjekList = subjekUntukKelas(namaKelas, muridKelas);
  return {
    tahap1: isTahap1Kelas(namaKelas),
    subjek: subjekList.map(function (s) { return { n: s.n, w: s.w }; }),
    murid: muridKelas.map(function (m, i) {
      var ambil = {};
      subjekList.forEach(function (s) { ambil[s.n] = muridAmbilSubjek(m, s.n); });
      return { bil: i + 1, nama: m.nama, jantina: m.jantina, ic: m.ic, ambil: ambil };
    })
  };
}

// ════════════════════════════════════════════════════════════════
// API: BACA MARKAH
// ════════════════════════════════════════════════════════════════

function apiMarkah(peperiksaan, namaKelas) {
  var peta = {};
  _bacaDBMarkah().forEach(function (r) {
    if (r[0] !== peperiksaan || r[1] !== namaKelas) return;
    var id = r[8] ? r[8].toString().trim() : (r[2] ? r[2].toString().trim() : "");
    if (!id) return;
    if (!peta[id]) peta[id] = {};
    peta[id][r[3]] = { m: r[4], tp: r[5] };
  });
  return peta;
}

// ════════════════════════════════════════════════════════════════
// KAWALAN AKSES SIMPAN MARKAH
// ════════════════════════════════════════════════════════════════

function _semakKebenaranSimpan(peperiksaan, namaKelas, subjek, auth) {
  auth = auth || {};
  var sesi = sahkanSesi(auth.sesi);
  var isAdmin = sesi && sesi.peranan === "admin";

  var tetapan = getTetapan();
  if (!tetapan.aktif)
    return { ok: false, mesej: "Tiada peperiksaan aktif. Pengisian markah sedang ditutup." };
  if (tetapan.aktif !== peperiksaan)
    return { ok: false, mesej: "Hanya peperiksaan aktif ('" + tetapan.aktif + "') boleh diisi sekarang." };

  // Konfigurasi peperiksaan
  var cfg = null;
  getPeperiksaanSemua().forEach(function (p) {
    if (p.nama === peperiksaan) cfg = p;
  });
  if (!cfg) return { ok: false, mesej: "Peperiksaan '" + peperiksaan + "' tidak wujud." };
  if (cfg.kunci)
    return { ok: false, mesej: "Peperiksaan ini telah DIKUNCI. Pengisian markah ditutup untuk semua pengguna." };
  if (cfg.kelas && cfg.kelas.indexOf(namaKelas) === -1)
    return { ok: false, mesej: "Kelas " + namaKelas + " tidak turut serta dalam peperiksaan ini." };
  var subjekCfg = subjekCfgUntukKelas(cfg, namaKelas);
  if (subjekCfg && subjekCfg.indexOf(subjek) === -1)
    return { ok: false, mesej: "Subjek " + subjek + " tiada dalam peperiksaan ini untuk kelas " + namaKelas + "." };

  if (isAdmin) return { ok: true };

  // Guru: mesti ditugaskan untuk kelas+subjek ini
  if (sesi && sesi.peranan === "guru" && sesi.guru) {
    var padan = getTugasanSemua().some(function (t) {
      return t.kelas === namaKelas && t.subjek === subjek && t.guru === sesi.guru;
    });
    if (padan) return { ok: true };
    return { ok: false, mesej: "Anda tidak ditugaskan untuk " + subjek +
             " kelas " + namaKelas + ". Hubungi admin." };
  }

  return { ok: false, mesej: "Sila login untuk menyimpan markah." };
}

// ════════════════════════════════════════════════════════════════
// API: SIMPAN MARKAH
// ════════════════════════════════════════════════════════════════

function apiSimpanMarkah(peperiksaan, namaKelas, subjek, data, auth) {
  try {
    if (!peperiksaan || !namaKelas || !subjek)
      return { ok: false, mesej: "Maklumat tidak lengkap." };

    var kebenaran = _semakKebenaranSimpan(peperiksaan, namaKelas, subjek, auth);
    if (!kebenaran.ok) return kebenaran;

    for (var i = 0; i < data.length; i++) {
      if (!data[i].ic || data[i].ic.toString().trim() === "")
        return { ok: false, mesej: "IC/MyKad tidak ditemui untuk " + data[i].nama + ". Sila segerak data murid dahulu." };
      var v = data[i].markah;
      if (v === "" || v === null || v === undefined || v === "TH") continue;
      var n = Number(v);
      if (isNaN(n) || n < 0 || n > 100)
        return { ok: false, mesej: "Markah tidak sah untuk " + data[i].nama +
                 " (" + v + "). Mesti 0-100 atau TH." };
      var tp = data[i].tp;
      if (tp !== "" && tp !== null && tp !== undefined && tp !== "TH") {
        var t = Number(tp);
        if (isNaN(t) || t < 1 || t > 6)
          return { ok: false, mesej: "TP tidak sah untuk " + data[i].nama +
                   " (" + tp + "). Mesti 1-6." };
      }
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sMk = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_MARKAH);
      if (!sMk) return { ok: false, mesej: "Sheet MARKAH tidak wujud." };
      if (sMk.getMaxColumns() < 9) sMk.insertColumnAfter(sMk.getMaxColumns());
      if (!sMk.getRange("I1").getValue()) sMk.getRange("I1").setValue("IC MURID");

      var cap = new Date();
      var lastRow = sMk.getLastRow();
      var kekal = [];
      if (lastRow > 1) {
        kekal = sMk.getRange(2, 1, lastRow - 1, 9).getValues().filter(function (r) {
          return !(r[0] === peperiksaan && r[1] === namaKelas && r[3] === subjek);
        });
      }

      var sesiPengisi = sahkanSesi(auth && auth.sesi);
      var pengisi = sesiPengisi && sesiPengisi.peranan === "admin" ? "ADMIN"
                   : (sesiPengisi ? sesiPengisi.guru : "");
      var baru = [];
      data.forEach(function (d) {
        var kosongM  = (d.markah === "" || d.markah === null || d.markah === undefined);
        var kosongTP = (d.tp === "" || d.tp === null || d.tp === undefined);
        if (kosongM && kosongTP) return;
        baru.push([peperiksaan, namaKelas, d.nama, subjek,
          kosongM ? "" : d.markah, kosongTP ? "" : d.tp, pengisi, cap]);
        baru[baru.length - 1].push((d.ic || "").toString().trim());
      });

      var semua = kekal.concat(baru);
      if (lastRow > 1) sMk.getRange(2, 1, lastRow - 1, 9).clearContent();
      if (semua.length) sMk.getRange(2, 1, semua.length, 9).setValues(semua);

      return { ok: true, mesej: baru.length + " markah " + subjek +
               " (" + namaKelas + ") disimpan." };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

// ════════════════════════════════════════════════════════════════
// API: STATUS PENGISIAN (ditapis ikut konfigurasi peperiksaan)
// ════════════════════════════════════════════════════════════════

function apiStatus(peperiksaan) {
  var murid = getMuridPeperiksaan(peperiksaan);
  var db    = _bacaDBMarkah();

  var cfg = null;
  getPeperiksaanSemua().forEach(function (p) { if (p.nama === peperiksaan) cfg = p; });

  var kelasUnik = [];
  murid.forEach(function (m) {
    if (m.kelas && kelasUnik.indexOf(m.kelas) === -1) kelasUnik.push(m.kelas);
  });
  kelasUnik.sort(function (a, b) { return a.localeCompare(b, "ms", { numeric: true }); });
  if (cfg && cfg.kelas) kelasUnik = kelasUnik.filter(function (k) {
    return cfg.kelas.indexOf(k) > -1;
  });

  var terisi = {};
  db.forEach(function (r) {
    if (r[0] !== peperiksaan) return;
    if (r[4] === "" || r[4] === null) return;
    var k = r[1], s = r[3];
    if (!terisi[k]) terisi[k] = {};
    if (!terisi[k][s]) terisi[k][s] = {};
    terisi[k][s][r[8] ? r[8].toString().trim() : r[2]] = true;
  });

  var tugasan = getTugasanSemua();
  var hasil = [];
  kelasUnik.forEach(function (k) {
    var muridKelas = murid.filter(function (m) { return m.kelas === k; });
    var subjekList = subjekUntukKelas(k, muridKelas);
    var subjekCfg = subjekCfgUntukKelas(cfg, k);
    if (subjekCfg) subjekList = subjekList.filter(function (s) {
      return subjekCfg.indexOf(s.n) > -1;
    });
    var baris = { kelas: k, subjek: [] };
    subjekList.forEach(function (s) {
    var patut = muridKelas.filter(function (m) {
      return muridAmbilSubjek(m, s.n);
    }).length;
      var ada = terisi[k] && terisi[k][s.n] ? Object.keys(terisi[k][s.n]).length : 0;
      var guru = "";
      tugasan.forEach(function (t) {
        if (t.kelas === k && t.subjek === s.n) guru = t.guru;
      });
      baris.subjek.push({ n: s.n, ada: ada, patut: patut, guru: guru });
    });
    hasil.push(baris);
  });

  // Header jadual: kesatuan subjek T1 + T2 yang turut serta
  var semuaSubjek = getSubjekSemua().map(function (s) { return s.n; });
  if (cfg && (cfg.subjekT1 || cfg.subjekT2)) {
    semuaSubjek = semuaSubjek.filter(function (s) {
      var dlmT1 = !cfg.subjekT1 || cfg.subjekT1.indexOf(s) > -1;
      var dlmT2 = !cfg.subjekT2 || cfg.subjekT2.indexOf(s) > -1;
      return dlmT1 || dlmT2;
    });
  }
  return { kelas: hasil, semuaSubjek: semuaSubjek, kunci: cfg ? cfg.kunci : false };
}

// ════════════════════════════════════════════════════════════════
// API: ANALISIS PENUH (ditapis ikut konfigurasi peperiksaan)
// ════════════════════════════════════════════════════════════════

function apiAnalisis(peperiksaan) {
  var t     = getTetapan();
  var murid = getMuridPeperiksaan(peperiksaan);
  var db    = _bacaDBMarkah();

  var cfg = null;
  getPeperiksaanSemua().forEach(function (p) { if (p.nama === peperiksaan) cfg = p; });

  var peta = {};
  db.forEach(function (r) {
    if (r[0] !== peperiksaan) return;
    var k = r[1], id = r[8] ? r[8].toString().trim() : (r[2] ? r[2].toString().trim() : "");
    if (!id) return;
    if (!peta[k]) peta[k] = {};
    if (!peta[k][id]) peta[k][id] = {};
    peta[k][id][r[3]] = { m: r[4], tp: r[5] };
  });

  var kelasUnik = [];
  murid.forEach(function (m) {
    if (m.kelas && kelasUnik.indexOf(m.kelas) === -1) kelasUnik.push(m.kelas);
  });
  kelasUnik.sort(function (a, b) { return a.localeCompare(b, "ms", { numeric: true }); });
  if (cfg && cfg.kelas) kelasUnik = kelasUnik.filter(function (k) {
    return cfg.kelas.indexOf(k) > -1;
  });

  var mapG = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6 };
  var hasilKelas = [];

  kelasUnik.forEach(function (k) {
    var muridKelas = murid.filter(function (m) { return m.kelas === k; });
    var subjekList = subjekUntukKelas(k, muridKelas);
    var subjekCfg = subjekCfgUntukKelas(cfg, k);
    if (subjekCfg) subjekList = subjekList.filter(function (s) {
      return subjekCfg.indexOf(s.n) > -1;
    });
    var tahap1 = isTahap1Kelas(k);

    var muridHasil = muridKelas.map(function (m, idx) {
      var rekod = [];
      var jM = 0, bM = 0, jGP = 0, bGP = 0, lulus = 0, gagal = 0, gredA = 0, th = 0;

      subjekList.forEach(function (s) {
        if (!muridAmbilSubjek(m, s.n)) return;
        var rec  = (peta[k] && peta[k][m.ic] && peta[k][m.ic][s.n]) || null;
        var mk   = rec ? rec.m : "";
        var gred = kiraGred(mk);
        var tp   = tahap1 ? (rec ? rec.tp : "") : kiraTP(mk);
        rekod.push({ subjek: s.n, markah: mk, gred: gred, tp: tp });

        if (mk === "" || mk === null) return;
        if (gred === "TH") { th++; return; }
        if (typeof mk === "number") { jM += mk; bM++; }
        if (gred === "F") gagal++; else if (mapG[gred]) lulus++;
        if (gred === "A") gredA++;
        if (mapG[gred]) { jGP += mapG[gred]; bGP++; }
      });

      return {
        bil: idx + 1, nama: m.nama, jantina: m.jantina, rekod: rekod,
        purata: bM > 0 ? +(jM / bM).toFixed(2) : null,
        gpmp:   bGP > 0 ? +(jGP / bGP).toFixed(2) : null,
        lulus: lulus, gagal: gagal, gredA: gredA, th: th, ambil: lulus + gagal
      };
    });

    muridHasil.slice().sort(function (a, b) {
      if (a.purata === null) return 1;
      if (b.purata === null) return -1;
      return b.purata - a.purata;
    }).forEach(function (m, i) { m.rank = (m.purata === null) ? null : i + 1; });

    var subjekStats = subjekList.map(function (s) {
      var st = { subjek: s.n, warna: s.w, A:0,B:0,C:0,D:0,E:0,F:0,
                 th:0, lulus:0, gagal:0, ambil:0, jGP:0, jM:0, bM:0 };
      muridHasil.forEach(function (m) {
        var r = null;
        for (var i = 0; i < m.rekod.length; i++)
          if (m.rekod[i].subjek === s.n) { r = m.rekod[i]; break; }
        if (!r || r.markah === "" || r.markah === null) return;
        if (r.gred === "TH") { st.th++; return; }
        if (st.hasOwnProperty(r.gred)) st[r.gred]++;
        if (r.gred === "F") st.gagal++;
        else if ("ABCDE".indexOf(r.gred) > -1) st.lulus++;
        if (mapG[r.gred]) { st.jGP += mapG[r.gred]; st.ambil++; }
        if (typeof r.markah === "number") { st.jM += r.markah; st.bM++; }
      });
      st.gpmp   = st.ambil > 0 ? +(st.jGP / st.ambil).toFixed(2) : null;
      st.purata = st.bM > 0 ? +(st.jM / st.bM).toFixed(1) : null;
      st.pLulus = st.ambil > 0 ? +((st.lulus / st.ambil) * 100).toFixed(1) : null;
      delete st.jGP; delete st.jM; delete st.bM;
      return st;
    });

    var totAmbil = 0, totLulus = 0, totGP = 0, totA = 0, totTH = 0;
    subjekStats.forEach(function (st) {
      totAmbil += st.ambil; totLulus += st.lulus;
      totA += st.A; totTH += st.th;
      if (st.gpmp !== null) totGP += st.gpmp * st.ambil;
    });

    hasilKelas.push({
      nama: k, tahap1: tahap1, murid: muridHasil, subjek: subjekStats,
      ringkasan: {
        jumlahMurid: muridKelas.length,
        lelaki:    muridKelas.filter(function (m) { return m.jantina === "L"; }).length,
        perempuan: muridKelas.filter(function (m) { return m.jantina === "P"; }).length,
        gpmp:   totAmbil > 0 ? +(totGP / totAmbil).toFixed(2) : null,
        pLulus: totAmbil > 0 ? +((totLulus / totAmbil) * 100).toFixed(1) : null,
        gredA: totA, th: totTH
      }
    });
  });

  return {
    sekolah: t.sekolah, tahun: t.tahun, peperiksaan: peperiksaan,
    dijana: new Date().toLocaleString("ms-MY"),
    kelas: hasilKelas
  };
}

// ════════════════════════════════════════════════════════════════
// API ADMIN — semua memerlukan kata laluan
// ════════════════════════════════════════════════════════════════

// Cipta rekod kosong terlebih dahulu supaya ia terus muncul dalam dropdown.
// Admin kemudian memilih tanda ✓ dalam matriks sebelum menekan Simpan Peperiksaan.
function apiTambahPeperiksaan(nama, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Kata laluan admin salah." };
    nama = (nama || "").toString().trim().toUpperCase();
    if (!nama) return { ok: false, mesej: "Nama peperiksaan kosong." };

    var sP = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_PEPERIKSAAN);
    if (!sP) return { ok: false, mesej: "Sheet PEPERIKSAAN tidak wujud." };
    var lastRow = sP.getLastRow();
    if (lastRow > 1) {
      var sedia = sP.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < sedia.length; i++) {
        if ((sedia[i][0] || "").toString().trim() === nama)
          return { ok: false, mesej: "Peperiksaan '" + nama + "' sudah wujud." };
      }
    }
    if (sP.getMaxColumns() < 6) sP.insertColumnAfter(sP.getMaxColumns());
    if (!sP.getRange("F1").getValue()) {
      sP.getRange("F1").setValue("KONFIGURASI KELAS-SUBJEK")
        .setFontWeight("bold").setBackground("#1a237e").setFontColor("white");
    }
    sP.getRange(lastRow + 1, 1, 1, 6).setValues([[nama, "", "", "", "", "{}"]]);
    return { ok: true, mesej: "Peperiksaan ditambah. Pilih kelas dan mata pelajaran dalam jadual.", nama: nama };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

// konfigurasi = [{kelas: "1 BIJAK", subjek: "B. MELAYU"}, ...]
// Setiap rekod ialah satu tanda ✓ dalam matriks kelas × subjek.
function apiSimpanPeperiksaan(nama, konfigurasi, kunci, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Kata laluan admin salah." };
    nama = (nama || "").toString().trim().toUpperCase();
    if (!nama) return { ok: false, mesej: "Nama peperiksaan kosong." };

    var sP = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_PEPERIKSAAN);
    if (!sP) return { ok: false, mesej: "Sheet PEPERIKSAAN tidak wujud." };

    var peta = {};
    (konfigurasi || []).forEach(function (item) {
      if (!item || !item.kelas || !item.subjek) return;
      var kelas = item.kelas.toString().trim();
      var subjek = item.subjek.toString().trim();
      if (!peta[kelas]) peta[kelas] = [];
      if (peta[kelas].indexOf(subjek) === -1) peta[kelas].push(subjek);
    });
    if (!Object.keys(peta).length)
      return { ok: false, mesej: "Tandakan sekurang-kurangnya satu mata pelajaran untuk satu kelas." };

    // Lindungi data jika ada panggilan terus ke API: hanya kelas dan subjek
    // yang wujud serta sah mengikut tahap kelas boleh disimpan.
    // (Kelas manual tanpa murid dibenarkan — validasi ikut tahap sahaja.)
    var semuaKelas = getKelasSemua();
    Object.keys(peta).forEach(function (kelas) {
      if (semuaKelas.indexOf(kelas) === -1)
        throw new Error("Kelas '" + kelas + "' tidak wujud.");
      var tahap1 = isTahap1Kelas(kelas);
      var sah = getSubjekSemua().filter(function (s) {
        if (s.tahap2Sahaja && tahap1) return false;
        if (s.tahap1Sahaja && !tahap1) return false;
        return true;
      }).map(function (s) { return s.n; });
      peta[kelas].forEach(function (subjek) {
        if (sah.indexOf(subjek) === -1)
          throw new Error("Subjek '" + subjek + "' tidak sah untuk kelas " + kelas + ".");
      });
    });

    // Ringkasan B-D membantu pembacaan manual dan kekalkan keserasian rekod lama.
    var kelasStr = Object.keys(peta).join(", ");
    var t1 = [], t2 = [];
    Object.keys(peta).forEach(function (kelas) {
      peta[kelas].forEach(function (subjek) {
        var sasaran = isTahap1Kelas(kelas) ? t1 : t2;
        if (sasaran.indexOf(subjek) === -1) sasaran.push(subjek);
      });
    });
    var t1Str = t1.join(", ");
    var t2Str = t2.join(", ");
    var kunciStr = kunci ? "YA" : "";
    var konfigStr = JSON.stringify(peta);

    if (sP.getMaxColumns() < 6) sP.insertColumnAfter(sP.getMaxColumns());
    if (!sP.getRange("F1").getValue()) {
      sP.getRange("F1").setValue("KONFIGURASI KELAS-SUBJEK")
        .setFontWeight("bold").setBackground("#1a237e").setFontColor("white");
    }

    var lastRow = sP.getLastRow();
    var barisJumpa = 0;
    if (lastRow > 1) {
      var namaSedia = sP.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < namaSedia.length; i++) {
        if ((namaSedia[i][0] || "").toString().trim() === nama) { barisJumpa = i + 2; break; }
      }
    }
    if (barisJumpa) {
      sP.getRange(barisJumpa, 2, 1, 4).setValues([[kelasStr, t1Str, t2Str, kunciStr]]);
      sP.getRange(barisJumpa, 6).setValue(konfigStr);
      return { ok: true, mesej: "Peperiksaan '" + nama + "' dikemaskini." };
    }
    sP.getRange(lastRow + 1, 1, 1, 6).setValues([[nama, kelasStr, t1Str, t2Str, kunciStr, konfigStr]]);
    return { ok: true, mesej: "Peperiksaan '" + nama + "' ditambah." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

// PADAM PENUH: keluarkan dari senarai DAN padam semua markahnya
// dari pangkalan data MARKAH. buatBackupDulu = true/false (pilihan admin).
function apiPadamPeperiksaan(nama, buatBackupDulu, kata) {
  try {
    // Keserasian dengan panggilan lama: apiPadamPeperiksaan(nama, kata)
    if (kata === undefined) { kata = buatBackupDulu; buatBackupDulu = false; }
    if (!semakAdmin(kata)) return { ok: false, mesej: "Kata laluan admin salah." };

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sP = ss.getSheetByName(SH_PEPERIKSAAN);
      if (!sP) return { ok: false, mesej: "Sheet PEPERIKSAAN tidak wujud." };

      // Pastikan peperiksaan wujud sebelum buat apa-apa
      var barisJumpa = 0;
      var lastRow = sP.getLastRow();
      if (lastRow > 1) {
        var namaSedia = sP.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < namaSedia.length; i++) {
          if ((namaSedia[i][0] || "").toString().trim() === nama) { barisJumpa = i + 2; break; }
        }
      }
      if (!barisJumpa) return { ok: false, mesej: "'" + nama + "' tidak ditemui." };

      // 1) Backup jika diminta (SEBELUM apa-apa dipadam)
      var namaBackup = "";
      if (buatBackupDulu === true) namaBackup = buatBackup(true);

      // 2) Padam semua markah peperiksaan ini dari MARKAH
      var bilMarkah = 0;
      var sMk = ss.getSheetByName(SH_MARKAH);
      if (sMk && sMk.getLastRow() > 1) {
        var lastMk = sMk.getLastRow();
        var bilLajur = Math.min(9, sMk.getLastColumn());
        var semua = sMk.getRange(2, 1, lastMk - 1, bilLajur).getValues();
        var kekal = semua.filter(function (r) {
          if ((r[0] || "").toString().trim() === nama) { bilMarkah++; return false; }
          return true;
        });
        if (bilMarkah > 0) {
          sMk.getRange(2, 1, lastMk - 1, bilLajur).clearContent();
          if (kekal.length) sMk.getRange(2, 1, kekal.length, bilLajur).setValues(kekal);
        }
      }

      // 3) Keluarkan dari senarai peperiksaan
      sP.deleteRow(barisJumpa);
      padamCalonPeperiksaan(nama);

      // 4) Kosongkan peperiksaan aktif jika ia yang dipadam
      var sTetapan = ss.getSheetByName(SH_TETAPAN);
      if (sTetapan && (sTetapan.getRange("B4").getValue() || "").toString() === nama)
        sTetapan.getRange("B4").clearContent();

      var mesej = "'" + nama + "' dipadam sepenuhnya (" + bilMarkah + " rekod markah dibuang).";
      if (namaBackup) mesej += "\n🛡️ Backup: " + namaBackup;
      else mesej += "\n⚠️ Tiada backup dibuat (pilihan anda).";
      return { ok: true, mesej: mesej };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

function apiSimpanGuru(senaraiGuru, guruBesar, kata) {
  try {
    // Kekal serasi dengan panggilan lama: apiSimpanGuru(senaraiGuru, kata).
    if (kata === undefined) { kata = guruBesar; guruBesar = null; }
    if (!semakAdmin(kata)) return { ok: false, mesej: "Kata laluan admin salah." };
    var sG = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_GURU);
    if (!sG) return { ok: false, mesej: "Sheet GURU tidak wujud." };

    var kataSedia = getGuruKataMap(); // kekalkan kata laluan guru sedia ada
    var bersih = [];
    (senaraiGuru || []).forEach(function (g) {
      var v = (g || "").toString().trim().toUpperCase();
      if (v && bersih.indexOf(v) === -1) bersih.push(v);
    });

    var lastRow = sG.getLastRow();
    if (lastRow > 1) sG.getRange(2, 1, lastRow - 1, 2).clearContent();
    if (bersih.length)
      sG.getRange(2, 1, bersih.length, 2).setValues(bersih.map(function (g) {
        return [g, kataSedia.hasOwnProperty(g) ? kataSedia[g] : KATAGURU_LALAI];
      }));
    if (guruBesar !== null && guruBesar !== undefined) {
      guruBesar = guruBesar.toString().trim().toUpperCase();
      if (!guruBesar || bersih.indexOf(guruBesar) === -1)
        return { ok: false, mesej: "Pilih Guru Besar daripada Senarai Guru." };
      var sT = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_TETAPAN);
      if (!sT) return { ok: false, mesej: "Sheet TETAPAN tidak wujud." };
      sT.getRange("A6").setValue("NAMA GURU BESAR").setFontWeight("bold");
      sT.getRange("B6").setValue(guruBesar);
    }
    return { ok: true, mesej: bersih.length + " guru disimpan. " +
             "Guru baharu diberi kata laluan lalai '" + KATAGURU_LALAI + "'.",
             senarai: bersih };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

function apiSimpanGuruBesar(nama, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Kata laluan admin salah." };
    nama = (nama || "").toString().trim().toUpperCase();
    if (!nama) return { ok: false, mesej: "Masukkan nama Guru Besar." };
    var sT = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_TETAPAN);
    if (!sT) return { ok: false, mesej: "Sheet TETAPAN tidak wujud." };
    sT.getRange("A6").setValue("NAMA GURU BESAR").setFontWeight("bold");
    sT.getRange("B6").setValue(nama);
    return { ok: true, mesej: "Nama Guru Besar disimpan." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

function apiSetKataGuru(nama, baru, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Kata laluan admin salah." };
    baru = (baru || "").toString().trim();
    if (baru.length < 4)
      return { ok: false, mesej: "Kata laluan guru mesti sekurang-kurangnya 4 aksara." };
    var sG = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_GURU);
    if (!sG) return { ok: false, mesej: "Sheet GURU tidak wujud." };
    var lastRow = sG.getLastRow();
    if (lastRow > 1) {
      var namaSedia = sG.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < namaSedia.length; i++) {
        if ((namaSedia[i][0] || "").toString().trim() === nama) {
          sG.getRange(i + 2, 2).setValue(baru);
          return { ok: true, mesej: "Kata laluan " + nama + " ditukar." };
        }
      }
    }
    return { ok: false, mesej: "Guru '" + nama + "' tidak ditemui." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

// kelasTerlibat = senarai kelas yang DIPAPAR semasa simpan (dengan penapis).
// Hanya tugasan kelas-kelas ini diganti; tugasan kelas lain KEKAL.
function apiSimpanTugasan(senarai, senaraiGuruKelas, kelasTerlibat, kata) {
  try {
    // Keserasian dengan panggilan lama: apiSimpanTugasan(senarai, guruKelas, kata)
    if (kata === undefined) { kata = kelasTerlibat; kelasTerlibat = null; }
    if (!semakAdmin(kata)) return { ok: false, mesej: "Kata laluan admin salah." };

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sTg = ss.getSheetByName(SH_TUGASAN);
      if (!sTg) return { ok: false, mesej: "Sheet TUGASAN tidak wujud." };

      var terlibat = (kelasTerlibat && kelasTerlibat.length) ? kelasTerlibat : null;
      var dlmTerlibat = function (kelas) {
        return !terlibat || terlibat.indexOf(kelas) > -1;
      };

      // Kekalkan tugasan kelas yang TIDAK terlibat dalam simpanan ini
      var kekal = [];
      var lastRow = sTg.getLastRow();
      if (lastRow > 1) {
        sTg.getRange(2, 1, lastRow - 1, 3).getValues().forEach(function (r) {
          if (r[0] && r[1] && r[2] && !dlmTerlibat(r[0].toString().trim()))
            kekal.push([r[0].toString().trim(), r[1].toString().trim(), r[2].toString().trim()]);
        });
      }
      (senarai || []).forEach(function (t) {
        if (t.kelas && t.subjek && t.guru)
          kekal.push([t.kelas, t.subjek, t.guru]);
      });
      if (lastRow > 1) sTg.getRange(2, 1, lastRow - 1, 3).clearContent();
      if (kekal.length) sTg.getRange(2, 1, kekal.length, 3).setValues(kekal);

      // Guru kelas — gabung cara sama
      var sK = ss.getSheetByName(SH_KELAS);
      if (!sK) {
        sK = ss.insertSheet(SH_KELAS);
        sK.getRange(1, 1, 1, 2).setValues([["KELAS", "GURU KELAS"]])
          .setFontWeight("bold").setBackground("#1a237e").setFontColor("white");
        sK.setFrozenRows(1);
      }
      var petaGK = {};
      var lastKelas = sK.getLastRow();
      if (lastKelas > 1) {
        sK.getRange(2, 1, lastKelas - 1, 2).getValues().forEach(function (r) {
          var kelas = r[0] ? r[0].toString().trim() : "";
          if (kelas) petaGK[kelas] = r[1] ? r[1].toString().trim() : "";
        });
      }
      // Kelas terlibat: kemaskini guru kelas (termasuk kosongkan jika tiada pilihan)
      if (terlibat) terlibat.forEach(function (kelas) {
        if (petaGK.hasOwnProperty(kelas)) petaGK[kelas] = petaGK[kelas]; // kekal baris
      });
      (senaraiGuruKelas || []).forEach(function (gk) {
        if (gk && gk.kelas) petaGK[gk.kelas.toString().trim()] =
          gk.guru ? gk.guru.toString().trim() : "";
      });
      var barisGK = Object.keys(petaGK).map(function (kelas) {
        return [kelas, petaGK[kelas]];
      });
      if (lastKelas > 1) sK.getRange(2, 1, lastKelas - 1, 2).clearContent();
      if (barisGK.length) sK.getRange(2, 1, barisGK.length, 2).setValues(barisGK);

      var bilBaru = (senarai || []).length;
      return { ok: true, mesej: bilBaru + " tugasan subjek disimpan" +
               (terlibat ? " (kelas: " + terlibat.join(", ") + ")" : "") +
               ". Tugasan kelas lain kekal." };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

function apiTukarKataLaluan(baru, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Sesi admin tidak sah." };
    baru = (baru || "").toString().trim();
    if (baru.length < 4)
      return { ok: false, mesej: "Kata laluan baharu mesti sekurang-kurangnya 4 aksara." };
    var sT = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_TETAPAN);
    if (!sT) return { ok: false, mesej: "Sheet TETAPAN tidak wujud." };
    sT.getRange("B5").setValue(baru);
    return { ok: true, mesej: "Kata laluan admin ditukar." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

// Muat naik data murid dari CSV (cth: eksport iDMe/APDM)
// senarai = [{nama, jantina, kelas, tahun, agama, ic}]
function apiUploadMurid(senarai, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Kata laluan admin salah." };
    if (!senarai || !senarai.length)
      return { ok: false, mesej: "Tiada data murid diterima." };

    var mapTahun = {
      "TAHUN SATU":"1","TAHUN DUA":"2","TAHUN TIGA":"3",
      "TAHUN EMPAT":"4","TAHUN LIMA":"5","TAHUN ENAM":"6",
      "1":"1","2":"2","3":"3","4":"4","5":"5","6":"6"
    };

    var baris = [];
    for (var i = 0; i < senarai.length; i++) {
      var m = senarai[i];
      var nama = (m.nama || "").toString().trim().toUpperCase();
      if (!nama) continue;

      var tahunRaw = (m.tahun || "").toString().trim().toUpperCase();
      var digit = mapTahun[tahunRaw] || "";
      if (!digit) {
        // cuba ekstrak digit dari teks (cth "TAHUN 4", "4 BIJAK")
        var padan = tahunRaw.match(/[1-6]/);
        if (padan) digit = padan[0];
      }
      if (!digit) continue; // langkau prasekolah / tiada tahun

      var kelasRaw = (m.kelas || "").toString().trim().toUpperCase();
      var kelas = /^[1-6] /.test(kelasRaw) ? kelasRaw
                : (digit + " " + kelasRaw).trim();

      var jRaw = (m.jantina || "").toString().trim().toUpperCase();
      var jantina = (jRaw === "L" || jRaw.indexOf("LELAKI") > -1) ? "L"
                  : (jRaw === "P" || jRaw.indexOf("PEREMPUAN") > -1) ? "P" : "";

      baris.push([nama, jantina, kelas, digit,
        (m.agama || "").toString().trim(), (m.ic || "").toString().trim()]);
    }

    if (!baris.length)
      return { ok: false, mesej: "Tiada baris murid yang sah. Semak pemetaan lajur." };

    var sMu = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_MURID);
    if (!sMu) return { ok: false, mesej: "Sheet MURID tidak wujud." };
    isiICMarkahDaripadaMurid(getMuridSemua());
    var lastRow = sMu.getLastRow();
    if (lastRow > 1) sMu.getRange(2, 1, lastRow - 1, 6).clearContent();
    sMu.getRange(2, 1, baris.length, 6).setValues(baris);
    segerakCalonPeperiksaanAktif();

    return { ok: true, mesej: baris.length + " murid dimuat naik. " +
             "Senarai murid lama digantikan sepenuhnya." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

// ════════════════════════════════════════════════════════════════
// API GURU: TETAPKAN SUBJEK YANG DIAJAR SENDIRI
// Sinkron dengan sheet TUGASAN yang sama digunakan admin:
// - Subjek yang sudah dipegang guru LAIN tidak boleh diambil
// - Tugasan admin untuk guru ini dipaparkan & boleh diubah oleh guru
// ════════════════════════════════════════════════════════════════

function apiSimpanTugasanGuru(namaKelas, senaraiSubjek, auth) {
  try {
    var sesi = sahkanSesi(auth && auth.sesi);
    if (!sesi || sesi.peranan !== "guru" || !sesi.guru)
      return { ok: false, mesej: "Sila login sebagai guru." };
    var saya = sesi.guru;

    if (!namaKelas || getKelasSemua().indexOf(namaKelas) === -1)
      return { ok: false, mesej: "Kelas tidak sah." };

    // Subjek mesti sah untuk tahap kelas ini
    var tahap1 = isTahap1Kelas(namaKelas);
    var sah = getSubjekSemua().filter(function (s) {
      if (s.tahap2Sahaja && tahap1) return false;
      if (s.tahap1Sahaja && !tahap1) return false;
      return true;
    }).map(function (s) { return s.n; });
    for (var i = 0; i < (senaraiSubjek || []).length; i++) {
      if (sah.indexOf(senaraiSubjek[i]) === -1)
        return { ok: false, mesej: "Subjek '" + senaraiSubjek[i] +
                 "' tidak sah untuk kelas " + namaKelas + "." };
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sTg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_TUGASAN);
      if (!sTg) return { ok: false, mesej: "Sheet TUGASAN tidak wujud." };

      var rows = [];
      var lastRow = sTg.getLastRow();
      if (lastRow > 1) {
        sTg.getRange(2, 1, lastRow - 1, 3).getValues().forEach(function (r) {
          if (r[0] && r[1] && r[2])
            rows.push({ kelas: r[0].toString().trim(), subjek: r[1].toString().trim(),
                        guru: r[2].toString().trim() });
        });
      }

      // Buang tugasan SAYA untuk kelas ini (akan diganti dengan pilihan baharu)
      rows = rows.filter(function (r) {
        return !(r.kelas === namaKelas && r.guru === saya);
      });

      // Tambah pilihan baharu — subjek milik guru lain tidak boleh diambil
      var konflik = [];
      (senaraiSubjek || []).forEach(function (s) {
        var lain = null;
        rows.forEach(function (r) {
          if (r.kelas === namaKelas && r.subjek === s) lain = r.guru;
        });
        if (lain) konflik.push(s + " (dipegang " + lain + ")");
        else rows.push({ kelas: namaKelas, subjek: s, guru: saya });
      });

      var baris = rows.map(function (r) { return [r.kelas, r.subjek, r.guru]; });
      if (lastRow > 1) sTg.getRange(2, 1, lastRow - 1, 3).clearContent();
      if (baris.length) sTg.getRange(2, 1, baris.length, 3).setValues(baris);

      var mesej = "Tugasan anda untuk " + namaKelas + " disimpan.";
      if (konflik.length)
        mesej += " Tidak dapat ambil: " + konflik.join(", ") + " — hubungi admin.";
      return { ok: true, mesej: mesej, konflik: konflik };
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

// ════════════════════════════════════════════════════════════════
// API ADMIN: IDENTITI SEKOLAH (NAMA & LOGO)
// ════════════════════════════════════════════════════════════════

function apiSimpanSekolah(nama, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Sesi admin tidak sah." };
    nama = (nama || "").toString().trim().toUpperCase();
    if (!nama) return { ok: false, mesej: "Nama sekolah kosong." };
    var sT = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_TETAPAN);
    if (!sT) return { ok: false, mesej: "Sheet TETAPAN tidak wujud." };
    sT.getRange("B2").setValue(nama);
    return { ok: true, mesej: "Nama sekolah ditukar kepada '" + nama + "'." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

// base64 = kandungan imej (tanpa prefix data:), mime = cth "image/png"
function apiSimpanLogo(base64, mime, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Sesi admin tidak sah." };
    if (!base64) return { ok: false, mesej: "Tiada imej diterima." };
    if (["image/png", "image/jpeg", "image/gif", "image/webp"].indexOf(mime) === -1)
      return { ok: false, mesej: "Format imej tidak disokong. Guna PNG/JPG/GIF/WEBP." };

    var bait = Utilities.base64Decode(base64);
    if (bait.length > 512 * 1024)
      return { ok: false, mesej: "Imej terlalu besar (max 500KB). Kecilkan dahulu." };

    var blob = Utilities.newBlob(bait, mime, "Logo Sekolah");
    var folder = getFolderSistem();

    // Padam logo lama dalam folder
    var lama = folder.getFilesByName("Logo Sekolah");
    while (lama.hasNext()) lama.next().setTrashed(true);

    var fail = folder.createFile(blob);
    var sT = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_TETAPAN);
    if (!sT) return { ok: false, mesej: "Sheet TETAPAN tidak wujud." };
    sT.getRange("A7").setValue("LOGO (ID FAIL)").setFontWeight("bold");
    sT.getRange("B7").setValue(fail.getId());
    return { ok: true, mesej: "Logo disimpan dalam folder SEMAK." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

function apiPadamLogo(kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Sesi admin tidak sah." };
    var sT = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_TETAPAN);
    if (!sT) return { ok: false, mesej: "Sheet TETAPAN tidak wujud." };
    sT.getRange("B7").clearContent();
    return { ok: true, mesej: "Logo dibuang. Paparan kembali ke lalai 📘." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

// ════════════════════════════════════════════════════════════════
// API ADMIN: URUS MATA PELAJARAN & KELAS
// ════════════════════════════════════════════════════════════════

// tahap: "" (semua tahun) | "1" | "2"; syarat: "" | "ISLAM" | "BUKAN ISLAM"
function apiTambahSubjek(nama, tahap, syarat, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Sesi admin tidak sah." };
    nama = (nama || "").toString().trim().toUpperCase();
    if (!nama) return { ok: false, mesej: "Nama mata pelajaran kosong." };

    var wujud = getSubjekSemua().some(function (s) { return s.n === nama; });
    if (wujud) return { ok: false, mesej: "'" + nama + "' sudah wujud." };

    var sS = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_SUBJEK);
    if (!sS) return { ok: false, mesej: "Sheet SUBJEK tidak wujud. Jalankan Pasang Sistem semula." };

    var warna = PALET_SUBJEK[(sS.getLastRow() - 1) % PALET_SUBJEK.length];
    sS.getRange(sS.getLastRow() + 1, 1, 1, 4).setValues([[
      nama, warna,
      (tahap === "1" || tahap === "2") ? tahap : "",
      (syarat === "ISLAM" || syarat === "BUKAN ISLAM") ? syarat : ""
    ]]);
    _cacheSubjek = null;
    return { ok: true, mesej: "Mata pelajaran '" + nama + "' ditambah." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

function apiPadamSubjek(nama, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Sesi admin tidak sah." };
    var sS = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_SUBJEK);
    if (!sS) return { ok: false, mesej: "Sheet SUBJEK tidak wujud." };
    var lastRow = sS.getLastRow();
    if (lastRow > 1) {
      var sedia = sS.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < sedia.length; i++) {
        if ((sedia[i][0] || "").toString().trim().toUpperCase() === nama) {
          sS.deleteRow(i + 2);
          _cacheSubjek = null;
          return { ok: true, mesej: "'" + nama + "' dipadam dari senarai subjek. " +
                   "Markah sedia ada TIDAK dipadam dari pangkalan data." };
        }
      }
    }
    return { ok: false, mesej: "'" + nama + "' tidak ditemui." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

function apiTambahKelas(nama, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Sesi admin tidak sah." };
    nama = (nama || "").toString().trim().toUpperCase();
    if (!/^[1-6] .+/.test(nama))
      return { ok: false, mesej: "Format kelas: digit tahun + nama, cth '4 CERDIK'." };
    if (getKelasSemua().indexOf(nama) > -1)
      return { ok: false, mesej: "Kelas '" + nama + "' sudah wujud." };

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sK = ss.getSheetByName(SH_KELAS);
    if (!sK) {
      sK = ss.insertSheet(SH_KELAS);
      sK.getRange(1, 1, 1, 2).setValues([["KELAS", "GURU KELAS"]])
        .setFontWeight("bold").setBackground("#1a237e").setFontColor("white");
      sK.setFrozenRows(1);
    }
    sK.getRange(sK.getLastRow() + 1, 1).setValue(nama);
    return { ok: true, mesej: "Kelas '" + nama + "' ditambah. " +
             "Muat naik/segerak data murid untuk mengisi senarai muridnya." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

function apiPadamKelas(nama, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Sesi admin tidak sah." };
    var adaMurid = getMuridSemua().some(function (m) { return m.kelas === nama; });
    if (adaMurid)
      return { ok: false, mesej: "Kelas '" + nama + "' mempunyai murid — tidak boleh dipadam. " +
               "Hanya kelas manual tanpa murid boleh dipadam." };
    var sK = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_KELAS);
    if (!sK || sK.getLastRow() < 2)
      return { ok: false, mesej: "Kelas '" + nama + "' tidak ditemui dalam senarai manual." };
    var sedia = sK.getRange(2, 1, sK.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < sedia.length; i++) {
      if ((sedia[i][0] || "").toString().trim().toUpperCase() === nama) {
        sK.deleteRow(i + 2);
        return { ok: true, mesej: "Kelas '" + nama + "' dipadam." };
      }
    }
    return { ok: false, mesej: "Kelas '" + nama + "' tidak ditemui dalam senarai manual." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

function apiSegerakMuridAdmin(kata) {
  if (!semakAdmin(kata)) return { ok: false, mesej: "Kata laluan admin salah." };
  var bil = segerakMurid(true);
  return { ok: true, mesej: bil + " murid disegerak dari Sheet1." };
}

function apiBackupAdmin(kata) {
  if (!semakAdmin(kata)) return { ok: false, mesej: "Kata laluan admin salah." };
  var nama = buatBackup(true);
  return { ok: true, mesej: "Backup dibuat: " + nama };
}

function apiTetapkanAktif(nama, kata) {
  try {
    if (!semakAdmin(kata)) return { ok: false, mesej: "Kata laluan admin salah." };
    var sT = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_TETAPAN);
    if (!sT) return { ok: false, mesej: "Sheet TETAPAN tidak wujud." };
    nama = (nama || "").toString().trim();
    if (nama) {
      var wujud = getPeperiksaanSemua().some(function (p) { return p.nama === nama; });
      if (!wujud) return { ok: false, mesej: "Peperiksaan dipilih tidak ditemui." };
    }
    sT.getRange("B4").setValue(nama);
    if (nama) pastikanSnapshotCalonPeperiksaan(nama);
    return { ok: true, mesej: nama
      ? "'" + nama + "' kini peperiksaan aktif untuk pengisian markah."
      : "Tiada peperiksaan aktif. Pengisian markah ditutup." };
  } catch (err) {
    return { ok: false, mesej: "Ralat: " + err.message };
  }
}

// ════════════════════════════════════════════════════════════════
// DALAMAN
// ════════════════════════════════════════════════════════════════

function _bacaDBMarkah() {
  var sMk = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_MARKAH);
  if (!sMk) return [];
  var lastRow = sMk.getLastRow();
  if (lastRow < 2) return [];
  var bilLajur = Math.min(9, sMk.getLastColumn());
  var data = sMk.getRange(2, 1, lastRow - 1, bilLajur).getValues();
  return data.map(function (r) {
    while (r.length < 9) r.push("");
    return r;
  });
}
