# Cara kerja Lolly

Alat Lolly menyimpan aturan untuk satu jenis file: tata letak, tipografi, warna, dan bagian mana yang boleh diubah orang lain. Anda, rekan kerja, skrip, atau agen AI mengisi field-nya, dan setiap file keluar dengan benar. Halaman ini menunjukkan siapa melakukan apa, dan empat jalur dari alat menuju file jadi.

## Satu alat, aturan Anda, banyak file

Aturan brand berada di alat, bukan di setiap file yang dihasilkannya. Atur alatnya dengan benar sekali dan setiap keluaran mewarisi tipografi, warna, dan jarak yang sama, entah itu satu kartu atau spreadsheet berisi baris dalam belasan bahasa.

![Alat wordmark dengan satu field terisi: tipografi, warna, dan jarak sudah ditetapkan saat alat dibuat](/info/shots/aud-rules-in-the-tool.svg)

Orang yang membuat file keseratus hanya mengetik katanya. Cara Anda memeriksa hasil, dan siapa yang memeriksa, tetap keputusan Anda. Lolly membuat hal yang perlu diperiksa lebih kecil, dan file berikutnya lebih cepat dibuat.

## Siapa yang menyentuh sebuah alat

Ikuti satu kartu kampanye melalui sebuah organisasi dan tiga pasang tangan muncul. Masing-masing membangun di atas yang sebelumnya.

![Desainer menetapkan aturan sekali di sebuah alat; pengembang menjalankannya dari skrip dan siapa pun dapat mengisi field-nya; keduanya menghasilkan file jadi](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Desainer menetapkan aturan.** Mereka menata kartu di Design dengan tipografi dan warna brand, lalu memilih field mana yang tetap terbuka. Mereka melakukannya sekali, sehingga tidak ada yang melokalkan kartu itu dengan tangan lagi.
- <!--i:code--> **Pengembang menskalakan alat.** Alat yang sama berjalan di skrip malam melalui baris perintah, sehingga bagan baru atau versi bahasa baru tiba tanpa ada yang membuka kembali desainnya.
- <!--i:people--> **Siapa pun mengisinya.** Seorang tenaga penjualan di pesawat, tanpa jaringan dan tanpa pelatihan desain, membuka alat dan membuat kartu untuk rapat besok.
:::

Bagan baru pada langkah pengembang adalah render seperti ini, dibuat dari string data dan beberapa pengaturan tanpa ada yang membuka file desain:

![Bagan area bertumpuk berjudul, tiga serinya berpita dalam palet dingin, dengan sumbu, legenda, dan judul semuanya ditempatkan oleh templat, bukan dengan tangan](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Semenit mudah bagi tenaga penjualan itu hanya mungkin berkat ketelitian desainer dan skrip pengembang. Setiap peran bekerja dengan alat yang sama, bukan produk terpisah untuk masing-masing.

## Empat jalur menuju file

Setiap jalur menjalankan engine yang sama pada alat yang sama, sehingga file yang dibuat skrip sama dengan yang Anda pratinjau di aplikasi.

![Parameter URL dan argumen baris perintah menjadi model input yang sama, dijalankan melalui satu runtime dan bridge ekspor bersama](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **Di aplikasi, satu per satu.** Buka alat, isi field, dan tekan **Export**. [Make your first file](/info/make-something.html) memandu Anda membuat satu.
- <!--i:layers--> **Di aplikasi, banyak sekaligus.** [Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) menerima tabel yang ditempel atau diimpor dan merender satu file jadi per baris.
- <!--i:cpu--> **Dari skrip atau agen AI.** [CLI](/info/cli.html) menjalankan alat tanpa antarmuka, dan [server MCP](/info/mcp.html) memungkinkan agen menemukan dan menjalankan alat. Tautan ke sebuah alat juga membawa inputnya, jadi tautan adalah permintaan yang lengkap.
- <!--i:server--> **Melalui server organisasi Anda.** [Lolly Work](/info/organisation.html) merender di server di bawah login dan kebijakan alat organisasi Anda, menyimpan pekerjaan yang dapat dilanjutkan, dan menahan keluaran untuk diunduh atau dikirim secara resmi.

Jalur mana yang dapat dipakai sebuah pekerjaan bergantung pada format alat dan kemampuan host: sebagian format membutuhkan browser, sehingga baris perintah menyerahkannya ke tingkat browser. [Render with the CLI](/info/cli-rendering.html) mencantumkan format mana dirender di mana.

## Apa yang berjalan di mana

Membuat, menyunting, dan mengekspor berjalan di perangkat Anda, tanpa akun. Fitur yang memerlukan server, seperti Sync atau mengirim file ke layanan terhubung, baru tersambung saat Anda memakai fitur itu. Dengan Lolly Work, proyek bersama, penyuntingan tim secara langsung, persetujuan, dan pekerjaan server memakai server organisasi Anda. [What runs where](/info/compare.html#what-runs-where) menyandingkan kedua bagian itu.

## Baca berikutnya

- [Make your first file](/info/make-something.html), untuk mencobanya sekarang.
- [Start](/info/quickstart.html), untuk memasukkan design system Anda sendiri.
- [Automate](/info/builders.html), untuk baris perintah, tautan, dan agen.
- [Lolly architecture](/info/overview.html), untuk kontributor: engine, shell, dan aturan yang menyatukannya.
