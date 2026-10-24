# Lolly dibandingkan, alat demi alat

Jika Anda sudah memakai produk lain, halaman-halaman ini menyatakan apakah Lolly menggantikan produk itu, bekerja berdampingan dengannya, atau tidak cocok untuk pekerjaan Anda. Masing-masing dimulai dengan apa yang dilakukan produk lain itu lebih baik.

_Terakhir diperiksa: 28 September 2026._

## Bandingkan menurut produk

- [Lolly dan Canva](/info/compare-canva.html) - templat, desain sehari-hari, dan produksi brand bersama.
- [Lolly dan Adobe](/info/compare-adobe.html) - penyuntingan, konversi, keluaran profesional, dan Content Credentials.
- [Lolly dan Figma](/info/compare-figma.html) - desain, kolaborasi langsung, dan produksi aset yang dapat dipakai ulang.
- [Lolly dan Penpot](/info/compare-penpot.html) - desain sumber terbuka, token bersama, dan pekerjaan organisasi.
- [Lolly dan portal brand](/info/compare-brand-portals.html) - pustaka yang disetujui, templat terkunci, identitas, tinjauan, dan pelaporan.
- [Lolly dan API rendering](/info/compare-render-apis.html) - pembuatan otomatis di perangkat Anda, di CI, atau di server Lolly Work.
- [Lolly dan konverter file online](/info/compare-converters.html) - konversi format di perangkat Anda sendiri.

Untuk tampilan per kemampuan, lihat [Perbandingan Lolly](/info/positioning.html). Setiap perbandingan diberi tanggal; klaim yang tidak lagi sesuai dengan salah satu produk perlu dikoreksi.

## Apa yang berjalan di mana

Setiap perbandingan mencakup dua bagian dari satu proyek sumber terbuka. **Lolly** adalah engine, aplikasi, dan alat. **Lolly Work** adalah server organisasi, dipelihara di [repositori lolly-work](https://github.com/lolly-tools/lolly-work). Keduanya MPL-2.0, dan organisasi memutuskan layanan Lolly Work mana yang diaktifkan.

::: cols
## Di perangkat Anda: Lolly

- Tanpa akun untuk penggunaan mandiri
- Membuat, menyunting, mengonversi, dan mengekspor
- Berfungsi offline setelah alat dan aset yang diperlukan disimpan
- Content Credentials ditandatangani di perangkat
- Collab privat antara dua perangkat, tanpa server

## Di server organisasi Anda: Lolly Work

- Single sign-on, penyediaan SCIM, peran, dan kebijakan
- Katalog bersama, proyek tim, dan work collab
- Persetujuan, pelaporan penggunaan, dan catatan audit
- Rendering server, pekerjaan yang dapat dipulihkan, dan pengiriman yang disetujui
- Penandatanganan server dengan identitas organisasi
:::

Penggunaan mandiri menjaga file di perangkat. Memilih proyek bersama, work collab, render server, atau pengiriman mengirim data yang dibutuhkan fitur itu ke server organisasi Anda.

## Apa yang diasumsikan setiap perbandingan

Batasan ini berlaku untuk setiap halaman dalam set ini, jadi dinyatakan sekali di sini:

- **Work collab berjalan pada satu node server hari ini.** Skala dan riwayat operasinya berbeda dari produk hosted yang sudah lama mapan. [Work status and roadmap](/info/work-status.html) mencatat batas saat ini.
- **Situs di [lolly.work](https://lolly.work) adalah sandbox demo.** Deployment organisasi yang tahan lama memerlukan penyimpanan persisten dan operator; [Install Lolly Work](/info/work-install.html) membahas keduanya.
- **Tidak ada biaya lisensi perangkat lunak per kursi** untuk Lolly atau Lolly Work yang di-host sendiri. Hosting, penyimpanan, dan operasi tetap memerlukan biaya.
- **Tanda tangan bukan penandatangan tepercaya.** Verifier harus memercayai sertifikat yang menandatangani file sebelum menampilkan penandatangan sebagai tepercaya; [Content Credentials Identity](/info/content-credentials-identity.html) menjelaskan caranya.
