# Lolly dan API pemaparan

_Disemak kali terakhir: 28 September 2026._

Jika anda menjana imej daripada templat melalui API hari ini, halaman ini menyatakan bagaimana Lolly melakukan tugas yang sama pada peranti anda sendiri, dalam CI atau pada pelayan anda sendiri.

## Apa yang API perenderan terhos lakukan dengan lebih baik

[Bannerbear](https://www.bannerbear.com/) dan [Placid](https://placid.app/) membungkus perenderan sebagai perkhidmatan terurus, dengan infrastruktur, integrasi dan sokongan sendiri. Anda menghantar permintaan dan orang lain menjalankan pelayan.

## Di mana kedua-duanya bertindih

Kedua-duanya menukar templat ditambah input menjadi media. Lolly mengambil input daripada [pautan](/info/url-mode.html), [CLI](/info/cli.html), grid kelompok atau titik akhir pelayan.

## Bagaimana Lolly melakukan tugas yang bertindih

Alat yang sama merender pada komputer riba, dalam tugas CI atau pada pelayan, daripada input yang sama. Perenderan setempat dan CI tidak memerlukan perkhidmatan langsung.

![Tetapan eksport Batch: nama fail, format lalai, unit, DPI dan bilangan baris untuk dirender](/info/shots/use-batch-toolbar.svg)

Pada pelayan, [Lolly Work](/info/compare.html#what-runs-where) menjalankan enjin Lolly di sebalik API dan menggunakan keterlihatan alat dan dasar input. [Perkhidmatan render boleh dipulihkan](/info/work-renders.html)nya menyokong tugas tunggal dan kelompok, penyerahan idempoten, status, percubaan semula terhad, pembatalan dan output yang dikekalkan, dan kerja yang terganggu disambung semula selepas mula semula apabila storan berterusan dikonfigurasi.

Pelayan mempunyai laluan SVG dan PNG pantas dan pekerja Chromium pilihan untuk alat yang memerlukan pelayar. Automasi log masuk dengan token perkhidmatan, output siap boleh melalui [penghantaran diluluskan](/info/work-delivery.html) ke destinasi organisasi, dan identiti penandatanganan yang dikonfigurasi menambah Content Credentials pada output yang disokong.

## Siapa yang menjalankan perkhidmatan

Dengan Lolly, individu merender secara setempat, atau pasukan menjalankan Lolly Work pada infrastrukturnya sendiri. Menyerahkan tugas pelayan menghantar inputnya dan aset yang diperlukan kepada instans itu, yang berbeza daripada laluan pada peranti. Perkhidmatan tahan lama memerlukan pangkalan data berterusan dan storan output, dan alat bergantung pelayar memerlukan pekerja Chromium; [Install Lolly Work](/info/work-install.html) menerangkan kedua-duanya.

Bannerbear dan Placid ialah cap dagangan pemiliknya. Halaman ini menerangkan di mana produk bertindih dan tidak bergabung dengan mana-mana daripadanya.
