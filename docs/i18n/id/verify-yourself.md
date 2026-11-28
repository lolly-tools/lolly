# Verifikasi Sendiri

Setiap janji di situs ini dapat diperiksa, tanpa akun. Sebagian besar pemeriksaan hanya memerlukan browser; sisanya memerlukan terminal dan salinan kode sumber. Jika pemeriksaan di bawah tidak memberikan hasil yang ditampilkan, itu adalah bug atau janji yang tidak ditepati, dan kami ingin mengetahuinya: lihat [Jika pemeriksaan gagal](#if-a-check-fails).

Pemeriksaan ini mencakup Lolly sendiri. Jika organisasi Anda menjalankan Lolly Work, layanan itu menambahkan proses masuk, konten bersama, telemetri yang dikonfigurasi dan catatan audit; periksa semuanya berdasarkan [Antarmuka Server](/info/server-surface.html) dan [bagian organisasi dalam kebijakan privasi](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-clock-->
## Lihat cara kerjanya, dalam sepuluh detik

Buka [`/verify`](/#/verify) dan jatuhkan file ke halaman. Tidak ada unggahan, tidak ada akun dan tidak perlu menunggu server. Di sini, alat ini memeriksa [gambar badai Queensland yang dihasilkan AI](/info/ai-stance.html) dari Sikap Kami tentang AI: gambar yang dihasilkan Gemini, yang dibuka, ditandai dan dikonversi oleh Lolly. Setiap lencana ditentukan di perangkat, dari byte file itu sendiri.

![Lolly Verify di layar selebar ponsel - gambar badai, kesimpulan Made with Lolly berwarna hijau serta lencana kredensial utuh dan byte tidak berubah yang tersusun di bawahnya](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Kesimpulannya berupa sekumpulan kecil lencana, masing-masing merupakan fakta tersendiri:

- <!--i:lock--> **Made with Lolly**: kredensialnya utuh *dan* mencatat ekspor Lolly.
- <!--i:seal--> **The credential is intact**: manifes C2PA yang ditandatangani dapat diuraikan dan tanda tangan klaimnya sendiri lolos verifikasi.
- <!--i:hash--> **The bytes have not changed**: hash file masih cocok dengan yang ditandatangani. Ubah satu piksel dan lencana ini berubah.
- <!--i:sparkle--> **GEN AI**: mesin membuat piksel ini, dan file menyatakannya. Lolly membaca kembali pernyataan tersebut alih-alih menyembunyikan fakta itu.

Seluruh riwayat ikut bersama file. Sembilan langkah tetap tersimpan di sini: lima dicatat Google saat menghasilkan dan memberi watermark pada gambar, lalu empat dicatat Lolly saat membuka, menandai dan mengonversi salinan di halaman ini. Lolly Verify membacanya langsung dari byte dan menggambarnya sebagai garis waktu.

![Riwayat perubahan yang dibaca kembali oleh Lolly Verify dari gambar badai - lima langkah dicatat Google, lalu empat oleh Lolly, berakhir pada WebP di halaman ini](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Pemeriksaan di bawah adalah jaminan yang mendasari demo tersebut, dan masing-masing dapat diulangi. [Content Credentials](/info/content-credentials-identity.html) menjelaskan setiap kesimpulan.

<!--i:eti-globe-->
## Di browser Anda, tanpa alat tambahan

::: timeline
- <!--i:globe--> **1. Amati jaringan.** Buka [lolly.tools](https://lolly.tools), buka DevTools browser Anda (F12), beralih ke **Network** dan gunakan alat: ketik alamat web ke [Lolly QR Code](/t/qr-code), ubah warna, ekspor PNG. Setiap permintaan menuju `lolly.tools`: shell aplikasi, file milik alat itu sendiri dan aset katalog. Tidak ada host analitik, beacon CDN, layanan font atau endpoint pelaporan kesalahan. Apa yang Anda ketik ke alat **sama sekali tidak muncul dalam permintaan apa pun**, karena render dilakukan secara lokal.
- <!--i:eyeoff--> **2. Putuskan koneksi.** Muat aplikasi dan buka satu atau dua alat, lalu putuskan koneksi internet (mode pesawat, atau DevTools → Network → Offline) dan muat ulang. Galeri dan setiap alat yang Anda buka tetap berfungsi, termasuk render dan ekspor dalam format yang Anda gunakan. File alat dan encoder format disimpan dalam cache saat pertama kali Anda menggunakannya, jadi gunakan alat sekali secara online sebelum mengujinya secara offline. Ini adalah pemeriksaan tunggal terkuat di halaman ini: perangkat lunak yang bergantung pada komunikasi dengan servernya tidak akan tetap berfungsi saat koneksinya diputus.
- <!--i:check--> **3. Hitung cookie.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Daftarnya kosong: aplikasi tidak menetapkan cookie. Tempelkan `document.cookie` ke konsol dan Anda mendapatkan `""`. Pendaftaran CA opsional menetapkan cookie `HttpOnly` berumur pendek, `lolly_ca_state`, dengan cakupan `/api/ca`, yang tidak dapat ditampilkan oleh `document.cookie`. Instans Lolly Work menggunakan cookie masuknya sendiri; bandingkan dengan [Privasi](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Baca penyimpanan Anda sendiri.** Di panel yang sama, semua yang disimpan Lolly ada di hadapan Anda: sekitar dua lusin kunci `localStorage` biasa (tema, bahasa, lebar bilah samping, pengaturan suara dan tampilan serta salinan cache indeks katalog alat publik) dan dokumen Anda sendiri di IndexedDB. Setiap nilai berupa string atau JSON yang dapat dibaca, tanpa ada yang dikaburkan. Menghapus data situs menghapus rekaman lokal ini, tetapi tidak menghapus cadangan Sync atau rekaman yang disimpan oleh instans Lolly Work. **Settings → Storage → Clear all my data** melakukan hal yang sama dari dalam aplikasi, dan Anda dapat melihat penyimpanan dan cache menjadi kosong.
- <!--i:lock--> **5. Periksa keberadaan kontak pengungkapan kerentanan.** [`/.well-known/security.txt`](/.well-known/security.txt) merespons dengan blok kontak [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), bukan halaman HTML.
:::

::: details Hal lain yang mungkin Anda lihat di tab Network
Beberapa fitur mengakses jaringan hanya saat Anda menggunakannya, dan masing-masing terlihat di tab yang sama:

- menambahkan **Google Font** di Lolly Design System Setup mengambil satu keluarga font tersebut dari Google, setelah dialog persetujuan yang menyatakannya, sekali, sebelum pengambilan pertama;
- mengeklik **preset profil cetak ICC** mengambil profil tersebut dari registri publik ICC di color.org;
- memutar **radio** bawaan opsional melakukan streaming dari stasiun;
- memasukkan lokasi di **Meeting Planner** mencari tempat tersebut melalui layanan geocoding open-meteo untuk koordinat dan zona waktunya, sekali per kota (jawaban disimpan di perangkat Anda), dan field menyatakan hal itu di tempat Anda mengetik;
- **Lolly URL Screenshot** memuat alamat yang Anda ketik, dan Anda melihatnya terjadi.

Alat yang menyatakan kapabilitas jaringan hanya boleh mengambil data dari host yang diizinkan manifesnya, dan jika pemeriksaan itu gagal, akses ditolak. Tidak ada alat yang dirilis saat ini yang menyatakannya, sehingga Content-Security-Policy yang diberlakukan browser membatasi daftar di atas pada host-hostnya. [Kebijakan privasi](/info/privacy.html) memuat tabel acuan resmi untuk semuanya, termasuk lalu lintas instans terkelola seperti pembaruan kebijakan dan pelaporan yang diaktifkan.
:::

<!--i:eti-code-->
## Dari terminal

**6. Endpoint render hanya merespons dengan data publik.** Satu fitur server yang memasukkan input ketikan ke URL, render hot-link, aktif di sini. [Kebijakan privasi](/info/privacy.html) menjelaskan artinya bagi input yang Anda masukkan ke tautan.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Setiap deployment menentukan pilihannya (`LOLLY_DISABLE_RENDER_GET=1`): pada instans yang menetapkan variabel tersebut, pemeriksaan yang sama mengembalikan `404`. Perbedaan itu menunjukkan pengaturan berfungsi, bukan ketidakkonsistenan.

**7. Periksa layanan yang diaktifkan deployment Anda.** [Antarmuka Server](/info/server-surface.html) mencantumkan layanan opsional dan menautkan referensi terperincinya. Untuk Lolly Work, sertakan API yang memerlukan autentikasi, koneksi kolaborasi, penyimpanan dan penyedia yang dikonfigurasi. Pemeriksaan terhadap lolly.tools publik tidak menguji instans organisasi privat.

Jika Anda menjalankan instans sendiri, [Deployment pengiriman](/info/deploy-delivery.html) memuat pemeriksaan rilis: integritas model, pemeriksaan edge dan daftar sampelnya, versi untuk ditampilkan, gateway unduhan privat dan katalog bertanda tangan di browser.


<!--i:eti-search-->
## Di kode sumber

Semua hal di atas masih bisa sekadar sandiwara jika kode yang di-deploy berbeda dari kode publik. Jadi periksa kodenya. Deployment dibangun dari [repositori publik](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Tidak ada pelacak dan SDK analitik, di mana pun.** Telusuri kode yang dirilis (engine, setiap shell termasuk ekstensi browser, override bridge Tauri dan service worker, fungsi server serta paket alat) untuk nama-nama yang biasa dicurigai:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Pemindaian ini mencari SDK pelacakan pihak ketiga. Ini tidak membuktikan ketiadaan pelaporan penggunaan pihak pertama: Lolly Work mendukung telemetri organisasi dan log audit terpisah, dengan kebijakan dan pengujiannya sendiri.

**9. Tidak ada resolver DNS pihak ketiga.** Pemeriksaan SEAL Lolly Verify tidak pernah mengirim pencarian melalui penyedia DNS-over-HTTPS, karena aplikasi tidak memiliki resolver:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Layanan sertifikat tidak menyimpan log penerbitan.** CA identitas tidak menyimpan log tentang apa yang diterbitkannya dan tidak menyimpan inventaris identitas: tidak ada baris stdout, webhook atau penyimpanan sertifikat. Ketiadaan ini dapat diperiksa dengan pencarian:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA memang menyimpan status kerja berumur pendek: bucket pembatasan laju menyimpan kunci IP dan email yang telah di-hash selama jendela waktunya, dan penyimpanan penerimaan deployment terkelola menyimpan pengenal berbasis kunci dan digest permintaan selama paling lama sepuluh menit. [Rekayasa Content Credentials](/info/content-credentials-engineering.html#protocol) memuat perinciannya.

<!--i:eti-flask-->
## Ditegakkan oleh pengujian

Pemeriksaan kode sumber di atas bukan audit sekali jalan: semuanya ditetapkan dalam rangkaian pengujian, sehingga tidak bisa usang diam-diam. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) memeriksa daftar nama pelacak yang lebih panjang daripada pemindaian di atas dan menggagalkan build jika:

- SDK analitik atau pelacakan apa pun muncul di mana pun dalam kode sumber yang dirilis yang dipindainya, mencakup kode aplikasi, engine, server, ekstensi dan paket alat;
- resolver DNS-over-HTTPS pihak ketiga apa pun muncul dalam kode sumber tersebut;
- log penerbitan CA muncul kembali, di kode sumber **atau** bundel server yang dihasilkan;
- kebijakan privasi kehilangan pernyataan yang diwajibkan hukum (pengendali yang disebutkan namanya, dasar hukum, hak untuk mengajukan pengaduan).

Jalankan sendiri di hasil kloning (Node 22.18 atau lebih baru; file ini tidak memerlukan `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Rangkaian lengkap (`pnpm install && pnpm test`) menjalankan beberapa ribu pengujian lagi, termasuk pengujian kriptografi adversarial yang dijelaskan dalam [Keamanan & Verifikasi](/info/security.html).

<!--i:eti-eye-off-->
## Yang tidak dapat Anda verifikasi dari luar

- **Log akses hosting.** Server apa pun dapat mencatat permintaan yang dijawabnya: alamat IP, path dan waktu. Pemeriksaan dari luar tidak dapat memastikan berapa lama log disimpan. Operator mengendalikan pencatatan log, rotasi dan ekspor, dan harus mengungkapkan pilihan tersebut. Render lokal menjaga suntingan biasa tetap di perangkat Anda; render server opsional dan layanan ruang kerja bersama memiliki aliran data terpisah yang dijelaskan dalam kebijakan privasi.
- **Bahwa deployment menjalankan kode ini.** Anda dapat memeriksa bahwa kode sumbernya bersih dan perilaku deployment sesuai dengan kode sumber, dan pemeriksaan di atas melakukan keduanya. Platform web tidak menawarkan atestasi tingkat biner untuk deployment web. Mitigasinya adalah repositori publik, pengujian yang diwajibkan dan pemeriksaan offline: deployment yang telah dimanipulasi dan mengirim data kembali ke server langsung gagal dalam pemeriksaan 1 dan 2.
- **Hook alat.** Logika opsional alat bawaan ditinjau, bukan dijalankan dalam sandbox: logika itu berjalan di halaman kecuali alat memilih Worker. Setiap alat di lolly.tools adalah buatan pihak pertama dan ditinjau sebelum dirilis. [Model Ancaman](/info/threat-model.html#trust-boundaries) menjelaskan tempat hook berjalan dan apa yang membatasinya.

<!--i:eti-warning-->
## Jika pemeriksaan gagal

Perbedaan antara halaman ini dan yang Anda amati merupakan laporan keamanan. Kirimkan melalui saluran privat di [Keamanan & Verifikasi](/info/security.html#reporting-a-vulnerability). Kami menerapkan pengungkapan terkoordinasi dan memberikan kredit kepada pelapor.
