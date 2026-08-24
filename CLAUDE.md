# SEMAK - Arahan Projek

Baca [`docs/SEMAK-Blueprint.md`](docs/SEMAK-Blueprint.md) sepenuhnya sebelum
menganalisis atau mengubah sistem.

Blueprint itu ialah rujukan untuk seni bina, skema data, kontrak fungsi dan
ujian wajib SEMAK. Selepas sebarang perubahan fungsi, kemas kini
bahagian status, ujian dan rekod perubahan dalam blueprint pada commit yang sama.

Jangan ubah data sebenar murid atau markah semasa ujian.

---

## Hab ekosistem

Sistem ini sebahagian daripada ekosistem data SK Paya Redan. Hab dokumentasi
memegang peraturan merentas sistem, kontrak antara sistem, akaun, dan **daftar
isu tunggal**:

**<https://sepadan.github.io/dashboard/BLUEPRINT.md>**

Baca hab sebelum menyentuh apa-apa yang menjejaskan sistem lain.

`docs/SEMAK-Blueprint.md` dalam repo ini ialah **jejari** — dalaman sistem ini sahaja.

### Dua peraturan yang mudah dilanggar tanpa sedar

**Isu dicatat di hab sahaja.** Jangan mulakan senarai "belum selesai", "langkah
seterusnya" atau "status" dalam repo ini. Empat senarai isu bermakna empat versi
kebenaran, dan percanggahan itu senyap.

**Jangan percaya `raw.githubusercontent.com`.** Ia pernah memulangkan salinan
seminggu lapuk dan menyesatkan satu sesi penuh. Untuk mengetahui keadaan
sebenar: `git ls-files` selepas `git pull`, atau baca melalui
`https://sepadan.github.io/<repo>/<fail>`.
