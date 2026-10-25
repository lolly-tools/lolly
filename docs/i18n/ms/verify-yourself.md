# Sahkan Sendiri

Setiap janji di tapak ini boleh disemak, tanpa akaun. Kebanyakan semakan hanya memerlukan pelayar; selebihnya memerlukan terminal dan salinan sumber. Jika semakan di bawah tidak memberi hasil yang ditunjukkan, itu ialah pepijat atau janji yang dimungkiri, dan kami mahu mendengarnya: lihat [If a check fails](#if-a-check-fails).

Mulakan dengan yang paling pantas: letakkan fail pada Verify. Kemudian pergi lebih jauh: perhatikan rangkaian semasa anda menggunakan alat, cabut palam dan teruskan bekerja, kira kuki dan baca sumber.

Semakan ini meliputi Lolly bersendirian. Jika organisasi anda menjalankan Lolly Work, ia menambah log masuk, kandungan dikongsi, telemetri yang dikonfigurasi dan rekod audit; semak perkara itu terhadap [Server Surface](/info/server-surface.html) dan [bahagian organisasi dalam dasar privasi](/info/privacy.html#organisation-services-with-lolly-work).

## Lihat ia berfungsi, dalam sepuluh saat

Buka [`/verify`](/#/verify) dan letakkan fail pada halaman. Tiada muat naik, tiada akaun dan tiada menunggu pelayan. Di sini ia menyemak [ribut Queensland yang dijana](/info/ai-stance.html) daripada Our AI Stance: imej yang dijana Gemini, yang dibuka, ditanda dan ditukar oleh Lolly. Setiap lencana dikira pada peranti, daripada bait fail itu sendiri.

![Verify pada skrin lebar telefon - imej ribut, keputusan hijau Made with Lolly dan lencana credential-intact serta bytes-unchanged bertindan di bawahnya](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Keputusan ialah timbunan kecil lencana, masing-masing fakta bebas:

- <!--i:lock--> **Made with Lolly**: kredensial utuh *dan* merekodkan eksport Lolly.
- <!--i:seal--> **The credential is intact**: manifes C2PA bertandatangan dihuraikan dan tandatangan tuntutannya sendiri disahkan.
- <!--i:hash--> **The bytes have not changed**: cincangan fail masih sepadan dengan apa yang ditandatangani. Ubah satu piksel dan lencana ini bertukar.
- <!--i:sparkle--> **GEN AI**: mesin membuat piksel ini, dan fail menyatakannya. Lolly membaca semula pengisytiharan itu dan bukan menyembunyikan fakta tersebut.

Seluruh sejarah dibawa bersama fail. Sembilan langkah bertahan di sini: lima yang direkodkan Google semasa menjana dan menera air imej, kemudian empat yang direkodkan Lolly semasa membuka, menanda dan menukar salinan pada halaman ini. Verify membacanya terus daripada bait dan melukisnya sebagai garis masa.

![Sejarah perubahan yang dibaca semula oleh Verify daripada imej ribut - lima langkah direkodkan oleh Google, kemudian empat oleh Lolly, berakhir pada WebP di halaman ini](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Itulah demonya. Semakan di bawah ialah jaminan di bawahnya, dan setiap satu boleh diulang. [Content Credentials](/info/content-credentials-identity.html) menerangkan setiap keputusan.

## Dalam pelayar anda, tiada alat diperlukan

::: timeline
- <!--i:globe--> **1. Perhatikan rangkaian.** Buka [lolly.tools](https://lolly.tools), buka DevTools pelayar anda (F12), tukar ke **Network** dan gunakan alat: taip alamat web ke dalam [QR Code](/t/qr-code), ubah warna, eksport PNG. Setiap permintaan kekal pada `lolly.tools`: shell apl, fail alat itu sendiri dan aset katalog. Tiada hos analitik, tiada isyarat CDN, tiada perkhidmatan fon dan tiada titik akhir pelaporan ralat. Apa yang anda taip ke dalam alat muncul dalam **tiada permintaan langsung**, kerana perenderan adalah setempat.
- <!--i:eyeoff--> **2. Cabut palam.** Muatkan apl dan buka satu atau dua alat, kemudian pergi luar talian (mod pesawat, atau DevTools → Network → Offline) dan muat semula. Galeri dan setiap alat yang anda buka terus berfungsi, termasuk perenderan dan eksport dalam format yang anda gunakan. Fail alat dan pengekod format dicache kali pertama anda menggunakannya, jadi gunakan alat sekali dalam talian sebelum mengujinya luar talian. Ini ialah semakan tunggal terkuat pada halaman ini: perisian yang menghubungi rumah tidak bertahan apabila kordnya diputuskan.
- <!--i:check--> **3. Kira kuki.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Senarai kosong: apl tidak menetapkan kuki. Tampal `document.cookie` ke dalam konsol dan anda mendapat `""`. Pendaftaran CA pilihan menetapkan kuki `HttpOnly` jangka pendek, `lolly_ca_state`, terskop kepada `/api/ca`, yang tidak dapat ditunjukkan `document.cookie`. Instans Lolly Work menggunakan kuki log masuknya sendiri; bandingkannya dengan [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Baca storan anda sendiri.** Dalam panel yang sama, segala yang disimpan Lolly ada di hadapan anda: beberapa dozen kunci `localStorage` biasa (tema, bahasa, lebar bar sisi, tetapan bunyi dan paparan, dan salinan cache indeks katalog alat awam) dan dokumen anda sendiri dalam IndexedDB. Setiap nilai ialah rentetan atau JSON boleh baca, tanpa apa-apa dikaburkan. Mengosongkan data tapak membuang rekod setempat ini, tetapi bukan sandaran Sync atau rekod yang dipegang instans Lolly Work. **Settings → Storage → Clear all my data** melakukan perkara yang sama dari dalam apl, dan anda boleh melihat stor dan cache dikosongkan.
- <!--i:lock--> **5. Semak kenalan pendedahan wujud.** [`/.well-known/security.txt`](/.well-known/security.txt) menjawab dengan blok kenalan [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), bukan halaman HTML.
:::

::: details Apa lagi yang mungkin anda lihat dalam tab Network
Sesetengah ciri mencapai rangkaian hanya apabila anda menggunakannya, dan setiap satu kelihatan dalam tab yang sama:

- menambah **Google Font** dalam Design System Setup mengambil satu keluarga itu daripada Google, selepas dialog persetujuan yang menyatakannya, sekali, sebelum pengambilan pertama;
- mengklik **pratetap profil cetak ICC** mengambil profil itu daripada daftar awam ICC di color.org;
- memainkan **radio** terbina dalam pilihan menstrim daripada stesen;
- memasukkan lokasi dalam **Meeting Planner** mencari tempat itu pada perkhidmatan geokod open-meteo untuk koordinat dan zon waktunya, sekali bagi setiap bandar (jawapan disimpan pada peranti anda), dan medan menyatakannya di tempat anda menaip;
- **URL Screenshot** memuatkan alamat yang anda taip, kerana itu tugasnya, dan anda melihatnya berlaku.

Alat yang mengisytiharkan keupayaan rangkaian hanya boleh mengambil daripada hos yang disenarai putih manifesnya, dan semakan itu gagal tertutup. Tiada alat yang dihantar hari ini mengisytiharkan satu, jadi Content-Security-Policy yang dikuatkuasakan pelayar ialah apa yang mengekalkan senarai di atas pada hosnya. [Dasar privasi](/info/privacy.html) menyimpan jadual kanonik semua ini, termasuk trafik instans terurus seperti penyegaran dasar dan pelaporan yang diaktifkan.
:::

## Daripada terminal

**6. Titik akhir render menjawab dengan data awam sahaja.** Satu-satunya ciri pelayan yang meletakkan input yang ditaip ke dalam URL, render pautan panas, aktif di sini. [Dasar privasi](/info/privacy.html) menyatakan apa maksudnya untuk input yang anda letakkan dalam pautan.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Setiap penempatan memilih (`LOLLY_DISABLE_RENDER_GET=1`): pada instans yang menetapkannya, siasatan yang sama memulangkan `404`. Perbezaan itu ialah tetapan yang berfungsi, bukan ketidakkonsistenan.

**7. Semak perkhidmatan yang diaktifkan penempatan anda.** [Server Surface](/info/server-surface.html) menyenaraikan perkhidmatan pilihan dan memaut rujukan terperincinya. Untuk Lolly Work, sertakan API disahkannya, sambungan kolaborasi, storan dan penyedia yang dikonfigurasi. Siasatan lolly.tools awam tidak menguji instans organisasi persendirian.

Jika anda menjalankan instans sendiri, [Delivery deployment](/info/deploy-delivery.html) mempunyai semakan keluaran untuknya: integriti model, siasatan tepi dan senarai sampelnya, rendisi paparan, gerbang muat turun persendirian dan katalog bertandatangan dalam pelayar.


## Dalam kod sumber

Semua di atas masih boleh menjadi sandiwara jika kod yang ditempatkan berbeza daripada kod awam. Jadi semak kod. Penempatan dibina daripada [repositori awam](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Tiada penjejak dan tiada SDK analitik, di mana-mana.** Cari kod yang dihantar (enjin, setiap shell termasuk sambungan pelayar, penindihan jambatan Tauri dan pekerja perkhidmatan, fungsi pelayan dan pek alat) untuk suspek biasa:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Imbasan ini mencari SDK penjejakan pihak ketiga. Ia tidak menunjukkan ketiadaan pelaporan penggunaan pihak pertama: Lolly Work menyokong telemetri organisasi dan log audit berasingan, dengan dasar dan ujian sendiri.

**9. Tiada penyelesai DNS pihak ketiga.** Semakan SEAL Verify tidak pernah menghantar carian melalui penyedia DNS-over-HTTPS, kerana apl tidak mempunyai penyelesai:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Perkhidmatan sijil tidak menyimpan log pengeluaran.** CA identiti tidak menyimpan log apa yang dikeluarkannya dan tiada inventori identiti: tiada baris stdout, tiada webhook, tiada stor sijil. Ketiadaan itu boleh dicari:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA memang menyimpan keadaan kerja jangka pendek: baldi had kadar memegang kunci IP dan e-mel yang dicincang untuk tetingkapnya, dan stor kemasukan penempatan terurus menyimpan pengecam berkunci dan digest permintaan selama paling lama sepuluh minit. [Content Credentials engineering](/info/content-credentials-engineering.html#protocol) mempunyai butirannya.

## Dikuatkuasakan oleh ujian

Semakan sumber di atas bukan audit sekali sahaja: ia disemat dalam suite ujian, jadi ia tidak boleh reput secara senyap. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) menyemak senarai nama penjejak yang lebih panjang daripada imbasan di atas dan menggagalkan binaan jika:

- sebarang SDK analitik atau penjejakan muncul di mana-mana dalam sumber yang dihantar yang diimbasnya, merentasi kod apl, enjin, pelayan, sambungan dan pek alat;
- sebarang penyelesai DNS-over-HTTPS pihak ketiga muncul dalam sumber itu;
- log pengeluaran CA kembali, dalam sumber **atau** bundle pelayan yang dijana;
- dasar privasi kehilangan pernyataan yang diwajibkan undang-undang (pengawal bernama, asas undang-undang, hak mengadu).

Jalankannya sendiri dalam klon (Node 22.18 atau lebih baharu; fail ini tidak memerlukan `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Suit penuh (`pnpm install && pnpm test`) menjalankan beberapa ribu lagi, termasuk ujian kriptografi bersifat adversarial yang diterangkan dalam [Security & Verification](/info/security.html).

## Apa yang tidak dapat anda sahkan dari luar

- **Log akses pengehosan.** Mana-mana pelayan yang menjawab permintaan boleh melognya: alamat IP, laluan dan masa. Siasatan luar tidak dapat menentukan berapa lama log disimpan. Pengendali mengawal pengelogan, putaran dan eksport, dan mesti mendedahkan pilihan itu. Perenderan setempat mengekalkan suntingan biasa pada peranti anda; perenderan pelayan pilihan dan perkhidmatan ruang kerja dikongsi mempunyai aliran data berasingan yang diterangkan dasar privasi.
- **Bahawa penempatan menjalankan kod ini.** Anda boleh menyemak bahawa sumber bersih dan bahawa kelakuan yang ditempatkan sepadan dengannya, dan semakan di atas melakukan kedua-duanya. Pengesahan tahap binari penempatan web bukan sesuatu yang ditawarkan platform web. Langkah pengurangan ialah repositori awam, ujian yang dikuatkuasakan dan semakan luar talian: penempatan yang diusik yang menghubungi rumah gagal semakan 1 dan 2 sekali gus.
- **Hook alat.** Logik pilihan alat terbina dalam disemak dan bukan dikotak-pasirkan: ia berjalan dalam halaman melainkan alat memilih Worker. Setiap alat di lolly.tools ialah pihak pertama dan disemak sebelum dihantar. [Threat Model](/info/threat-model.html#trust-boundaries) menyatakan di mana hook berjalan dan apa yang mengehadkannya.

## Jika sesuatu semakan gagal

Perbezaan antara halaman ini dan apa yang anda perhatikan ialah laporan keselamatan. Hantarkannya melalui saluran persendirian di [Security & Verification](/info/security.html#reporting-a-vulnerability). Kami mengamalkan pendedahan terkoordinasi dan memberi kredit kepada pelapor.
