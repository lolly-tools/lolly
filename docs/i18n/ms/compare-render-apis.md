# Lolly dan API pemaparan

_Disemak kali terakhir: 5 November 2026._

Jika anda menjana imej daripada templat melalui API hari ini, halaman ini menyatakan apa yang berubah jika anda menjalankan pengeluaran itu sendiri: pada peranti anda sendiri, dalam CI atau pada pelayan yang anda kawal. [Move from a hosted render API](/info/work-move-from-render-api.html) ialah caranya.

## Apa yang API perenderan terhos lakukan dengan lebih baik

[Bannerbear](https://www.bannerbear.com/) dan [Placid](https://placid.app/) ialah perkhidmatan terurus, dan itu kelebihan sebenar. Anda menghantar permintaan dan orang lain menjalankan pelayan, memastikannya hidup dan mengendalikan beban.

- **Tiada apa-apa untuk dikendalikan.** Tiada pelayan, pangkalan data, storan, kemas kini atau perancangan kapasiti.
- **Penyunting templat terhos** dengan templat sedia untuk disesuaikan.
- **Lebih banyak jenis output daripada satu API.** Kedua-duanya menerbitkan titik akhir video dan PDF, dan Bannerbear turut mendokumenkan output beranimasi, WebP dan AVIF, tangkapan skrin dan pembuangan latar belakang AI.
- **Integrasi dan sokongan mereka sendiri.**

Jika itu susunan yang anda mahu, perkhidmatan tersebut ialah pilihan yang baik.

## Apa yang diberikan hos kendiri

- **Kandungan anda kekal pada sistem anda.** Input, aset dan output berada pada infrastruktur pilihan anda. Merender pada peranti atau dalam CI tidak memerlukan sebarang perkhidmatan.
- **Peraturan berada dalam alat.** Warna, tipografi, logo dan input terkunci datang daripada [sistem reka bentuk](/info/brand-studio.html) anda, jadi pemanggil hanya boleh mengubah apa yang anda benarkan. [Lolly Work](/info/compare.html#what-runs-where) menggunakan keterlihatan alat dan dasar input pada setiap permintaan.
- **Alat yang sama di mana-mana.** Alat dirender pada komputer riba, dalam tugas CI atau pada pelayan daripada input yang sama, dan orang boleh menyunting alat yang sama dalam apl.
- **Rekod yang anda pegang.** [Render receipts](/info/work-renders.html#evidence-and-identity), jejak audit, dan Content Credentials di mana anda mengkonfigurasi identiti penandatanganan.
- **Sumber terbuka dan tiada meter.** Anda menjalankan kod itu, dan apa yang anda bayar ialah infrastruktur anda sendiri.

Anda mengambil alih kerja yang dilakukan perkhidmatan itu untuk anda. Pelayan tahan lama memerlukan pangkalan data berterusan dan storan output, dan alat yang memerlukan pelayar memerlukan pekerja Chromium. [Install Lolly Work](/info/work-install.html) menerangkan kedua-duanya.

## Bagaimana tugas-tugas sepadan

| Tugas | API perenderan terhos | Lolly |
|---|---|---|
| Isi templat daripada data | Permintaan API yang menamakan templat dan lapisannya | [URL](/info/url-mode.html), [CLI](/info/cli.html) atau [API pelayan](/info/work-automation-api.html) yang menamakan alat dan inputnya |
| Banyak fail daripada jadual | Kelompok dan koleksi | [Batch](/info/batch.html) pada peranti anda, atau [kelompok render](/info/work-renders.html#batches-with-durable-rows) pada pelayan |
| Tunggu atau tinjau untuk hasil | Tinjauan, atau pilihan segerak | Render tahan lama yang anda tinjau, atau render serta-merta |
| Panggil webhook apabila selesai | Ya | [Panggilan balik bertandatangan](/info/work-renders.html) ke asal yang anda benarkan |
| URL imej dinamik | Ya | [Pautan kongsi dan URL `/render`](/info/url-mode.html) |
| Sunting templat | Penyunting terhos | [Design](/info/using.html), pada peranti anda |
| Ejen | Kedua-duanya menerbitkan pelayan MCP | [MCP](/info/mcp.html), dengan titik akhir organisasi di bawah dasar token pada Lolly Work |

Jenis output Lolly sendiri disenaraikan dalam [Exporting](/info/exporting.html). Pada pelayan Work hari ini, render tahan lama menghasilkan SVG, PNG, JPG dan PDF, dan [video kekal pada peranti, CLI dan MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

## Apa yang dibawa merentas, dan apa yang tidak

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Permintaan anda | API penghijrahan Work menerima bentuk yang sama | Sama | Sama |
| Templat anda | **Diimport** sebagai dokumen boleh sunting, kecuali jenis lapisan tanpa skema yang disahkan | Nama medan dan pratonton sahaja. Bina semula setiap satu | Nama medan dan pratonton sahaja. Bina semula setiap satu |
| URL dinamik sedia ada | Tidak disokong | Tidak disokong | URL bertandatangan terus berfungsi selepas pertukaran hos, dengan token peribadi lama anda |
| Webhook | Webhook berdaftar tidak disokong | `webhook_url` berfungsi | `webhook_success` berfungsi |
| Output WebP dan AVIF | Ditolak mengikut nama | Tidak ditawarkan | WebP ditolak mengikut nama |
| Animasi, video, koleksi, tangkapan skrin | Tiada pada API penghijrahan | Tiada pada API penghijrahan | Tiada pada API penghijrahan |

Semua ini dibina daripada dokumentasi awam setiap vendor dan belum dijalankan pada akaun langsung. [The move guide](/info/work-move-from-render-api.html#check-it-on-your-own-account) mempunyai senarai semak ringkas jika anda memegang satu.

Berpindah bukan semua atau tiada. Anda boleh memindahkan satu templat dan membiarkan yang lain di tempatnya, dan [meninggalkan Lolly](/info/work-move-from-render-api.html#leave-lolly-too) juga sama terbukanya: alat ialah fail biasa dan CLI merendernya tanpa pelayan.

## Siapa yang menjalankan perkhidmatan

Dengan Lolly, individu merender secara setempat, atau pasukan menjalankan Lolly Work pada infrastrukturnya sendiri. Menyerahkan tugas pelayan menghantar inputnya dan aset yang diperlukan kepada instans itu, yang berbeza daripada laluan pada peranti.

Bannerbear dan Placid ialah cap dagangan pemiliknya. Halaman ini menerangkan di mana produk bertindih, daripada dokumentasi awam mereka, dan tidak bergabung dengan mana-mana daripadanya.
