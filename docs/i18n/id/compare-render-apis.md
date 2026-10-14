# Lolly dan API perenderan

_Terakhir diperiksa: 28 September 2026._

Lolly menghasilkan aset dari templat dan data di perangkat Anda, di CI, atau melalui API server [lolly.work](https://lolly.work). Solusi gabungan ini mencakup perenderan otomatis serta identitas, kebijakan, dan pengiriman di sekitar tugas produksi organisasi.

## Di mana keduanya beririsan

[Bannerbear](https://www.bannerbear.com/) dan [Placid](https://placid.app/) menghasilkan gambar dan media lain dari templat melalui API dan integrasi. Lolly memakai pendekatan yang sama, yaitu templat ditambah input, dengan [mode URL](/info/url-mode.html), [CLI](/info/cli.html), kisi batch, dan endpoint server sebagai cara mengirim pekerjaan.

## Yang disediakan lolly.work

lolly.work adalah layanan organisasi yang diterapkan secara terpisah dalam proyek Lolly. Layanan ini menjalankan mesin Lolly di balik API, menerapkan visibilitas alat dan kebijakan input, serta menyajikan berkas hasil render dan tautan berbagi bertanda tangan. [Layanan render yang dapat dipulihkan](https://github.com/lolly-tools/lolly-work/blob/main/docs/renders.md) mendukung tugas individual dan batch, pengiriman idempoten, status, percobaan ulang terbatas, pembatalan, dan keluaran yang dipertahankan. Pekerjaan yang terputus dapat dilanjutkan setelah server dimulai ulang bila penyimpanan persisten dikonfigurasi.

Server memakai jalur render SVG/PNG yang cepat dan worker Chromium opsional untuk alat yang membutuhkan peramban. Otomatisasi diautentikasi dengan token layanan, dan keluaran yang selesai dapat dikirim melalui [pengiriman terkelola](https://github.com/lolly-tools/lolly-work/blob/main/docs/delivery.md) ke tujuan organisasi. Identitas penandatanganan yang dikonfigurasi mengaktifkan penandatanganan C2PA pada keluaran server yang didukung.

## Siapa yang menjalankan layanan

Bannerbear dan Placid mengemas perenderan sebagai layanan terkelola dengan infrastruktur dan integrasi mereka sendiri. Dengan Lolly, individu dapat merender secara lokal atau tim dapat mengoperasikan lolly.work pada infrastrukturnya sendiri. Kedua repositori Lolly berlisensi sumber terbuka MPL-2.0; hosting mandiri tidak memiliki biaya lisensi perangkat lunak per render, sedangkan komputasi, penyimpanan, dan operasi tetap menjadi biaya yang perlu direncanakan.

Situs publik lolly.work adalah sandbox evaluasi, bukan komitmen hosting produksi. Layanan yang tahan lama membutuhkan basis data persisten dan penyimpanan keluaran; alat yang bergantung pada peramban membutuhkan worker Chromium. [Panduan instalasi](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md) dan [halaman status](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) menjelaskan persyaratan tersebut dan batasan saat ini.

Perenderan lokal dan CI tetap tersedia tanpa layanan organisasi. Mengirim tugas server akan mengirim input dan aset yang diperlukan ke instans tersebut; ini berbeda dari jalur di perangkat. Lihat [ringkasan solusi gabungan](/info/compare.html).

Bannerbear dan Placid adalah merek dagang pemiliknya. Halaman ini menjelaskan di mana solusi-solusi tersebut beririsan dan tidak berafiliasi dengan salah satunya.
