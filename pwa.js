// SEMAK v1.1.0 · PWA — pemasangan, kemas kini dan kawalan luar talian.
(function () {
  'use strict';

  var bingkai = document.getElementById('aplikasi-semak');
  var panelLuarTalian = document.getElementById('pwa-luar-talian');

  function tetapkanSambungan() {
    var luarTalian = !navigator.onLine;
    if (panelLuarTalian) panelLuarTalian.hidden = !luarTalian;

    // Iframe dikekalkan supaya markah yang sedang ditaip tidak hilang apabila
    // talian terputus. Panel menghalang interaksi sehingga sambungan kembali.
    if (bingkai && luarTalian) {
      bingkai.setAttribute('aria-hidden', luarTalian ? 'true' : 'false');
      bingkai.setAttribute('inert', '');
    } else if (bingkai && bingkai.hasAttribute('inert')) {
      bingkai.setAttribute('aria-hidden', 'false');
      bingkai.removeAttribute('inert');
    }
  }

  window.addEventListener('online', tetapkanSambungan);
  window.addEventListener('offline', tetapkanSambungan);
  tetapkanSambungan();

  if (!('serviceWorker' in navigator)) return;
  document.documentElement.setAttribute('data-pwa-status', 'mendaftar');

  function daftarPwa() {
    navigator.serviceWorker.register('./service-worker.js', {
      scope: './',
      updateViaCache: 'none'
    }).then(function (pendaftaran) {
      document.documentElement.setAttribute('data-pwa-status', 'didaftar');
      navigator.serviceWorker.ready.then(function () {
        document.documentElement.setAttribute('data-pwa-status', 'sedia');
      });

      // Versi baharu dipasang secara automatik. Halaman semasa tidak dimuat
      // semula secara paksa supaya markah yang sedang ditaip tidak hilang;
      // binaan baharu digunakan apabila SEMAK dibuka semula.
      pendaftaran.update().catch(function () {});
    }).catch(function (ralat) {
      document.documentElement.setAttribute('data-pwa-status', 'gagal');
      if (window.console) console.warn('PWA SEMAK tidak dapat didaftarkan:', ralat);
    });
  }

  // Skrip ini berada di hujung <body>; tidak perlu menunggu iframe dan data
  // Google selesai dimuat sebelum memasang kemas kini aplikasi.
  daftarPwa();
})();
