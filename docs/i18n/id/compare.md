# Perbandingan Lolly, alat demi alat

Halaman-halaman ini menjelaskan apakah Lolly menggantikan produk lain, bekerja bersama produk tersebut atau tidak sesuai dengan pekerjaan Anda. Setiap halaman dimulai dengan hal yang lebih baik dilakukan produk lain.

_Terakhir diperiksa: 28 September 2026._

<!--i:eti-grid-->
## Bandingkan menurut produk

- [Lolly dan Canva](/info/compare-canva.html) - templat, desain sehari-hari dan produksi bersama untuk merek.
- [Lolly dan Adobe](/info/compare-adobe.html) - penyuntingan, konversi, keluaran profesional dan Content Credentials.
- [Lolly dan Figma](/info/compare-figma.html) - desain, kolaborasi langsung dan produksi aset yang dapat digunakan kembali.
- [Lolly dan Penpot](/info/compare-penpot.html) - desain open source, token bersama dan pekerjaan organisasi.
- [Lolly dan portal merek](/info/compare-brand-portals.html) - pustaka yang disetujui, templat terkunci, identitas, peninjauan dan pelaporan.
- [Lolly dan API render](/info/compare-render-apis.html) - pembuatan otomatis di perangkat Anda, di CI atau di server Anda sendiri serta [cara beralih](/info/work-move-from-render-api.html) dari Bannerbear atau Placid.
- [Lolly dan konverter file online](/info/compare-converters.html) - konversi format di perangkat Anda sendiri.

[Perbandingan Lolly](/info/positioning.html) menyajikan perbandingan tiap kemampuan. Setiap perbandingan diberi tanggal. Klaim yang tidak lagi sesuai dengan salah satu produk perlu diperbaiki.

<!--i:eti-map-pin-->
## Apa yang berjalan di mana

Setiap perbandingan mencakup dua bagian dari satu proyek open source. **Lolly** adalah engine, aplikasi dan alatnya. **Lolly Work** adalah server organisasi, yang dipelihara di [repositori lolly-work](https://github.com/lolly-tools/lolly-work). Keduanya menggunakan MPL-2.0, dan organisasi menentukan layanan Lolly Work mana yang diaktifkan.

::: cols
## Di perangkat Anda: Lolly

- Tanpa akun untuk penggunaan mandiri
- Membuat, menyunting, mengonversi dan mengekspor
- Berfungsi offline setelah alat dan aset yang diperlukan disimpan
- Content Credentials ditandatangani di perangkat
- Kolaborasi pribadi antara dua perangkat, tanpa server

## Di server organisasi Anda: Lolly Work

- Single sign-on, penyediaan akun SCIM, peran dan kebijakan
- Katalog bersama, proyek tim dan kolaborasi kerja
- Persetujuan, pelaporan penggunaan dan catatan audit
- Render server, tugas yang dapat dipulihkan dan pengiriman yang disetujui
- Penandatanganan server dengan identitas organisasi
:::

Penggunaan mandiri menyimpan file di perangkat. Memilih proyek bersama, kolaborasi kerja, render server atau pengiriman akan mengirim data yang diperlukan fitur tersebut ke server organisasi Anda.

<!--i:eti-info-->
## Asumsi dalam setiap perbandingan

Batasan ini berlaku untuk setiap halaman dalam rangkaian ini:

- **Kolaborasi Lolly Work saat ini berjalan pada satu node server.** Skala dan riwayat operasinya berbeda dari produk yang dihosting dan sudah lama berjalan. [Status dan peta jalan Lolly Work](/info/work-status.html) mencatat batasan saat ini.
- **Situs di [lolly.work](https://lolly.work) adalah sandbox demo.** Penerapan organisasi yang berkelanjutan memerlukan penyimpanan persisten dan operator. [Instal Lolly Work](/info/work-install.html) membahas keduanya.
- **Tidak ada biaya lisensi perangkat lunak per pengguna** untuk Lolly atau Lolly Work yang dihosting sendiri. Hosting, penyimpanan dan operasional tetap memerlukan biaya.
- **Tanda tangan tidak berarti penandatangan tepercaya.** Verifikator menampilkan penandatangan sebagai tepercaya hanya jika verifikator memercayai sertifikat yang menandatangani file. [Identitas Content Credentials](/info/content-credentials-identity.html) menjelaskan caranya.
