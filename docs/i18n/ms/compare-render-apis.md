# Lolly dan API render

_Semakan terakhir: 5 November 2026._

Jika anda menjana imej daripada templat melalui API, halaman ini menyatakan apa yang berubah apabila anda menjalankan penghasilan itu pada peranti anda sendiri, dalam CI atau pada pelayan yang anda kawal. [Beralih daripada API render yang dihoskan](/info/work-move-from-render-api.html) memberikan langkahnya.

<!--i:eti-award-->
## Apa yang API render dihoskan lakukan dengan lebih baik

[Bannerbear](https://www.bannerbear.com/) dan [Placid](https://placid.app/) ialah perkhidmatan terurus: anda menghantar permintaan dan orang lain menjalankan pelayannya.

- **Tiada apa-apa untuk dikendalikan.** Tiada pelayan, pangkalan data, storan, kemas kini atau perancangan kapasiti.
- **Penyunting templat yang dihoskan** dengan templat sedia untuk disesuaikan.
- **Lebih banyak jenis output daripada satu API.** Kedua-duanya menerbitkan titik akhir video dan PDF, dan Bannerbear turut mendokumenkan output beranimasi, WebP dan AVIF, tangkapan skrin dan pembuangan latar belakang dengan AI.
- **Integrasi dan sokongan mereka sendiri.**

Jika itulah aturan yang anda mahu, perkhidmatan itu ialah pilihan yang baik.

<!--i:eti-home-->
## Apa yang anda dapat dengan pengehosan sendiri

- **Kandungan anda kekal pada sistem anda.** Input, aset dan output berada pada infrastruktur yang anda pilih. Render pada peranti atau dalam CI tidak memerlukan perkhidmatan.
- **Peraturan berada dalam alat.** Warna, tipografi, logo dan input terkunci datang daripada [sistem reka bentuk](/info/brand-studio.html) anda, jadi pemanggil hanya boleh mengubah apa yang anda benarkan. [Lolly Work](/info/compare.html#what-runs-where) menggunakan keterlihatan alat dan dasar input pada setiap permintaan.
- **Alat yang sama di mana-mana.** Alat merender daripada input yang sama pada komputer riba, dalam tugas CI atau pada pelayan. Orang boleh menyunting alat yang sama dalam apl.
- **Rekod yang anda pegang.** [Resit render](/info/work-renders.html#evidence-and-identity), jejak audit dan Content Credentials apabila anda mengkonfigurasi identiti penandatanganan.
- **Sumber terbuka dan tiada caj mengikut penggunaan.** Anda menjalankan kod dan membayar hanya untuk infrastruktur anda sendiri.

Anda mengambil alih kerja yang perkhidmatan itu lakukan untuk anda. Pelayan yang berkekalan memerlukan pangkalan data berterusan dan storan output. Alat yang memerlukan pelayar memerlukan pekerja Chromium. [Pasang Lolly Work](/info/work-install.html) menerangkan kedua-duanya.

<!--i:eti-table-->
## Perbandingan tugas

| Tugas | API render dihoskan | Lolly |
|---|---|---|
| Isi templat daripada data | Permintaan API yang menamakan templat dan lapisannya | [URL](/info/url-mode.html), [CLI](/info/cli.html) atau [API pelayan](/info/work-automation-api.html) yang menamakan alat dan inputnya |
| Banyak fail daripada jadual | Kelompok dan koleksi | [Kelompok](/info/batch.html) pada peranti anda, atau [kelompok render](/info/work-renders.html#batches-with-durable-rows) pada pelayan |
| Tunggu atau semak hasil secara berkala | Semakan berkala, atau pilihan segerak | Render berkekalan yang anda semak secara berkala, atau render serta-merta |
| Panggil webhook apabila selesai | Ya | [Panggilan balik bertandatangan](/info/work-renders.html) ke asal yang anda benarkan |
| URL imej dinamik | Ya | [Pautan kongsi dan URL `/render`](/info/url-mode.html) |
| Sunting templat | Penyunting dihoskan | [Design](/info/using.html), pada peranti anda |
| Ejen | Kedua-duanya menerbitkan pelayan MCP | [MCP](/info/mcp.html), dengan titik akhir organisasi di bawah dasar token pada Lolly Work |

Jenis output Lolly sendiri disenaraikan dalam [Eksport fail](/info/exporting.html). Pada pelayan Work buat masa ini, render berkekalan membuat SVG, PNG, JPG dan PDF, dan [video kekal pada peranti, CLI dan MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

<!--i:eti-folder-move-->
## Apa yang boleh dipindahkan, dan apa yang tidak

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Permintaan anda | API migrasi Work menerima struktur yang sama | Sama | Sama |
| Templat anda | **Import** sebagai dokumen yang boleh disunting, kecuali jenis lapisan tanpa skema yang disahkan | Nama medan dan pratonton sahaja. Bina semula setiap satu | Nama medan dan pratonton sahaja. Bina semula setiap satu |
| URL dinamik sedia ada | Tidak disokong | Tidak disokong | URL bertandatangan terus berfungsi selepas pertukaran hos, dengan token peribadi lama anda |
| Webhook | Webhook berdaftar tidak disokong | `webhook_url` berfungsi | `webhook_success` berfungsi |
| Output WebP dan AVIF | Ditolak berdasarkan nama | Tidak ditawarkan | WebP ditolak berdasarkan nama |
| Animasi, video, koleksi, tangkapan skrin | Tiada pada API migrasi | Tiada pada API migrasi | Tiada pada API migrasi |

::: note Dibina daripada dokumentasi awam
Ini dibina daripada dokumentasi awam setiap vendor dan belum dijalankan terhadap akaun sebenar. Jika anda mempunyai akaun, [panduan peralihan](/info/work-move-from-render-api.html#check-it-on-your-own-account) mempunyai senarai semak ringkas.
:::

Anda boleh memindahkan satu templat dan mengekalkan yang lain di tempatnya. [Meninggalkan Lolly](/info/work-move-from-render-api.html#leave-lolly-too) juga terbuka: alat ialah fail biasa dan CLI merendernya tanpa pelayan.

<!--i:eti-building-->
## Siapa menjalankan perkhidmatan

Dengan Lolly, individu merender secara setempat, atau pasukan menjalankan Lolly Work pada infrastrukturnya sendiri. Tugas pelayan menghantar input dan aset yang diperlukannya ke instans itu. Laluan pada peranti tidak berbuat demikian.

Bannerbear dan Placid ialah tanda dagangan pemilik masing-masing. Halaman ini menerangkan pertindihan keupayaan produk, berdasarkan dokumentasi awamnya, dan tidak mempunyai hubungan dengan mana-mana satu daripadanya.
