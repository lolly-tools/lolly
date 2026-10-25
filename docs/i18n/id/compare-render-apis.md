# Lolly dan API perenderan

_Terakhir diperiksa: 28 September 2026._

Jika Anda membuat gambar dari templat melalui API hari ini, halaman ini menyatakan bagaimana Lolly mengerjakan pekerjaan yang sama di perangkat Anda sendiri, di CI, atau di server Anda sendiri.

## Apa yang dilakukan API rendering hosted lebih baik

[Bannerbear](https://www.bannerbear.com/) dan [Placid](https://placid.app/) mengemas rendering sebagai layanan terkelola, dengan infrastruktur, integrasi, dan dukungan sendiri. Anda mengirim permintaan dan orang lain yang menjalankan servernya.

## Di mana keduanya beririsan

Keduanya mengubah templat ditambah input menjadi media. Lolly mengambil input dari [tautan](/info/url-mode.html), [CLI](/info/cli.html), grid batch, atau endpoint server.

## Bagaimana Lolly mengerjakan pekerjaan yang tumpang tindih

Alat yang sama merender di laptop, di pekerjaan CI, atau di server, dari input yang sama. Rendering lokal dan CI tidak memerlukan layanan sama sekali.

![Pengaturan ekspor batch: nama file, format default, satuan, DPI, dan jumlah baris yang dirender](/info/shots/use-batch-toolbar.svg)

Di server, [Lolly Work](/info/compare.html#what-runs-where) menjalankan engine Lolly di balik API dan menerapkan visibilitas alat dan kebijakan input. [Layanan render yang dapat dipulihkan](/info/work-renders.html) mendukung pekerjaan tunggal dan batch, pengiriman idempoten, status, percobaan ulang terbatas, pembatalan, dan keluaran yang dipertahankan, dan pekerjaan yang terputus dilanjutkan setelah restart bila penyimpanan persisten dikonfigurasi.

Server memiliki jalur SVG dan PNG yang cepat dan worker Chromium opsional untuk alat yang memerlukan browser. Otomatisasi login dengan token layanan, keluaran jadi dapat melalui [pengiriman yang disetujui](/info/work-delivery.html) ke tujuan organisasi, dan identitas penandatanganan yang dikonfigurasi menambahkan Content Credentials pada keluaran yang didukung.

## Siapa yang menjalankan layanan

Dengan Lolly, individu merender secara lokal, atau tim menjalankan Lolly Work di infrastrukturnya sendiri. Mengajukan pekerjaan server mengirim input dan aset yang diperlukan ke instans itu, yang berbeda dari jalur di perangkat. Layanan yang tahan lama memerlukan database persisten dan penyimpanan keluaran, dan alat yang bergantung pada browser memerlukan worker Chromium; [Install Lolly Work](/info/work-install.html) menjelaskan keduanya.

Bannerbear dan Placid adalah merek dagang pemiliknya. Halaman ini menjelaskan di mana produk-produk itu tumpang tindih dan tidak berafiliasi dengan keduanya.
