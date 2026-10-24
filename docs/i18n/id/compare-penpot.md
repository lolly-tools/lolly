# Lolly dan Penpot

_Terakhir diperiksa: 28 September 2026._

Jika tim Anda mendesain di Penpot, Lolly bekerja berdampingan dengan Penpot: keduanya sumber terbuka dan keduanya membaca token desain yang sama. Halaman ini menyatakan pekerjaan mana untuk masing-masing.

## Apa yang dilakukan Penpot lebih baik

[Penpot](https://penpot.app/) menyediakan desain antarmuka, komponen, tata letak fleksibel, prototipe interaktif, dan inspeksi pengembang, dengan penyuntingan waktu nyata dan kursor langsung. Ia menawarkan deployment hosted dan self-hosted, dengan [opsi pemasangan Docker dan Kubernetes](https://help.penpot.app/technical-guide/getting-started/). Untuk mendesain aplikasi, Penpot adalah alatnya.

## Di mana keduanya beririsan

[Token desain Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) memakai format DTCG, yang juga dibaca Lolly, sehingga warna, huruf, dan nilai token lain berpindah di antara keduanya. [Import a design](/info/design-import.html) Lolly membuka ekspor `.penpot` sebagai tata letak yang dapat disunting, dan **Send to Penpot** di Lolly mengirim desain kembali sebagai arsip `.penpot`. Lolly juga memelihara [plugin Lolly Export untuk Penpot](https://github.com/lolly-tools/lolly-plugins-penpot-export), yang memakai engine Lolly untuk menambahkan Content Credentials opsional di perangkat.

## Bagaimana Lolly mengerjakan pekerjaan yang tumpang tindih

Kanvas Design Lolly membuat aset yang dapat disunting dan dapat mengubah tata letak menjadi [alat dengan aturan](/info/create-a-tool.html). Alat yang sama merender di browser, aplikasi desktop, atau CLI dan membuat varian dari data. Lolly mandiri merender dan menandatangani di perangkat, tanpa akun atau server. [Collab privat](/info/collaborate.html) memasangkan dua perangkat secara langsung.

## Dengan organisasi

Lolly Work menambahkan single sign-on, penyediaan SCIM, katalog dan proyek bersama, peran, persetujuan, catatan audit, work collab, dan rendering server. Kedua repositori berlisensi MPL-2.0 dan organisasi dapat menjalankan keduanya. [What runs where](/info/compare.html#what-runs-where) menyandingkan kedua bagian itu.

Anda dapat memakai keduanya: Penpot untuk desain antarmuka dan prototipe, Lolly untuk file berulang, dihubungkan oleh token bersama dan desain yang diimpor.

Penpot adalah merek dagang pemiliknya. Halaman ini menjelaskan di mana kedua produk tumpang tindih dan tidak berafiliasi dengan Penpot.
