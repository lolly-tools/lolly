# Sahkan Sendiri

Setiap janji di laman ini boleh disemak, tanpa akaun. Kebanyakan semakan hanya memerlukan pelayar; selebihnya memerlukan terminal dan salinan sumber. Jika semakan di bawah tidak memberikan hasil yang ditunjukkan, itu ialah pepijat atau janji yang tidak ditunaikan, dan kami mahu tahu: lihat [Jika semakan gagal](#if-a-check-fails).

Semakan ini meliputi Lolly sahaja. Jika organisasi anda menjalankan Lolly Work, ia menambah daftar masuk, kandungan kongsi, telemetri yang dikonfigurasi dan rekod audit; semak semua itu dengan [Permukaan Pelayan](/info/server-surface.html) dan [bahagian organisasi dalam dasar privasi](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-clock-->
## Lihat ia berfungsi, dalam sepuluh saat

Buka [`/verify`](/#/verify) dan lepaskan fail pada halaman. Tiada muat naik, tiada akaun dan tiada penantian untuk pelayan. Di sini ia menyemak [ribut Queensland yang dijana](/info/ai-stance.html) daripada Pendirian AI Kami: imej yang dijana Gemini, yang dibuka, ditandakan dan ditukar oleh Lolly. Setiap lencana ditentukan pada peranti, daripada bait fail itu sendiri.

![Lolly Verify pada skrin selebar telefon - imej ribut, keputusan Made with Lolly berwarna hijau serta lencana bukti kelayakan utuh dan bait tidak berubah yang disusun di bawahnya](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Keputusan terdiri daripada sekumpulan kecil lencana, setiap satu fakta yang bebas:

- <!--i:lock--> **Made with Lolly**: bukti kelayakan utuh *dan* merekodkan eksport Lolly.
- <!--i:seal--> **The credential is intact**: manifes C2PA yang ditandatangani dapat dihuraikan dan tandatangan dakwaannya sendiri dapat disahkan.
- <!--i:hash--> **The bytes have not changed**: cincangan fail masih sepadan dengan apa yang ditandatangani. Ubah satu piksel dan lencana ini berubah.
- <!--i:sparkle--> **GEN AI**: mesin menghasilkan piksel ini, dan fail menyatakannya. Lolly membaca semula pengisytiharan itu dan bukannya menyembunyikan fakta tersebut.

Seluruh sejarah dibawa bersama fail. Sembilan langkah kekal di sini: lima yang direkodkan Google semasa menjana dan meletakkan tera air pada imej, kemudian empat yang direkodkan Lolly semasa membuka, menandakan dan menukar salinan pada halaman ini. Lolly Verify membacanya terus daripada bait dan melukisnya sebagai garis masa.

![Sejarah perubahan yang dibaca semula oleh Lolly Verify daripada imej ribut - lima langkah direkodkan oleh Google, kemudian empat oleh Lolly, berakhir dengan WebP pada halaman ini](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Semakan di bawah ialah jaminan di sebalik demo itu, dan setiap satu boleh dihasilkan semula. [Content Credentials](/info/content-credentials-identity.html) menerangkan setiap keputusan.

<!--i:eti-globe-->
## Dalam pelayar anda, tiada alat diperlukan

::: timeline
- <!--i:globe--> **1. Perhatikan rangkaian.** Buka [lolly.tools](https://lolly.tools), buka DevTools pelayar anda (F12), beralih ke **Network** dan gunakan alat: taip alamat web ke dalam [Lolly QR Code](/t/qr-code), ubah warna, eksport PNG. Setiap permintaan pergi ke `lolly.tools`: cangkerang apl, fail alat itu sendiri dan aset katalog. Tiada hos analitik, tiada suar CDN, tiada perkhidmatan fon dan tiada titik akhir pelaporan ralat. Apa yang anda taip ke dalam alat **langsung tidak muncul dalam sebarang permintaan**, kerana proses render berlaku secara setempat.
- <!--i:eyeoff--> **2. Putuskan sambungan.** Muatkan apl dan buka satu atau dua alat, kemudian pergi ke luar talian (mod kapal terbang, atau DevTools → Network → Offline) dan muat semula. Galeri dan setiap alat yang anda buka terus berfungsi, termasuk proses render dan eksport dalam format yang anda gunakan. Fail alat dan pengekod format dicache kali pertama anda menggunakannya, jadi gunakan alat sekali dalam talian sebelum mengujinya di luar talian. Ini ialah semakan tunggal paling kukuh pada halaman ini: perisian yang menghantar data kembali ke pelayannya tidak dapat bertahan apabila sambungannya diputuskan.
- <!--i:check--> **3. Kira kuki.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Senarai itu kosong: apl tidak menetapkan kuki. Tampal `document.cookie` ke dalam konsol dan anda mendapat `""`. Pendaftaran CA pilihan menetapkan kuki `HttpOnly` jangka pendek, `lolly_ca_state`, yang skopnya terhad kepada `/api/ca`, yang tidak dapat ditunjukkan oleh `document.cookie`. Instans Lolly Work menggunakan kuki daftar masuknya sendiri; bandingkan dengan [Privasi](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Baca storan anda sendiri.** Dalam panel yang sama, segala yang disimpan Lolly berada di hadapan anda: kira-kira dua dozen kunci `localStorage` biasa (tema, bahasa, lebar bar sisi, tetapan bunyi dan paparan serta salinan cache indeks katalog alat awam) dan dokumen anda sendiri dalam IndexedDB. Setiap nilai ialah rentetan atau JSON yang boleh dibaca, tanpa apa-apa yang dikaburkan. Mengosongkan data laman membuang rekod setempat ini, tetapi bukan sandaran Sync atau rekod yang disimpan oleh instans Lolly Work. **Settings → Storage → Clear all my data** melakukan perkara yang sama dari dalam apl, dan anda boleh melihat stor dan cache dikosongkan.
- <!--i:lock--> **5. Semak bahawa maklumat hubungan pendedahan wujud.** [`/.well-known/security.txt`](/.well-known/security.txt) menjawab dengan blok hubungan [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), bukan halaman HTML.
:::

::: details Apa lagi yang mungkin anda lihat dalam tab Network
Sesetengah ciri hanya mengakses rangkaian apabila anda menggunakannya, dan setiap satu kelihatan dalam tab yang sama:

- menambah **Google Font** dalam Lolly Design System Setup mengambil satu keluarga fon itu daripada Google, selepas dialog persetujuan yang menyatakannya, sekali, sebelum pengambilan pertama;
- mengklik **pratetap profil mesin cetak ICC** mengambil profil itu daripada daftar awam ICC di color.org;
- memainkan **radio** terbina dalam pilihan menstrim daripada stesen;
- memasukkan lokasi dalam **Meeting Planner** mencari tempat itu di perkhidmatan geopengekodan open-meteo untuk koordinat dan zon waktunya, sekali bagi setiap bandar (jawapan disimpan pada peranti anda), dan medan menyatakannya di tempat anda menaip;
- **Lolly URL Screenshot** memuatkan alamat yang anda taip, dan anda melihatnya berlaku.

Alat yang mengisytiharkan keupayaan rangkaian hanya boleh mengambil daripada hos yang dibenarkan dalam manifesnya, dan semakan itu menyekat akses apabila gagal. Tiada alat yang diedarkan hari ini mengisytiharkan keupayaan itu, jadi Content-Security-Policy yang dikuatkuasakan pelayar mengehadkan senarai di atas kepada hosnya. [Dasar privasi](/info/privacy.html) mempunyai jadual kanonik bagi semua ini, termasuk trafik instans terurus seperti penyegaran dasar dan pelaporan yang didayakan.
:::

<!--i:eti-code-->
## Dari terminal

**6. Titik akhir render menjawab dengan data awam sahaja.** Satu ciri pelayan yang meletakkan input yang ditaip ke dalam URL, render pautan terus, aktif di sini. [Dasar privasi](/info/privacy.html) menyatakan maknanya untuk input yang anda masukkan ke dalam pautan.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Setiap pemasangan membuat pilihan (`LOLLY_DISABLE_RENDER_GET=1`): pada instans yang menetapkan pemboleh ubah itu, prob yang sama memulangkan `404`. Perbezaan itu menunjukkan tetapan berfungsi, bukan ketidakselarasan.

**7. Semak perkhidmatan yang didayakan pada pemasangan anda.** [Permukaan Pelayan](/info/server-surface.html) menyenaraikan perkhidmatan pilihan dan memautkan rujukan terperincinya. Untuk Lolly Work, sertakan API yang memerlukan pengesahan, sambungan kolaborasi, storan dan penyedia yang dikonfigurasi. Prob terhadap lolly.tools awam tidak menguji instans organisasi peribadi.

Jika anda menjalankan instans sendiri, [Pemasangan penghantaran](/info/deploy-delivery.html) mempunyai semakan keluaran: integriti model, prob pinggir dan senarai sampelnya, versi paparan, get laluan muat turun peribadi dan katalog bertandatangan dalam pelayar.


<!--i:eti-search-->
## Dalam sumber

Semua yang di atas masih boleh menjadi lakonan jika kod yang dipasang berbeza daripada kod awam. Jadi semak kodnya. Binaan pemasangan dibuat daripada [repositori awam](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Tiada penjejak dan tiada SDK analitik, di mana-mana.** Cari komponen yang lazim disyaki dalam kod yang diedarkan (enjin, setiap cangkerang termasuk sambungan pelayar, penindihan jambatan Tauri dan service worker, fungsi pelayan dan pek alat):

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Imbasan ini mencari SDK penjejakan pihak ketiga. Ia tidak menunjukkan ketiadaan pelaporan penggunaan pihak pertama: Lolly Work menyokong telemetri organisasi dan log audit berasingan, dengan dasar dan ujiannya sendiri.

**9. Tiada penyelesai DNS pihak ketiga.** Semakan SEAL Lolly Verify tidak pernah menghantar carian melalui penyedia DNS-over-HTTPS, kerana apl tiada penyelesai:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Perkhidmatan sijil tidak menyimpan log pengeluaran.** CA identiti tidak menyimpan log tentang apa yang dikeluarkannya dan tiada inventori identiti: tiada baris stdout, tiada webhook, tiada stor sijil. Ketiadaan ini boleh dicari:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA memang menyimpan keadaan kerja jangka pendek: baldi had kadar menyimpan kunci IP dan e-mel yang dicincang sepanjang tempohnya, dan stor kemasukan pemasangan terurus menyimpan pengecam berkunci dan cernaan permintaan selama paling banyak sepuluh minit. [Kejuruteraan Content Credentials](/info/content-credentials-engineering.html#protocol) mempunyai butirannya.

<!--i:eti-flask-->
## Dikuatkuasakan oleh ujian

Semakan sumber di atas bukan audit sekali sahaja: ia ditetapkan dalam suit ujian, jadi ia tidak boleh merosot secara senyap. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) menyemak senarai nama penjejak yang lebih panjang daripada imbasan di atas dan menggagalkan binaan jika:

- sebarang SDK analitik atau penjejakan muncul di mana-mana dalam sumber yang diedarkan yang diimbasnya, merentas kod apl, enjin, pelayan, sambungan dan pek alat;
- sebarang penyelesai DNS-over-HTTPS pihak ketiga muncul dalam sumber itu;
- log pengeluaran CA muncul semula, dalam sumber **atau** berkas pelayan yang dijana;
- dasar privasi kehilangan pernyataan yang diwajibkan undang-undang (pengawal yang dinamakan, asas undang-undang, hak untuk mengadu).

Jalankannya sendiri dalam klon (Node 22.18 atau lebih baharu; fail ini tidak memerlukan `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Suit penuh (`pnpm install && pnpm test`) menjalankan beberapa ribu lagi, termasuk ujian kriptografi adversarial yang diterangkan dalam [Keselamatan & Pengesahan](/info/security.html).

<!--i:eti-eye-off-->
## Apa yang tidak dapat anda sahkan dari luar

- **Log akses pengehosan.** Mana-mana pelayan boleh merekodkan permintaan yang dijawabnya: alamat IP, laluan dan masa. Prob luar tidak dapat memastikan berapa lama log disimpan. Pengendali mengawal pengelogan, putaran dan eksport, dan mesti mendedahkan pilihan itu. Proses render setempat mengekalkan suntingan biasa pada peranti anda; render pelayan pilihan dan perkhidmatan ruang kerja kongsi mempunyai aliran data berasingan yang diterangkan oleh dasar privasi.
- **Bahawa pemasangan menjalankan kod ini.** Anda boleh menyemak bahawa sumber bersih dan tingkah laku pemasangan sepadan dengan sumber, dan semakan di atas melakukan kedua-duanya. Platform web tidak menawarkan pengesahan pada peringkat binari bagi pemasangan web. Langkah mitigasinya ialah repositori awam, ujian yang dikuatkuasakan dan semakan luar talian: pemasangan yang diusik dan menghantar data kembali ke pelayannya gagal semakan 1 dan 2 sekaligus.
- **Hook alat.** Logik pilihan alat terbina dalam disemak dan bukannya diasingkan dalam kotak pasir: ia berjalan dalam halaman kecuali alat memilih untuk menggunakan Worker. Setiap alat di lolly.tools ialah pihak pertama dan disemak sebelum diedarkan. [Model Ancaman](/info/threat-model.html#trust-boundaries) menerangkan tempat hook berjalan dan apa yang mengehadkannya.

<!--i:eti-warning-->
## Jika semakan gagal

Perbezaan antara halaman ini dan apa yang anda perhatikan ialah laporan keselamatan. Hantarkannya melalui saluran peribadi di [Keselamatan & Pengesahan](/info/security.html#reporting-a-vulnerability). Kami mengamalkan pendedahan terselaras dan memberikan penghargaan kepada pelapor.
