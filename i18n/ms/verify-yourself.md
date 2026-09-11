# Sahkan Sendiri

Halaman privasi dan keselamatan Lolly membuat dakwaan: tiada analitik, tiada penjejakan, fail tidak sekali-kali meninggalkan peranti, satu kuki dalam keseluruhan sistem. Halaman ini berbeza: ia tidak meminta anda mempercayai semua itu. Ia adalah senarai prosedur, setiap satu dengan arahan atau laluan klik yang tepat serta output yang akan anda lihat. Setiap dakwaan di sini boleh disangkal dalam beberapa minit, kebanyakannya tanpa memasang apa-apa.

Jika mana-mana semakan pada halaman ini tidak menghasilkan keputusan yang ditunjukkan, itu sama ada pepijat atau janji yang dimungkiri. [Laporkannya](#if-a-check-fails) dalam kedua-dua kes, dan kami akan menanganinya dengan keterukan yang sepatutnya bagi janji yang dimungkiri.

## Lihat ia berfungsi, dalam sepuluh saat

Sebelum prosedur, ganjarannya dahulu. Buka [`/verify`](/#/verify) dan lepaskan fail padanya - tiada muat naik, tiada akaun, tiada menunggu pelayan. Ini dia sedang menyemak [ribut Queensland yang dijana](/info/ai-stance.html) daripada halaman pendirian AI kami: imej Gemini yang dibuka, disaiz semula dan dieksport oleh Lolly. Setiap lencana di bawah dikira pada peranti, daripada bait fail itu sendiri.

![Verify pada skrin lebar telefon - imej ribut, keputusan hijau Made with Lolly dan lencana credential-intact serta bytes-unchanged bertindan di bawahnya](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Keputusan itu bukan satu lencana tetapi timbunan kecil lencana, setiap satu fakta yang berdiri sendiri:

- <!--i:lock--> **Made with Lolly** - kredensial itu utuh *dan* merekodkan eksport Lolly.
- <!--i:seal--> **Kredensial itu utuh** - manifes C2PA yang ditandatangani berjaya dihurai dan tandatangan dakwaannya sendiri disahkan.
- <!--i:hash--> **Bait tidak berubah** - hash fail masih sepadan dengan apa yang ditandatangani. Ubah satu piksel dan lencana ini berubah.
- <!--i:sparkle--> **GEN AI** - sebuah mesin menghasilkan piksel ini, dan fail itu menyatakannya. Lolly membaca semula dakwaan itu dan bukannya menyembunyikannya.

Dan seluruh sejarahnya bergerak bersama fail itu. Sembilan langkah bertahan di sini - lima yang direkodkan Google semasa ia menjana dan mencap air imej itu, kemudian empat yang direkodkan Lolly semasa ia membuka, menanda dan menukar salinan pada halaman ini - dibaca terus semula daripada bait, pada peranti anda, dan dirender sebagai garis masa. Ini ialah imej yang sama, disahkan dengan cara yang sama, seperti garis masa C2PA pada [halaman pendirian AI](/info/ai-stance.html).

![Sejarah perubahan yang dibaca semula oleh Verify daripada imej ribut - lima langkah direkodkan oleh Google, kemudian empat oleh Lolly, berakhir pada WebP di halaman ini](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Walau bagaimanapun, semua itu bukan tuntutan kepercayaan - itu adalah demo. Selebihnya halaman ini adalah tuntutan kepercayaan: setiap lencana di atas boleh dihasilkan semula, dan berikut cara anda menghasilkan semula jaminan di sebaliknya.

## Dalam pelayar anda, tiada alat diperlukan

**1. Perhatikan rangkaian.** Buka [lolly.tools](https://lolly.tools), buka DevTools pelayar anda (F12), tukar ke tab **Network** dan gunakan satu alat - taip URL ke dalam [QR Code](/t/qr-code), tukar warna, eksport PNG. Setiap permintaan kekal pada `lolly.tools`: cengkerang aplikasi, fail alat itu sendiri, aset katalog. Tiada hos analitik, tiada beacon CDN, tiada perkhidmatan fon, tiada titik akhir "laporan ralat". Apa yang anda taip ke dalam alat muncul dalam **tiada permintaan langsung** - pemaparan adalah setempat.

Pengecualian yang jujur - setiap satu adalah opt-in, dimulakan oleh pengguna dan kelihatan dalam tab Network yang sama apabila ia berlaku: menambah **Google Font** dalam editor jenama mengambil satu keluarga fon itu daripada Google, selepas dialog persetujuan yang memberitahu anda tepat perkara itu, sekali, sebelum ambilan pertama; mengklik **preset profil cetak ICC** mengambil profil itu daripada registri awam ICC di color.org; memainkan **radio** terbina dalam pilihan mengalirkan siaran daripada stesen itu; memasukkan lokasi dalam **Meeting Planner** mencari tempat itu pada perkhidmatan geokod open-meteo untuk koordinat dan zon waktunya, sekali bagi setiap bandar (jawapan disimpan pada peranti anda), dan input itu membawa pendedahan tersebut tepat di tempat anda menaip; dan **URL Screenshot** semestinya memuatkan URL yang anda taip - itu tugasnya, dan anda menyaksikannya berlaku. Alat yang mengisytiharkan keupayaan rangkaian hanya boleh mengambil daripada hos yang disenaraibenar oleh manifestnya, dan mekanisme itu adalah fail-closed; tiada alat yang kini dihantar mengisytiharkan satu, jadi Content-Security-Policy yang dikuatkuasakan pelayar adalah sempadan yang sebenarnya mengikat senarai di atas kepada hosnya. [Dasar privasi](/info/privacy.html) menyimpan jadual kanonik bagi semua ini; peraturan tetapnya ialah sentuhan rangkaian yang tiada dalam jadual itu tidak berlaku.

**2. Cabut palam.** Muatkan aplikasi dan buka satu atau dua alat, kemudian putuskan sambungan - mod kapal terbang, atau DevTools → Network → Offline. Muat semula. Galeri dan setiap alat yang anda buka terus berfungsi, termasuk pemaparan dan eksport dalam format yang telah anda guna - fail alat dan pengekod format dicache pada kali pertama anda menggunakannya, jadi jalankan alat itu sekali dalam talian sebelum mengujinya luar talian. Ini adalah semakan tunggal paling kukuh pada halaman ini: perisian yang "menelefon pulang" tidak dapat bertahan apabila talinya dipotong.

**3. Kira kuki.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Senarai itu kosong - aplikasi tidak menetapkan sebarang kuki. Atau tampal `document.cookie` ke dalam konsol: anda dapat `""`. (Satu-satunya kuki dalam keseluruhan sistem, `lolly_ca_state`, bertahan paling lama sepuluh minit semasa daftar masuk identiti pilihan - dipadamkan sebaik sahaja daftar masuk selesai - berskop kepada `/api/ca` dan adalah `HttpOnly`: [dasar privasi](/info/privacy.html) menerangkannya dengan tepat.)

**4. Baca storan anda sendiri.** Panel Application yang sama: segala yang disimpan Lolly boleh diperiksa di hadapan anda - beberapa dozen kunci `localStorage` biasa (tema, bahasa, lebar bar sisi, tetapan bunyi dan paparan, ditambah salinan cache indeks katalog alat awam), dan dokumen anda sendiri dalam IndexedDB. Setiap nilai adalah rentetan atau JSON yang boleh dibaca - tiada apa yang dikaburkan, tiada apa yang dikodkan untuk menghalang pembacaannya. **Profile → Clear all my data** memadamkannya; begitu juga membersihkan data laman dalam pelayar, kerana tiada salinan sisi pelayan untuk terus wujud.

**5. Semak kontak pendedahan wujud.** [`/.well-known/security.txt`](/.well-known/security.txt) membalas dengan blok kontak [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), bukan halaman HTML.

## Daripada terminal

**6. Titik akhir pemaparan dimatikan pada lolly.tools.** Satu-satunya ciri pelayan yang akan meletakkan input yang ditaip pengguna ke dalam URL - pemaparan pautan-terus (hot-link) - dilumpuhkan di sini sehingga perkhidmatan ini berpindah ke pengehosan milik organisasi ([dasar privasi](/info/privacy.html) menerangkan sebabnya):

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 404
```

Suis ini adalah mengikut penggunaan setiap penerapan (`LOLLY_DISABLE_RENDER_GET=1`): pada instans yang membiarkannya tidak ditetapkan, pemaparan pautan-terus aktif, jadi ujian yang sama di sana mengembalikan imej - perbezaan itu adalah bendera itu berfungsi, bukan ketidakkonsistenan.

**7. Permukaan pelayan boleh disenaraikan.** [Server Surface](/info/server-surface.html) menyenaraikan setiap laluan sisi pelayan yang wujud, dengan peraturan tetap bahawa titik akhir yang tiada pada halaman itu bukan sebahagian daripada Lolly. `curl` kesemuanya; tiada apa-apa lagi untuk ditemui.

## Dalam kod sumber

Semua di atas masih boleh menjadi teater jika kod yang diterapkan berbeza daripada kod awam. Jadi semak kod itu - penerapan ini dibina daripada [repositori awam](https://github.com/lolly-tools/lolly):

```bash
git clone --recurse-submodules https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Tiada penjejak, tiada SDK analitik, di mana-mana.** Cari dalam kod yang dihantar - enjin, setiap shell (termasuk sambungan pelayar, penggantian jambatan Tauri dan pekerja perkhidmatan), fungsi pelayan dan pek alat - untuk suspek biasa:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

**9. Tiada penyelesai DNS pihak ketiga.** Semakan SEAL Verify tidak pernah menghalakan carian melalui penyedia DNS-over-HTTPS - aplikasi web ini semata-mata tiada penyelesai:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Perkhidmatan sijil tidak menyimpan apa-apa.** CA identiti tidak mempunyai log pengeluaran - bukan e-mel anda, bukan cap masa, bukan webhook. Ketiadaan itu boleh disahkan dengan grep:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

## Dikuatkuasakan oleh ujian, bukan janji

Tiga semakan sumber di atas bukan audit sekali sahaja - ia disematkan dalam set ujian, jadi ia tidak boleh reput secara senyap. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) menggagalkan pembinaan jika:

- sebarang SDK analitik atau penjejakan muncul di mana-mana dalam sumber yang dihantar yang diimbasnya - kod aplikasi, enjin, pelayan, sambungan dan pek alat sama sahaja,
- sebarang penyelesai DNS-over-HTTPS pihak ketiga muncul dalam sumber itu,
- log pengeluaran CA muncul semula - dalam sumber **atau** bundel pelayan yang dijana,
- dasar privasi kehilangan pernyataan yang diwajibkan secara undang-undang (pengawal yang dinamakan, asas undang-undang, hak untuk mengadu).

Jalankan sendiri dalam klon (Node 22.18+; `npm install` tidak diperlukan untuk fail ini):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Set penuh (`npm install && npm test`) menjalankan beberapa ribu lagi, termasuk ujian kriptografi adversarial yang diterangkan dalam [Security & Verification](/info/security.html).

## Apa yang tidak dapat anda sahkan dari luar - dinyatakan dengan jelas

Halaman seperti ini memperoleh kepercayaan dengan menamakan batasannya sendiri:

- **Log akses pengehosan.** Mana-mana pelayan yang membalas permintaan boleh mencatat permintaan itu - IP, laluan, cap masa. Anda tidak dapat mengesahkan apa yang disimpan atau tidak disimpan oleh sesuatu hos, begitu juga kami di luar tingkah laku yang didokumentasikan oleh penyedia kami. Itulah sebabnya seni bina ini mengekalkan kandungan anda sepenuhnya di luar talian wayar: apa yang tidak pernah meninggalkan peranti anda tidak boleh dicatat oleh sesiapa.
- **Bahawa penerapan menjalankan kod ini.** Anda boleh mengesahkan bahawa sumber itu bersih dan bahawa tingkah laku yang diterapkan sepadan dengannya (semakan di atas melakukan kedua-dua hujung), tetapi pengesahan peringkat binari bagi penerapan web bukanlah sesuatu yang ditawarkan oleh platform web. Langkah mitigasi adalah repo awam, ujian yang dikuatkuasakan dan semakan luar talian - penerapan yang diusik yang "menelefon pulang" akan gagal semakan 1 dan 2 dengan segera.
- **Cangkuk alat tidak disandkotak secara lalai.** Logik pilihan sesuatu alat berjalan setelah disemak, dalam alam halaman itu sendiri; setiap alat pada lolly.tools adalah pihak pertama dan disemak sebelum dihantar. Pengasingan Worker kini dihantar sebagai pilihan setiap-alat - alat yang manifestnya menetapkan `isolate: true` menjalankan cangkuknya di luar bebenang utama sebaliknya - jadi apa yang tidak dapat anda sahkan dari luar semakin mengecil, tetapi laluan lalai masih dalam alam yang sama dan semakan masih menjadi kawalan. Ini dinyatakan, bukan disembunyikan - lihat bahagian [sempadan reka bentuk](/info/security.html), yang sentiasa menyatakan sedemikian.

## Jika sesuatu semakan gagal

Percanggahan antara halaman ini dan tingkah laku yang diperhatikan adalah laporan keselamatan, dan kami sememangnya lebih suka mendengarnya berbanding tidak: [fitzy+security@suse.com](mailto:fitzy+security@suse.com), butang **Report a vulnerability** pada mana-mana [repositori lolly-tools](https://github.com/lolly-tools) atau kontak dalam [`/.well-known/security.txt`](/.well-known/security.txt). Pendedahan terselaras dan pengiktirafan pelapor adalah dasar tetap - [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md) mempunyai butirannya.
