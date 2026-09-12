# Verifikasi Sendiri

Halaman privasi dan keamanan Lolly membuat klaim: tanpa analitik, tanpa pelacakan, berkas tidak pernah meninggalkan perangkat, satu cookie di seluruh sistem. Halaman ini berbeda: halaman ini tidak meminta Anda untuk mempercayai semua itu. Ini adalah daftar prosedur, masing-masing dengan perintah atau jalur-klik yang tepat serta output yang akan Anda lihat. Setiap klaim di sini bisa dibantah dalam hitungan menit, sebagian besar tanpa memasang apa pun.

Jika ada pemeriksaan di halaman ini yang tidak menghasilkan hasil yang ditunjukkan, itu adalah bug atau janji yang dilanggar. [Laporkan](#if-a-check-fails) apa pun kasusnya, dan kami akan menanganinya dengan tingkat keseriusan yang layak diterima oleh janji yang dilanggar.

## Lihat cara kerjanya, dalam sepuluh detik

Sebelum prosedurnya, inilah hasilnya. Buka [`/verify`](/#/verify) dan letakkan sebuah berkas di atasnya - tanpa unggah, tanpa akun, tanpa menunggu server. Berikut ini memeriksa [badai Queensland yang dihasilkan](/info/ai-stance.html) dari halaman sikap AI kami: gambar Gemini yang dibuka, diubah ukurannya dan diekspor oleh Lolly. Setiap lencana di bawah dihitung di perangkat, dari byte berkas itu sendiri.

![Verify di layar selebar ponsel - gambar badai, verdict hijau Made with Lolly dan lencana credential-intact serta bytes-unchanged bertumpuk di bawahnya](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Verdict-nya bukan satu lencana melainkan sekumpulan kecil lencana, masing-masing adalah fakta independen:

- <!--i:lock--> **Made with Lolly** - credential-nya utuh *dan* mencatat ekspor Lolly.
- <!--i:seal--> **Credential-nya utuh** - manifes C2PA yang ditandatangani terurai dan tanda tangan klaimnya sendiri terverifikasi.
- <!--i:hash--> **Byte-nya tidak berubah** - hash berkas masih cocok dengan yang ditandatangani. Ubah satu piksel dan lencana ini akan berbalik.
- <!--i:sparkle--> **GEN AI** - sebuah mesin membuat piksel-piksel ini, dan berkas menyatakannya demikian. Lolly membaca kembali pernyataan itu alih-alih menyembunyikannya.

Dan seluruh riwayatnya ikut berpindah bersama berkas. Sembilan langkah bertahan di sini - lima dicatat Google saat menghasilkan dan memberi watermark pada gambar, lalu empat dicatat Lolly saat membuka, menandai dan mengonversi salinannya di halaman ini - dibaca langsung dari byte, di perangkat Anda, dan dirender sebagai garis waktu. Ini adalah gambar yang sama, diverifikasi dengan cara yang sama, seperti garis waktu C2PA di [halaman sikap AI](/info/ai-stance.html).

![Riwayat perubahan yang dibaca kembali Verify dari gambar badai - lima langkah dicatat Google, lalu empat oleh Lolly, berakhir di WebP pada halaman ini](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Namun, semua itu bukan klaim kepercayaan - itu demonya. Sisa halaman ini adalah klaim kepercayaan: setiap lencana di atas dapat direproduksi, dan berikut cara Anda mereproduksi jaminan di baliknya.

## Di browser Anda, tanpa alat tambahan

**1. Amati jaringan.** Buka [lolly.tools](https://lolly.tools), buka DevTools browser Anda (F12), beralih ke tab **Network**, lalu gunakan sebuah alat - ketik URL ke [QR Code](/t/qr-code), ubah warna, ekspor PNG. Setiap permintaan tetap berada di `lolly.tools`: shell aplikasi, berkas alat itu sendiri, aset katalog. Tidak ada host analitik, tidak ada beacon CDN, tidak ada layanan font, tidak ada endpoint "pelaporan error". Apa yang Anda ketik ke dalam sebuah alat muncul di **tidak ada permintaan sama sekali** - rendering dilakukan secara lokal.

Pengecualian yang jujur - masing-masing bersifat opt-in, diinisiasi pengguna, dan terlihat di tab Network yang sama saat terjadi: menambahkan **Google Font** di editor brand mengambil satu keluarga font itu dari Google, setelah dialog persetujuan yang menyatakan hal itu dengan jelas, sekali, sebelum permintaan pertama; mengklik **preset profil cetak ICC** mengambil profil itu dari registri publik ICC di color.org; memutar **radio** bawaan yang opsional melakukan streaming dari stasiunnya; memasukkan lokasi di **Meeting Planner** mencari tempat itu di layanan geocoding open-meteo untuk koordinat dan zona waktunya, sekali per kota (jawaban disimpan di perangkat Anda), dan input tersebut membawa keterangan itu tepat di tempat Anda mengetik; dan **URL Screenshot** secara alami memuat URL yang Anda ketik - itu memang tugasnya, dan Anda menyaksikannya terjadi. Alat yang mendeklarasikan kapabilitas jaringan hanya boleh mengambil data dari host yang diizinkan manifesnya, dan mekanisme itu fail-closed; belum ada alat yang dirilis saat ini yang mendeklarasikannya, sehingga Content-Security-Policy yang dipaksakan browser adalah batas yang benar-benar menegakkan daftar di atas ke host-hostnya. [Kebijakan privasi](/info/privacy.html) menyimpan tabel kanonis dari semua ini; aturan bakunya adalah sentuhan jaringan yang tidak ada di tabel itu tidak akan terjadi.

**2. Cabut kabelnya.** Muat aplikasi dan buka satu atau dua alat, lalu putuskan koneksi - mode pesawat, atau DevTools → Network → Offline. Muat ulang. Galeri dan setiap alat yang telah Anda buka tetap berfungsi, termasuk rendering dan ekspor dalam format yang telah Anda gunakan - berkas alat dan encoder suatu format di-cache saat pertama kali Anda menggunakannya, jadi jalankan sebuah alat sekali saat online sebelum mengujinya secara offline. Ini adalah pemeriksaan tunggal terkuat di halaman ini: perangkat lunak yang menghubungi pulang tidak akan bertahan ketika kabelnya diputus.

**3. Hitung cookie-nya.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Daftarnya kosong - aplikasi ini tidak mengatur cookie apa pun. Atau tempel `document.cookie` ke konsol: Anda mendapatkan `""`. (Satu-satunya cookie di seluruh sistem, `lolly_ca_state`, bertahan paling lama sepuluh menit selama proses sign-in identitas opsional - dihapus begitu sign-in selesai - dibatasi cakupannya pada `/api/ca` dan bersifat `HttpOnly`: [kebijakan privasi](/info/privacy.html) menjelaskannya secara rinci.)

**4. Baca penyimpanan Anda sendiri.** Panel Application yang sama: semua yang disimpan Lolly dapat diperiksa langsung di hadapan Anda - sekitar dua puluh kunci `localStorage` biasa (tema, bahasa, lebar sidebar, pengaturan suara dan tampilan, plus salinan cache dari indeks katalog alat publik), dan dokumen Anda sendiri di IndexedDB. Setiap nilai adalah string atau JSON yang dapat dibaca - tidak ada yang diobfuskasi, tidak ada yang dienkode untuk menghalangi pembacaan. **Profile → Clear all my data** menghapusnya; begitu pula menghapus data situs di browser, karena tidak ada salinan sisi server yang bisa bertahan darinya.

**5. Periksa apakah kontak pengungkapan ada.** [`/.well-known/security.txt`](/.well-known/security.txt) menjawab dengan blok kontak [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), bukan halaman HTML.

## Dari terminal

**6. Titik akhir render hanya menjawab dengan data publik.** Satu-satunya fitur server yang memasukkan input yang diketik pengguna ke dalam URL - render hot-link - aktif di sini, dan [kebijakan privasi](/info/privacy.html) menjelaskan apa artinya itu bagi input yang Anda masukkan ke dalam sebuah tautan:

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Sakelar ini bersifat per-deployment (`LOLLY_DISABLE_RENDER_GET=1`): pada instance yang menyetelnya, probe yang sama mengembalikan `404` - perbedaan itu adalah tanda flag ini bekerja, bukan sebuah inkonsistensi.

**7. Permukaan server dapat dienumerasi.** [Server Surface](/info/server-surface.html) mencantumkan setiap rute sisi server yang ada, dengan aturan baku bahwa endpoint yang tidak ada di halaman itu bukan bagian dari Lolly. `curl` semuanya; tidak ada yang lain untuk ditemukan.

## Di dalam kode sumber

Semua di atas masih bisa jadi sandiwara jika kode yang di-deploy berbeda dari kode publik. Jadi periksa kodenya - deployment dibangun dari [repositori publik](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Tidak ada pelacak, tidak ada SDK analitik, di mana pun.** Cari di kode yang dirilis - engine, setiap shell (termasuk ekstensi browser, override bridge Tauri dan service worker), fungsi server dan paket alat - untuk pelaku biasa:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

**9. Tidak ada resolver DNS pihak ketiga.** Pemeriksaan SEAL milik Verify tidak pernah merutekan pencarian melalui penyedia DNS-over-HTTPS - aplikasi web ini memang tidak punya resolver:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Layanan sertifikat tidak menyimpan apa pun.** CA identitas tidak memiliki log penerbitan - bukan email Anda, bukan stempel waktu, bukan webhook. Ketiadaannya bisa diverifikasi lewat grep:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

## Ditegakkan oleh pengujian, bukan janji

Ketiga pemeriksaan sumber di atas bukan audit sekali jalan - keduanya dipatok dalam test suite, sehingga tidak bisa membusuk diam-diam. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) menggagalkan build jika:

- SDK analitik atau pelacakan apa pun muncul di mana saja dalam kode sumber yang dirilis yang dipindainya - aplikasi, engine, server, ekstensi dan kode paket alat sekaligus,
- resolver DNS-over-HTTPS pihak ketiga mana pun muncul dalam kode sumber itu,
- log penerbitan CA muncul kembali - baik di kode sumber **maupun** di bundle server yang dihasilkan,
- kebijakan privasi kehilangan pernyataan yang diwajibkan secara hukum (pengendali yang disebutkan, dasar hukum, hak untuk mengadu).

Jalankan sendiri di clone (Node 22.18+; `pnpm install` tidak diperlukan untuk berkas ini):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Rangkaian lengkap (`pnpm install && pnpm test`) menjalankan beberapa ribu lagi, termasuk uji kriptografi adversarial yang dijelaskan di [Security & Verification](/info/security.html).

## Apa yang tidak bisa Anda verifikasi dari luar - dikatakan secara terus terang

Halaman seperti ini memperoleh kepercayaan dengan menyebutkan batasannya sendiri:

- **Log akses hosting.** Server mana pun yang menjawab permintaan bisa mencatat permintaan itu - IP, path, stempel waktu. Anda tidak bisa memverifikasi apa yang disimpan atau tidak disimpan oleh sebuah host, begitu pula kami, di luar perilaku yang didokumentasikan penyedia kami. Justru itulah sebabnya arsitekturnya menjaga konten Anda sepenuhnya tidak melintasi jaringan: apa yang tidak pernah meninggalkan perangkat Anda tidak bisa dicatat oleh siapa pun.
- **Bahwa deployment menjalankan kode ini.** Anda bisa memverifikasi bahwa kode sumber bersih dan bahwa perilaku yang di-deploy sesuai dengannya (pemeriksaan di atas mencakup kedua ujungnya), tetapi atestasi tingkat biner untuk deployment web bukan sesuatu yang ditawarkan platform web. Mitigasinya adalah repo publik, pengujian yang ditegakkan dan pemeriksaan offline - deployment yang dimanipulasi dan menghubungi pulang akan langsung gagal di pemeriksaan 1 dan 2.
- **Hook alat tidak di-sandbox secara default.** Logika opsional sebuah alat berjalan setelah ditinjau, di realm halaman itu sendiri; setiap alat di lolly.tools bersifat first-party dan ditinjau sebelum dirilis. Isolasi Worker kini tersedia sebagai opt-in per alat - sebuah alat yang manifesnya menetapkan `isolate: true` menjalankan hook-nya di luar thread utama - jadi apa yang tidak bisa Anda verifikasi dari luar kian menyempit, tetapi jalur default masih di dalam realm dan tinjauan masih menjadi kontrolnya. Ini dinyatakan, bukan disembunyikan - lihat bagian [batasan desain](/info/security.html), yang selalu menyatakan demikian.

## Jika sebuah pemeriksaan gagal

Ketidaksesuaian antara halaman ini dan perilaku yang teramati adalah laporan keamanan, dan kami sungguh lebih memilih mendengarnya daripada tidak: [fitzy+security@suse.com](mailto:fitzy+security@suse.com), tombol **Report a vulnerability** di [repositori lolly-tools](https://github.com/lolly-tools) mana pun, atau kontak di [`/.well-known/security.txt`](/.well-known/security.txt). Pengungkapan terkoordinasi dan kredit bagi pelapor adalah kebijakan baku - [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md) memuat rinciannya.
