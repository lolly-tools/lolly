# Lolly dan API render

_Terakhir diperiksa: 5 November 2026._

Jika Anda membuat gambar dari templat melalui API, halaman ini menjelaskan apa yang berubah saat Anda menjalankan produksi itu di perangkat sendiri, di CI atau di server yang Anda kendalikan. [Beralih dari API render yang dihosting](/info/work-move-from-render-api.html) memberikan langkah-langkahnya.

<!--i:eti-award-->
## Yang lebih baik dilakukan API render yang dihosting

[Bannerbear](https://www.bannerbear.com/) dan [Placid](https://placid.app/) adalah layanan terkelola: Anda mengirim permintaan dan pihak lain menjalankan servernya.

- **Tidak ada yang perlu dioperasikan.** Tanpa server, basis data, penyimpanan, pembaruan atau perencanaan kapasitas.
- **Editor templat yang dihosting** dengan templat yang siap disesuaikan.
- **Lebih banyak jenis keluaran dari satu API.** Keduanya menyediakan endpoint video dan PDF, dan Bannerbear juga mendokumentasikan keluaran animasi, WebP dan AVIF, tangkapan layar serta penghapusan latar belakang dengan AI.
- **Integrasi dan dukungan mereka sendiri.**

Jika pengaturan seperti itu yang Anda inginkan, layanan-layanan tersebut adalah pilihan yang tepat.

<!--i:eti-home-->
## Yang Anda dapatkan dengan hosting sendiri

- **Konten Anda tetap di sistem Anda.** Input, aset dan keluaran berada di infrastruktur yang Anda pilih. Render di perangkat atau di CI tidak memerlukan layanan.
- **Aturan berada di dalam alat.** Warna, tipografi, logo dan input terkunci berasal dari [design system](/info/brand-studio.html) Anda, sehingga pemanggil hanya dapat mengubah apa yang Anda izinkan. [Lolly Work](/info/compare.html#what-runs-where) menerapkan visibilitas alat dan kebijakan input pada setiap permintaan.
- **Alat yang sama di mana pun.** Alat merender dari input yang sama di laptop, dalam tugas CI atau di server. Orang dapat menyunting alat yang sama di aplikasi.
- **Catatan yang Anda pegang.** [Tanda terima render](/info/work-renders.html#evidence-and-identity), jejak audit dan Content Credentials jika Anda mengonfigurasi identitas penandatanganan.
- **Open source dan tanpa biaya pemakaian.** Anda menjalankan kode dan hanya membayar infrastruktur Anda sendiri.

Anda mengambil alih pekerjaan yang dilakukan layanan-layanan itu untuk Anda. Server yang berkelanjutan memerlukan basis data persisten dan penyimpanan keluaran. Alat yang memerlukan browser membutuhkan worker Chromium. [Instal Lolly Work](/info/work-install.html) menjelaskan keduanya.

<!--i:eti-table-->
## Perbandingan tugas

| Tugas | API render yang dihosting | Lolly |
|---|---|---|
| Isi templat dari data | Permintaan API yang menyebut templat dan lapisannya | [URL](/info/url-mode.html), [CLI](/info/cli.html) atau [API server](/info/work-automation-api.html) yang menyebut alat dan inputnya |
| Banyak file dari tabel | Batch dan koleksi | [Batch](/info/batch.html) di perangkat Anda, atau [batch render](/info/work-renders.html#batches-with-durable-rows) di server |
| Tunggu atau periksa hasil secara berkala | Polling, atau pilihan sinkron | Render persisten yang diperiksa secara berkala, atau render langsung |
| Panggil webhook setelah selesai | Ya | [Callback bertanda tangan](/info/work-renders.html) ke origin yang Anda izinkan |
| URL gambar dinamis | Ya | [Tautan berbagi dan URL `/render`](/info/url-mode.html) |
| Sunting templat | Editor yang dihosting | [Design](/info/using.html), di perangkat Anda |
| Agen | Keduanya menyediakan server MCP | [MCP](/info/mcp.html), dengan endpoint organisasi yang tunduk pada kebijakan token di Lolly Work |

Jenis keluaran Lolly sendiri tercantum di [Ekspor](/info/exporting.html). Di server Work saat ini, render persisten menghasilkan SVG, PNG, JPG dan PDF, dan [video tetap di perangkat, CLI dan MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

<!--i:eti-folder-move-->
## Yang ikut berpindah dan yang tidak

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Permintaan Anda | API migrasi Work menerima bentuk yang sama | Sama | Sama |
| Templat Anda | **Import** sebagai dokumen yang dapat disunting, kecuali jenis lapisan tanpa skema yang dikonfirmasi | Hanya nama field dan pratinjau. Buat ulang satu per satu | Hanya nama field dan pratinjau. Buat ulang satu per satu |
| URL dinamis yang ada | Tidak didukung | Tidak didukung | URL bertanda tangan tetap berfungsi setelah host berubah, dengan token pribadi lama Anda |
| Webhook | Webhook terdaftar tidak didukung | `webhook_url` berfungsi | `webhook_success` berfungsi |
| Keluaran WebP dan AVIF | Ditolak berdasarkan nama | Tidak ditawarkan | WebP ditolak berdasarkan nama |
| Animasi, video, koleksi, tangkapan layar | Tidak tersedia di API migrasi | Tidak tersedia di API migrasi | Tidak tersedia di API migrasi |

::: note Dibangun dari dokumentasi publik
Ini dibangun dari dokumentasi publik setiap vendor dan belum dijalankan pada akun aktif. Jika Anda memiliki akun, [panduan beralih](/info/work-move-from-render-api.html#check-it-on-your-own-account) menyediakan daftar periksa singkat.
:::

Anda dapat memindahkan satu templat dan membiarkan sisanya di tempatnya. [Meninggalkan Lolly](/info/work-move-from-render-api.html#leave-lolly-too) sama terbukanya: alat berupa file biasa dan CLI merendernya tanpa server.

<!--i:eti-building-->
## Siapa yang menjalankan layanan

Dengan Lolly, seseorang merender secara lokal atau tim menjalankan Lolly Work di infrastrukturnya sendiri. Tugas server mengirim input dan aset yang diperlukan ke instans tersebut. Jalur di perangkat tidak melakukannya.

Bannerbear dan Placid adalah merek dagang pemiliknya masing-masing. Halaman ini menjelaskan kesamaan kemampuan produk-produk tersebut berdasarkan dokumentasi publiknya dan tidak berafiliasi dengan keduanya.
