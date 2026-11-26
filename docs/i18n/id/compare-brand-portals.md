# Lolly dan portal merek

_Pemosisian diperbarui: 31 Oktober 2026. Contoh kemampuan vendor diperiksa: 28 September 2026._

Jika organisasi Anda menyimpan aset yang disetujui di Bynder, Frontify, Marq atau Brandfolder, halaman ini membandingkan portal tersebut dengan Lolly ditambah Lolly Work. Halaman ini membahas cara orang menemukan aset merek dan membuat file baru dari aset tersebut.

<!--i:eti-folder-shared-->
## Mempertahankan portal yang ada

DAM yang ada dapat tetap menjadi sumber acuan resmi. Konektor katalog Lolly Work menyediakan bagian tertentu dari pustakanya di Lolly, tempat orang membuat file baru sesuai aturan organisasi. Batasan sumber yang didukung DAM dan aturan penyediaan akses Lolly Work mengatur akses. Peninjauan keluaran akhir adalah keputusan terpisah.

[Gunakan Lolly dengan DAM yang ada](/info/use-with-dam.html) menjelaskan tanggung jawab dan batasannya. [Pengalaman SUSE dengan Brandfolder](/info/suse-brandfolder.html) mencatat keberhasilan integrasi yang mendukung pengelolaan perubahan oleh administrator sebelum migrasi yang direncanakan.

Tujuan Lolly adalah [kedaulatan konten](/info/content-sovereignty.html), termasuk kendali atas produksi dan kebebasan memilih sistem. Pustaka dan persetujuannya sendiri melayani organisasi yang memilih menjalankan kemampuan tersebut sendiri. [Lolly untuk vendor DAM dan mitra implementasi](/info/dam-partners.html) menjelaskan bagaimana alur kerja terhubung dapat menambah nilai pada sistem acuan resmi yang ada.

<!--i:eti-award-->
## Yang lebih baik dilakukan portal yang mapan

Portal yang mapan menawarkan hosting terkelola, dukungan dan alur kerja pengelolaan aset yang luas. [DAM perusahaan Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) menggabungkan penemuan aset, kontrol akses, alur persetujuan dan distribusi. Rangkaian teknologi Lolly lebih muda. Rantai persetujuannya berurutan dan tidak dapat bercabang secara bebas. [Status dan peta jalan Lolly Work](/info/work-status.html) mencatat batasan penerapannya.

<!--i:eti-blend-->
## Kesamaan kemampuannya

Keduanya mencakup aset yang disetujui, templat terkunci, kontrol akses, peninjauan dan distribusi. Lolly membuat file. Templat, token desain dan input yang diizinkan menentukan apa yang dapat diubah seseorang, dan render dapat tetap dilakukan di perangkatnya. Lolly Work menambahkan identitas, penyimpanan bersama, kebijakan, persetujuan dan pelaporan pada infrastruktur yang dikendalikan organisasi.

![Design system aktif di Settings, ditampilkan sebagai sampul dan halaman: warna, tipografi dan logo yang digunakan setiap alat untuk menggambar](/info/shots/dashboard-brand.svg)

<!--i:eti-lolly-->
## Yang disediakan Lolly dan Lolly Work

| Kebutuhan | Lolly + Lolly Work |
|---|---|
| Masuk dan penyediaan akun | Single sign-on OIDC, beberapa penyedia identitas, penyediaan pengguna dan keanggotaan grup SCIM 2.0 serta penonaktifan akun yang mencabut sesi yang ada. Penyedia identitas yang hanya mendukung SAML dapat terhubung melalui jembatan OIDC seperti Keycloak. |
| Templat yang disetujui | Lolly menentukan input templat yang dapat disunting; Lolly Work menerapkan visibilitas grup dan kebijakan input yang mengunci nilai, membatasi pilihan atau menyembunyikan kontrol. |
| Pustaka aset bersama | Unggahan milik instans, koleksi, metadata khusus dan katalog dengan kontrol akses, serta konektor yang membaca pustaka DAM dan penyimpanan yang ada. |
| Peninjauan | Langkah persetujuan berurutan, grup pemberi persetujuan yang memenuhi syarat, aturan kuorum dan pemisahan tugas; peninjauan dapat mengatur pengajuan katalog dan pengiriman ke target organisasi. |
| Riwayat dan ketersediaan aset | Versi dan pengembalian ke versi sebelumnya untuk aset milik instans, retensi dan penahanan, ketersediaan terjadwal, kedaluwarsa dan pencabutan. Penyedia terhubung mempertahankan riwayat sumbernya sendiri. |
| Lisensi dan kredit | Lolly mencatat lisensi setiap sumber yang digunakan file dan menyiapkan kredit yang wajib dicantumkan; [Hak dan kredit karya kreatif](/info/creative-rights.html) menjelaskan apa yang dicatat dan di mana kredit ditulis. Aplikasi ini tidak mengurus perizinan hak. |
| Pelaporan | Jumlah penggunaan dan unduhan aset, aktivitas alat dan ekspor, dasbor dan jejak audit. Atribusi penggunaan mengikuti kebijakan telemetri penerapan; pengaturan atribusi default memerlukan persetujuan. |
| Distribusi | Tautan yang dapat kedaluwarsa dan dicabut, koleksi bersama, akses tamu dan pengiriman ke tujuan organisasi yang dikonfigurasi. |
| Halaman merek publik | Lolly menulis [halaman merek](/info/brand-page.html) statis, dari Lolly Design System Setup atau baris perintah: logo, warna, tipografi, aturan dan contoh untuk manusia, beserta token, `DESIGN.md` dan skill untuk agen. Anda menghosting foldernya, atau administrator mengaktifkan [hosting halaman merek](/info/work-design-system-administration.html#host-a-brand-page) di Lolly Work, yang mati secara default. |

[Katalog dan konten](/info/work-catalog.html), [Persetujuan](/info/work-approvals.html) dan [Kebijakan dan tata kelola](/info/work-governance.html) menjelaskan fitur-fitur ini beserta konfigurasinya.

<!--i:eti-checklist-->
## Evaluasi alur kerja gabungan

Gunakan [urutan produksi kartu acara](/info/dam-production.html) untuk menguji akses sumber, suntingan yang diizinkan, peninjauan keluaran dan pengiriman dengan pustaka Anda sendiri. [Apa yang berjalan di mana](/info/compare.html#what-runs-where) mencantumkan batasan yang berlaku untuk setiap perbandingan. Koneksi sumber saja tidak membuktikan kemitraan vendor atau kelayakan untuk setiap tenant.

[Perbandingan Lolly](/info/positioning.html) memuat perbandingan kemampuan. Nama vendor mengidentifikasi produk yang dibandingkan. Lolly tidak berafiliasi dengan mereka.
