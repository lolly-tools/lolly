# Lolly dan API pemaparan

_Disemak kali terakhir: 28 September 2026._

Lolly menjana aset daripada templat dan data pada peranti anda, dalam CI atau melalui API pelayan [lolly.work](https://lolly.work). Penyelesaian gabungan ini merangkumi pemaparan automatik serta identiti, dasar dan penghantaran di sekeliling tugas pengeluaran organisasi.

## Di mana kedua-duanya bertindih

[Bannerbear](https://www.bannerbear.com/) dan [Placid](https://placid.app/) menjana imej dan media lain daripada templat melalui API dan integrasi. Lolly menggunakan pendekatan yang sama iaitu templat ditambah input, dengan [mod URL](/info/url-mode.html), [CLI](/info/cli.html), grid kelompok dan titik akhir pelayan sebagai cara menghantar kerja.

## Perkara yang disediakan oleh lolly.work

lolly.work ialah perkhidmatan organisasi yang digunakan secara berasingan dalam projek Lolly. Ia menjalankan enjin Lolly di sebalik API, menggunakan keterlihatan alat dan dasar input, serta menyajikan fail yang dipaparkan dan pautan perkongsian bertandatangan. [Perkhidmatan pemaparan boleh pulih](https://github.com/lolly-tools/lolly-work/blob/main/docs/renders.md)nya menyokong tugas individu dan kelompok, penyerahan idempoten, status, percubaan semula terhad, pembatalan dan output yang dikekalkan. Kerja yang terganggu boleh disambung semula selepas pelayan dimulakan semula apabila storan berterusan dikonfigurasikan.

Pelayan menggunakan laluan pemaparan SVG/PNG yang pantas dan pekerja Chromium pilihan untuk alat yang memerlukan pelayar. Automasi disahkan dengan token perkhidmatan, dan output yang siap boleh dihantar melalui [penghantaran bertadbir](https://github.com/lolly-tools/lolly-work/blob/main/docs/delivery.md) ke destinasi organisasi. Identiti penandatanganan yang dikonfigurasikan mengaktifkan penandatanganan C2PA pada output pelayan yang disokong.

## Siapa yang menjalankan perkhidmatan

Bannerbear dan Placid membungkus pemaparan sebagai perkhidmatan terurus dengan infrastruktur dan integrasi mereka sendiri. Dengan Lolly, individu boleh memaparkan secara setempat atau pasukan boleh mengendalikan lolly.work pada infrastrukturnya sendiri. Kedua-dua repositori Lolly ialah sumber terbuka MPL-2.0; hos kendiri tidak mempunyai caj lesen perisian setiap pemaparan, manakala pengiraan, storan dan operasi tetap menjadi kos yang perlu dirancang.

Tapak awam lolly.work ialah kotak pasir penilaian, bukan komitmen pengehosan pengeluaran. Perkhidmatan yang berkekalan memerlukan pangkalan data dan storan output yang berterusan; alat yang bergantung pada pelayar memerlukan pekerja Chromium. [Panduan pemasangan](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md) dan [halaman status](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) menerangkan keperluan itu dan had semasa.

Pemaparan setempat dan CI kekal tersedia tanpa perkhidmatan organisasi. Menghantar tugas pelayan akan menghantar input dan aset yang diperlukan ke instans itu; ini berbeza daripada laluan pada peranti. Lihat [gambaran keseluruhan penyelesaian gabungan](/info/compare.html).

Bannerbear dan Placid ialah tanda dagangan pemilik masing-masing. Halaman ini menerangkan di mana penyelesaian bertindih dan tidak berafiliasi dengan mana-mana daripadanya.
