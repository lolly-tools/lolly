# Lolly dan portal merek

_Terakhir diperiksa: 28 September 2026._

Lolly dan [lolly.work](https://lolly.work) bersama-sama mencakup alur kerja pembuatan dan tata kelola yang dipakai tim pada portal merek: aset yang disetujui, templat terkunci, kontrol akses, peninjauan, dan distribusi. Bandingkan solusi gabungan itu dengan Bynder, Frontify, Marq, atau Brandfolder saat memilih cara orang menemukan aset merek dan membuat aset baru.

## Layanan pembuatan dan organisasi

Mesin dan aplikasi Lolly yang membuat berkasnya. Templat, token desain, dan input yang diizinkan menentukan apa yang boleh diubah seseorang, dan perenderan dapat tetap berada di perangkat mereka. Lolly mandiri tidak memerlukan akun.

lolly.work adalah layanan organisasi dalam proyek yang sama, dikelola di [repositori terpisah](https://github.com/lolly-tools/lolly-work) dan diterapkan berdampingan dengan Lolly. Layanan ini menambahkan identitas, penyimpanan bersama, kebijakan, persetujuan, dan pelaporan. Kedua bagian berlisensi sumber terbuka MPL-2.0. Pemisahan ini memungkinkan individu memakai Lolly secara mandiri dan organisasi menjalankan solusi gabungan pada infrastruktur yang dikendalikannya.

## Yang disediakan solusi gabungan

| Kebutuhan | Lolly + lolly.work |
|---|---|
| Masuk dan provisioning | Single sign-on OIDC, beberapa penyedia identitas, provisioning pengguna dan keanggotaan grup SCIM 2.0, serta penonaktifan akun yang mencabut sesi yang ada. Penyedia identitas khusus SAML dapat terhubung melalui jembatan OIDC seperti Keycloak. |
| Templat yang disetujui | Lolly menentukan input templat yang dapat diedit; lolly.work menerapkan visibilitas grup dan kebijakan input yang mengunci nilai, membatasi pilihan, atau menyembunyikan kontrol. |
| Pustaka aset bersama | Unggahan milik instans, koleksi, metadata kustom, dan katalog dengan kontrol akses, ditambah konektor yang membaca pustaka DAM dan penyimpanan yang sudah ada. |
| Peninjauan | Langkah persetujuan berurutan, grup pemberi persetujuan yang memenuhi syarat, aturan kuorum, dan pemisahan tugas; peninjauan dapat mengatur pengajuan katalog dan pengiriman ke target organisasi. |
| Riwayat dan ketersediaan aset | Versi dan rollback untuk aset milik instans, retensi dan penahanan, ketersediaan terjadwal, kedaluwarsa, dan pencabutan. Penyedia yang terhubung mempertahankan riwayat sumbernya sendiri. |
| Pelaporan | Jumlah penggunaan dan unduhan aset, aktivitas alat dan ekspor, dasbor, dan jejak audit. Atribusi penggunaan mengikuti kebijakan telemetri penerapan; pengaturan atribusi bawaan memerlukan persetujuan. |
| Distribusi | Tautan yang kedaluwarsa dan dapat dicabut, koleksi bersama, akses tamu, dan pengiriman ke tujuan organisasi yang dikonfigurasi. |

[Panduan operator lolly.work](https://github.com/lolly-tools/lolly-work/tree/main/docs) menjelaskan fitur-fitur ini beserta konfigurasinya. Semuanya adalah kemampuan yang tersedia, bukan fitur yang mengharuskan Anda membangun sistem lain di sekitar Lolly.

## Memilih alur kerja portal

Portal yang sudah mapan menawarkan hosting terkelola, dukungan, dan alur kerja DAM yang luas. Misalnya, [DAM enterprise Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) menggabungkan penemuan aset, kontrol akses, alur kerja persetujuan, dan distribusi. Bandingkan alur kerja peninjauan dan hak yang persis Anda butuhkan: Lolly menyediakan kontrol metadata, akses, dan ketersediaan, sedangkan izin hukum dan kewajiban lisensi tetap memerlukan proses organisasi. Rantai persetujuannya bersifat berurutan; rantai ini tidak memodelkan alur kerja bercabang secara sembarang.

Tumpukan Lolly lebih muda, dan [halaman status lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) mencatat batasan penerapannya. Khususnya, situs publik lolly.work adalah sandbox evaluasi. Penerapan organisasi yang tahan lama membutuhkan penyimpanan persisten dan seorang operator. Tidak ada biaya lisensi perangkat lunak per pengguna untuk hosting mandiri; infrastruktur dan administrasi tetap memerlukan biaya.

DAM yang sudah ada juga dapat tetap menjadi sumber kebenaran. Konektor katalog lolly.work membuat aset yang disetujuinya tersedia di Lolly, tempat orang membuat berkas baru di bawah aturan organisasi. Itu adalah pilihan integrasi; pustaka dan persetujuan Lolly sendiri tersedia saat organisasi ingin mengelola alur kerja tersebut sendiri.

Lihat [Perbandingan Lolly](/info/positioning.html) untuk perbandingan kemampuan dan [Lolly dibandingkan, alat demi alat](/info/compare.html) untuk bagian lain dari rangkaian ini. Nama vendor mengidentifikasi produk yang dibandingkan; Lolly tidak berafiliasi dengan mereka.
