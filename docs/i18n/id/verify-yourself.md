# Verifikasi Sendiri

Setiap janji di situs ini dapat diperiksa, tanpa akun. Sebagian besar pemeriksaan hanya memerlukan browser; sisanya memerlukan terminal dan salinan sumber. Jika pemeriksaan di bawah tidak memberi hasil yang ditunjukkan, itu bug atau janji yang dilanggar, dan kami ingin mendengarnya: lihat [If a check fails](#if-a-check-fails).

Mulai dengan yang tercepat: letakkan file di Verify. Lalu lebih jauh: perhatikan jaringan saat Anda memakai alat, cabut kabel dan terus bekerja, hitung cookie, dan baca sumbernya.

Pemeriksaan ini mencakup Lolly sendiri. Jika organisasi Anda menjalankan Lolly Work, ia menambahkan login, konten bersama, telemetri yang dikonfigurasi, dan catatan audit; periksa itu terhadap [Server Surface](/info/server-surface.html) dan [bagian organisasi pada kebijakan privasi](/info/privacy.html#organisation-services-with-lolly-work).

## Lihat cara kerjanya, dalam sepuluh detik

Buka [`/verify`](/#/verify) dan letakkan file di halaman. Tidak ada unggahan, tidak ada akun, dan tidak ada menunggu server. Di sini ia memeriksa [badai Queensland yang dihasilkan](/info/ai-stance.html) dari Our AI Stance: gambar yang dihasilkan Gemini, yang dibuka, ditandai, dan dikonversi Lolly. Setiap lencana dihitung di perangkat, dari byte file itu sendiri.

![Verify di layar selebar ponsel - gambar badai, verdict hijau Made with Lolly dan lencana credential-intact serta bytes-unchanged bertumpuk di bawahnya](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Vonisnya adalah setumpuk kecil lencana, masing-masing fakta yang berdiri sendiri:

- <!--i:lock--> **Made with Lolly**: kredensial utuh *dan* mencatat ekspor Lolly.
- <!--i:seal--> **The credential is intact**: manifes C2PA bertanda tangan terurai dan tanda tangan klaimnya sendiri terverifikasi.
- <!--i:hash--> **The bytes have not changed**: hash file masih cocok dengan yang ditandatangani. Ubah satu piksel dan lencana ini berbalik.
- <!--i:sparkle--> **GEN AI**: mesin membuat piksel ini, dan file menyatakannya. Lolly membaca deklarasi itu kembali alih-alih menyembunyikan faktanya.

Seluruh riwayat ikut bersama file. Sembilan langkah bertahan di sini: lima yang dicatat Google saat menghasilkan dan memberi watermark gambar, lalu empat yang dicatat Lolly saat membuka, menandai, dan mengonversi salinan di halaman ini. Verify membacanya langsung dari byte dan menggambarnya sebagai garis waktu.

![Riwayat perubahan yang dibaca kembali Verify dari gambar badai - lima langkah dicatat Google, lalu empat oleh Lolly, berakhir di WebP pada halaman ini](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Itulah demonya. Pemeriksaan di bawah adalah jaminan di baliknya, dan masing-masing dapat direproduksi. [Content Credentials](/info/content-credentials-identity.html) menjelaskan setiap vonis.

## Di browser Anda, tanpa alat tambahan

::: timeline
- <!--i:globe--> **1. Amati jaringan.** Buka [lolly.tools](https://lolly.tools), buka DevTools browser Anda (F12), beralih ke **Network** dan pakai sebuah alat: ketik alamat web ke [QR Code](/t/qr-code), ubah warna, ekspor PNG. Setiap permintaan tetap di `lolly.tools`: shell aplikasi, file milik alat itu sendiri, dan aset katalog. Tidak ada host analitik, beacon CDN, layanan font, atau endpoint pelaporan kesalahan. Apa yang Anda ketik ke dalam alat muncul di **tidak ada permintaan sama sekali**, karena rendering bersifat lokal.
- <!--i:eyeoff--> **2. Cabut kabelnya.** Muat aplikasi dan buka satu dua alat, lalu offline (mode pesawat, atau DevTools → Network → Offline) dan muat ulang. Galeri dan setiap alat yang Anda buka tetap berfungsi, termasuk rendering dan ekspor dalam format yang Anda pakai. File alat dan encoder format di-cache saat pertama kali Anda memakainya, jadi pakai alat sekali saat online sebelum mengujinya offline. Ini pemeriksaan tunggal terkuat di halaman ini: perangkat lunak yang menelepon pulang tidak bertahan saat kabelnya diputus.
- <!--i:check--> **3. Hitung cookie.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Daftarnya kosong: aplikasi tidak menyetel cookie. Tempel `document.cookie` ke konsol dan Anda mendapat `""`. Pendaftaran CA opsional menyetel cookie `HttpOnly` berumur pendek, `lolly_ca_state`, dengan cakupan `/api/ca`, yang tidak dapat ditampilkan `document.cookie`. Instans Lolly Work memakai cookie login sendiri; bandingkan dengan [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Baca penyimpanan Anda sendiri.** Di panel yang sama, semua yang disimpan Lolly ada di depan Anda: beberapa lusin kunci `localStorage` biasa (tema, bahasa, lebar sidebar, pengaturan suara dan tampilan, dan salinan tersimpan indeks katalog alat publik) dan dokumen Anda sendiri di IndexedDB. Setiap nilai adalah string atau JSON yang terbaca, tanpa yang diobfuskasi. Membersihkan data situs menghapus catatan lokal ini, tetapi bukan cadangan Sync atau catatan yang disimpan instans Lolly Work. **Settings → Storage → Clear all my data** melakukan hal yang sama dari dalam aplikasi, dan Anda dapat melihat penyimpanan dan cache mengosong.
- <!--i:lock--> **5. Periksa kontak pengungkapan ada.** [`/.well-known/security.txt`](/.well-known/security.txt) menjawab dengan blok kontak [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), bukan halaman HTML.
:::

::: details Apa lagi yang mungkin Anda lihat di tab Network
Beberapa fitur menjangkau jaringan hanya saat Anda memakainya, dan masing-masing terlihat di tab yang sama:

- menambahkan **Google Font** di Design System Setup mengambil satu keluarga itu dari Google, setelah dialog persetujuan yang menyatakannya, sekali, sebelum pengambilan pertama;
- mengeklik **preset profil cetak ICC** mengambil profil itu dari registri publik ICC di color.org;
- memutar **radio** bawaan opsional mengalirkan dari stasiun;
- memasukkan lokasi di **Meeting Planner** mencari tempat itu di layanan geocoding open-meteo untuk koordinat dan zona waktunya, sekali per kota (jawaban disimpan di perangkat Anda), dan field menyatakannya di tempat Anda mengetik;
- **URL Screenshot** memuat alamat yang Anda ketik, karena itulah tugasnya, dan Anda melihatnya terjadi.

Alat yang mendeklarasikan kemampuan jaringan hanya boleh mengambil dari host yang diizinkan manifesnya, dan pemeriksaan itu gagal dengan aman. Tidak ada alat yang dikirim hari ini yang mendeklarasikannya, jadi Content-Security-Policy yang ditegakkan browser-lah yang menjaga daftar di atas pada host-nya. [Kebijakan privasi](/info/privacy.html) menyimpan tabel kanonis semua ini, termasuk lalu lintas instans terkelola seperti penyegaran kebijakan dan pelaporan yang diaktifkan.
:::

## Dari terminal

**6. Endpoint render hanya menjawab dengan data publik.** Satu fitur server yang menaruh input yang diketik ke dalam URL, render hot-link, aktif di sini. [Kebijakan privasi](/info/privacy.html) menyatakan apa artinya bagi input yang Anda taruh di tautan.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Setiap deployment memilih (`LOLLY_DISABLE_RENDER_GET=1`): pada instans yang menetapkannya, probe yang sama mengembalikan `404`. Perbedaan itu adalah pengaturan yang bekerja, bukan ketidakkonsistenan.

**7. Periksa layanan yang diaktifkan deployment Anda.** [Server Surface](/info/server-surface.html) mencantumkan layanan opsional dan menaut referensi rincinya. Untuk Lolly Work, sertakan API terautentikasinya, koneksi kolaborasi, penyimpanan, dan penyedia yang dikonfigurasi. Probe ke lolly.tools publik tidak menguji instans organisasi privat.

Jika Anda menjalankan instans sendiri, [Delivery deployment](/info/deploy-delivery.html) memuat pemeriksaan rilisnya: integritas model, probe edge dan daftar sampelnya, rendisi tampilan, gateway unduhan privat, dan katalog bertanda tangan di browser.


## Di dalam kode sumber

Semua di atas masih bisa jadi sandiwara bila kode yang di-deploy berbeda dari kode publik. Jadi periksa kodenya. Deployment dibangun dari [repositori publik](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Tidak ada pelacak dan tidak ada SDK analitik, di mana pun.** Cari kode yang dikirim (engine, setiap shell termasuk ekstensi browser, override bridge Tauri dan service worker, fungsi server, dan paket alat) untuk tersangka yang biasa:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Pemindaian ini mencari SDK pelacakan pihak ketiga. Ia tidak menunjukkan ketiadaan pelaporan penggunaan pihak pertama: Lolly Work mendukung telemetri organisasi dan log audit terpisah, dengan kebijakan dan tesnya sendiri.

**9. Tidak ada resolver DNS pihak ketiga.** Pemeriksaan SEAL di Verify tidak pernah mengirim pencarian melalui penyedia DNS-over-HTTPS, karena aplikasi tidak memiliki resolver:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Layanan sertifikat tidak menyimpan log penerbitan.** CA identitas tidak menyimpan log apa yang diterbitkannya dan tidak ada inventaris identitas: tidak ada baris stdout, webhook, atau penyimpanan sertifikat. Ketiadaannya dapat dicari:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA memang menyimpan status kerja berumur pendek: bucket pembatas laju menyimpan kunci IP dan email ter-hash selama jendelanya, dan penyimpanan admisi deployment terkelola menyimpan pengenal berkunci dan digest permintaan paling lama sepuluh menit. [Content Credentials engineering](/info/content-credentials-engineering.html#protocol) memuat detailnya.

## Ditegakkan oleh tes

Pemeriksaan sumber di atas bukan audit satu kali: pemeriksaan itu dipatok dalam rangkaian tes, sehingga tidak dapat lapuk diam-diam. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) memeriksa daftar nama pelacak yang lebih panjang daripada pemindaian di atas dan menggagalkan build jika:

- SDK analitik atau pelacakan mana pun muncul di sumber terkirim yang dipindainya, di kode aplikasi, engine, server, ekstensi, dan paket alat;
- resolver DNS-over-HTTPS pihak ketiga mana pun muncul di sumber itu;
- log penerbitan CA kembali, di sumber **atau** bundel server yang dihasilkan;
- kebijakan privasi kehilangan pernyataan yang diwajibkan hukum (pengendali yang disebut, dasar hukum, hak mengajukan keluhan).

Jalankan sendiri di klon (Node 22.18 atau lebih baru; file ini tidak memerlukan `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Rangkaian lengkap (`pnpm install && pnpm test`) menjalankan beberapa ribu lagi, termasuk uji kriptografi adversarial yang dijelaskan di [Security & Verification](/info/security.html).

## Apa yang tidak dapat Anda verifikasi dari luar

- **Log akses hosting.** Server mana pun yang menjawab permintaan dapat mencatatnya: alamat IP, path, dan waktu. Probe dari luar tidak dapat menetapkan berapa lama log disimpan. Operator mengendalikan logging, rotasi, dan ekspor, dan harus mengungkapkan pilihan itu. Rendering lokal menjaga suntingan biasa di perangkat Anda; rendering server opsional dan layanan ruang kerja bersama memiliki aliran data terpisah yang dijelaskan kebijakan privasi.
- **Bahwa deployment menjalankan kode ini.** Anda dapat memeriksa bahwa sumber bersih dan bahwa perilaku yang di-deploy cocok dengannya, dan pemeriksaan di atas melakukan keduanya. Atestasi tingkat biner untuk deployment web bukan sesuatu yang ditawarkan platform web. Mitigasinya adalah repositori publik, tes yang ditegakkan, dan pemeriksaan offline: deployment yang dirusak dan menelepon pulang gagal pada pemeriksaan 1 dan 2 sekaligus.
- **Hook alat.** Logika opsional alat bawaan ditinjau, bukan di-sandbox: ia berjalan di halaman kecuali alat memilih Worker. Setiap alat di lolly.tools adalah pihak pertama dan ditinjau sebelum dikirim. [Threat Model](/info/threat-model.html#trust-boundaries) memaparkan di mana hook berjalan dan apa yang membatasinya.

## Jika sebuah pemeriksaan gagal

Perbedaan antara halaman ini dan apa yang Anda amati adalah laporan keamanan. Kirimkan melalui kanal privat di [Security & Verification](/info/security.html#reporting-a-vulnerability). Kami menjalankan pengungkapan terkoordinasi dan memberi kredit kepada pelapor.
