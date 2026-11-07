# Lolly dan API perenderan

_Terakhir diperiksa: 5 November 2026._

Jika Anda membuat gambar dari templat melalui API hari ini, halaman ini menyatakan apa yang berubah bila Anda menjalankan produksi itu sendiri: di perangkat Anda, di CI, atau di server yang Anda kendalikan. [Move from a hosted render API](/info/work-move-from-render-api.html) adalah panduan caranya.

## Apa yang dilakukan API rendering hosted lebih baik

[Bannerbear](https://www.bannerbear.com/) dan [Placid](https://placid.app/) adalah layanan terkelola, dan itu keunggulan yang nyata. Anda mengirim permintaan dan orang lain yang menjalankan servernya, menjaganya tetap hidup, dan menangani bebannya.

- **Tidak ada yang perlu dijalankan.** Tanpa server, database, penyimpanan, pembaruan, atau perencanaan kapasitas.
- **Editor templat yang dihosting** dengan templat siap pakai untuk diadaptasi.
- **Lebih banyak jenis keluaran dari satu API.** Keduanya menyediakan endpoint video dan PDF, dan Bannerbear juga mendokumentasikan keluaran animasi, WebP dan AVIF, tangkapan layar, dan penghapusan latar belakang dengan AI.
- **Integrasi dan dukungan mereka sendiri.**

Jika pengaturan itu yang Anda inginkan, layanan-layanan tersebut adalah pilihan yang tepat.

## Yang diberikan hosting mandiri

- **Konten Anda tetap di sistem Anda.** Input, aset, dan keluaran berada di infrastruktur pilihan Anda. Merender di perangkat atau di CI tidak memerlukan layanan sama sekali.
- **Aturan berada di dalam alat.** Warna, huruf, logo, dan input terkunci berasal dari [design system](/info/brand-studio.html) Anda, sehingga pemanggil hanya dapat mengubah apa yang Anda izinkan. [Lolly Work](/info/compare.html#what-runs-where) menerapkan visibilitas alat dan kebijakan input pada setiap permintaan.
- **Alat yang sama di mana-mana.** Alat merender di laptop, di tugas CI, atau di server dari input yang sama, dan orang dapat menyunting alat yang sama di aplikasi.
- **Catatan yang Anda pegang.** [Render receipts](/info/work-renders.html#evidence-and-identity), jejak audit, dan Content Credentials di tempat Anda mengonfigurasi identitas penandatanganan.
- **Sumber terbuka dan tanpa meteran.** Anda menjalankan kodenya, dan yang Anda bayar adalah infrastruktur Anda sendiri.

Anda mengambil alih pekerjaan yang dilakukan layanan-layanan itu untuk Anda. Server yang tahan lama memerlukan database persisten dan penyimpanan keluaran, dan alat yang memerlukan browser memerlukan worker Chromium. [Install Lolly Work](/info/work-install.html) menjelaskan keduanya.

## Bagaimana pekerjaan dipadankan

| Pekerjaan | API rendering yang dihosting | Lolly |
|---|---|---|
| Mengisi templat dari data | Permintaan API yang menyebut templat dan layer-nya | [URL](/info/url-mode.html), [CLI](/info/cli.html) atau [API server](/info/work-automation-api.html) yang menyebut alat dan inputnya |
| Banyak file dari tabel | Batch dan koleksi | [Batch](/info/batch.html) di perangkat Anda, atau [batch render](/info/work-renders.html#batches-with-durable-rows) di server |
| Menunggu atau polling hasil | Polling, atau opsi sinkron | Render tahan lama yang Anda polling, atau render langsung |
| Memanggil webhook saat selesai | Ya | [Callback bertanda tangan](/info/work-renders.html) ke origin yang Anda izinkan |
| URL gambar dinamis | Ya | [Tautan bagikan dan URL `/render`](/info/url-mode.html) |
| Menyunting templat | Editor yang dihosting | [Design](/info/using.html), di perangkat Anda |
| Agen | Keduanya menyediakan server MCP | [MCP](/info/mcp.html), dengan endpoint organisasi di bawah kebijakan token pada Lolly Work |

Jenis keluaran Lolly sendiri tercantum di [Exporting](/info/exporting.html). Di server Work saat ini, render tahan lama menghasilkan SVG, PNG, JPG, dan PDF, dan [video tetap di perangkat, CLI, dan MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

## Yang terbawa, dan yang tidak

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Permintaan Anda | API migrasi Work menerima bentuk yang sama | Sama | Sama |
| Templat Anda | **Impor** sebagai dokumen yang dapat disunting, kecuali jenis layer tanpa skema yang terkonfirmasi | Hanya nama kolom dan pratinjau. Bangun ulang satu per satu | Hanya nama kolom dan pratinjau. Bangun ulang satu per satu |
| URL dinamis yang ada | Tidak didukung | Tidak didukung | URL bertanda tangan tetap berfungsi setelah pergantian host, dengan token privat lama Anda |
| Webhook | Webhook yang terdaftar tidak didukung | `webhook_url` berfungsi | `webhook_success` berfungsi |
| Keluaran WebP dan AVIF | Ditolak menurut nama | Tidak ditawarkan | WebP ditolak menurut nama |
| Animasi, video, koleksi, tangkapan layar | Tidak ada di API migrasi | Tidak ada di API migrasi | Tidak ada di API migrasi |

Semua ini dibangun dari dokumentasi publik setiap vendor dan belum dijalankan terhadap akun langsung. [Panduan pindah](/info/work-move-from-render-api.html#check-it-on-your-own-account) punya daftar periksa singkat bila Anda memegang akun.

Berpindah bukan soal semua atau tidak sama sekali. Anda dapat memindahkan satu templat dan membiarkan sisanya di tempatnya, dan [meninggalkan Lolly](/info/work-move-from-render-api.html#leave-lolly-too) tetap terbuka sama lebarnya: alat adalah file biasa dan CLI merendernya tanpa server.

## Siapa yang menjalankan layanan

Dengan Lolly, individu merender secara lokal, atau tim menjalankan Lolly Work di infrastrukturnya sendiri. Mengajukan pekerjaan server mengirim input dan aset yang diperlukan ke instans itu, yang berbeda dari jalur di perangkat.

Bannerbear dan Placid adalah merek dagang pemiliknya. Halaman ini menjelaskan di mana produk-produk itu tumpang tindih, dari dokumentasi publik mereka, dan tidak berafiliasi dengan keduanya.
