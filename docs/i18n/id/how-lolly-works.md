# Cara kerja Lolly

Alat Lolly menyimpan aturan untuk satu jenis file: tata letak, tipografi, warna dan bagian yang boleh diubah orang lain. Anda, rekan, skrip atau agen AI mengisi field-nya dan setiap file mengikuti aturan tersebut.

<!--i:eti-repeat-->
## Satu alat, aturan Anda, banyak file

Aturan brand tersimpan dalam alat. Siapkan alat sekali dan setiap keluaran mendapat tipografi, warna dan jarak yang sama, dari satu kartu hingga spreadsheet berisi baris-baris dalam selusin bahasa.

![Alat wordmark dengan satu field terisi: tipografi, warna dan jarak ditetapkan saat alat dibuat](/info/shots/aud-rules-in-the-tool.svg)

Orang yang membuat file keseratus hanya mengetik kata-katanya. Anda menentukan cara karya diperiksa dan siapa yang memeriksanya. Lolly mengurangi hal yang perlu diperiksa dan mempercepat pembuatan file berikutnya.

<!--i:eti-users-->
## Siapa yang menggunakan alat

Tiga peran dalam organisasi mengerjakan satu kartu kampanye.

![Desainer menetapkan aturan sekali dalam alat; pengembang menjalankannya dari skrip dan siapa pun dapat mengisi field-nya; keduanya menghasilkan file jadi](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Desainer menetapkan aturan.** Desainer menata kartu di Lolly Design dengan tipografi dan warna brand, lalu memilih field yang tetap terbuka. Ini dilakukan sekali, jadi tidak ada yang perlu melokalkan kartu secara manual lagi.
- <!--i:code--> **Pengembang memperluas penggunaan alat.** Alat yang sama berjalan dalam skrip setiap malam melalui baris perintah. Grafik terbaru atau versi bahasa baru tersedia tanpa perlu membuka kembali desain.
- <!--i:people--> **Siapa pun mengisinya.** Staf penjualan di pesawat, tanpa jaringan dan tanpa pelatihan desain, membuka alat dan membuat kartu untuk rapat besok.
:::

Grafik terbaru dari pengembang adalah render seperti ini, dibuat dari string data dan beberapa pengaturan:

![Grafik area bertumpuk dengan judul, tiga serinya berlapis dalam palet warna dingin, dengan sumbu, legenda dan judul yang semuanya ditempatkan oleh templat alih-alih secara manual](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Semenit yang dibutuhkan staf penjualan bergantung pada aturan desainer dan skrip pengembang. Setiap peran menggunakan alat yang sama.

<!--i:eti-train-->
## Empat jalur menuju file

Setiap jalur menjalankan mesin yang sama pada alat yang sama, sehingga file yang dibuat skrip sama dengan yang Anda pratinjau di aplikasi.

![Parameter URL dan argumen baris perintah menjadi model input yang sama, dijalankan melalui satu runtime dan penghubung ekspor bersama](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **Di aplikasi, satu per satu.** Buka alat, isi field dan tekan **Export**. [Buat file pertama Anda](/info/make-something.html) memandu Anda membuat satu file.
- <!--i:layers--> **Di aplikasi, banyak sekaligus.** [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) menerima tabel yang ditempel atau diimpor dan merender satu file jadi per baris.
- <!--i:cpu--> **Dari skrip atau agen AI.** [CLI](/info/cli.html) menjalankan alat tanpa antarmuka, dan [server MCP](/info/mcp.html) memungkinkan agen menemukan dan menjalankan alat. Tautan ke alat juga memuat inputnya, jadi tautan adalah permintaan lengkap.
- <!--i:server--> **Melalui server organisasi Anda.** [Lolly Work](/info/organisation.html) merender di server sesuai kebijakan masuk dan alat organisasi Anda, menyimpan tugas yang dapat dilanjutkan serta menyimpan keluaran untuk diunduh atau dikirim dengan persetujuan.

Jalur yang dapat digunakan tugas bergantung pada format alat dan kemampuan host. Beberapa format memerlukan browser, jadi baris perintah menyerahkannya ke lapisan browser. [Render dengan CLI](/info/cli-rendering.html) mencantumkan tempat setiap format dirender.

<!--i:eti-monitor-->
## Apa yang berjalan di mana

Pembuatan, penyuntingan dan ekspor berjalan di perangkat Anda, tanpa akun. Fitur yang memerlukan server, seperti Sync atau mengirim file ke layanan terhubung, hanya terhubung saat Anda menggunakan fitur itu. Dengan Lolly Work, proyek bersama, penyuntingan tim langsung, persetujuan dan tugas server menggunakan server organisasi Anda. [Apa yang berjalan di mana](/info/compare.html#what-runs-where) membandingkan kedua bagian tersebut.

<!--i:eti-graduation-cap-->
## Bacaan selanjutnya

- [Buat file pertama Anda](/info/make-something.html), untuk mencobanya sekarang.
- [Mulai](/info/quickstart.html), untuk memasukkan design system Anda sendiri.
- [Otomatisasikan](/info/builders.html), untuk baris perintah, tautan dan agen.
- [Arsitektur Lolly](/info/overview.html), untuk kontributor: mesin, shell dan aturan yang menyatukannya.
