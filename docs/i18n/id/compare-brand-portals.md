# Lolly dan portal merek

_Posisi diperbarui: 31 Oktober 2026. Contoh kemampuan vendor diperiksa: 28 September 2026._

Jika organisasi Anda menyimpan aset yang disetujuinya di Bynder, Frontify, Marq, atau Brandfolder, halaman ini membandingkannya dengan Lolly ditambah Lolly Work: bagaimana orang menemukan aset brand, dan bagaimana mereka membuat file baru darinya.

## Mempertahankan portal Anda yang ada

DAM yang ada dapat tetap menjadi sumber rujukan utama. Konektor katalog Lolly Work membuat bagian terpilih dari pustakanya tersedia di Lolly, tempat orang membuat file baru di bawah aturan organisasi. Batasan sumber yang didukung DAM dan aturan paparan Lolly Work mengatur akses; peninjauan keluaran akhir adalah keputusan terpisah.

[Use Lolly with your existing DAM](/info/use-with-dam.html) menjelaskan tanggung jawab dan batasnya. [SUSE's Brandfolder experience](/info/suse-brandfolder.html) mencatat integrasi yang berhasil dan mendukung manajemen perubahan administrator sebelum migrasi yang direncanakan. Tetap menghubungkan sumbernya adalah pilihan yang didukung.

Tujuan Lolly adalah [content sovereignty](/info/content-sovereignty.html), termasuk kendali atas produksi dan kebebasan memilih sistem. Pustaka dan persetujuannya sendiri mendukung organisasi yang memilih menjalankan kemampuan itu sendiri. [Lolly for DAM vendors and implementation partners](/info/dam-partners.html) menjelaskan bagaimana alur kerja terhubung dapat menambah nilai pada sistem rujukan yang ada.

## Apa yang dilakukan portal mapan lebih baik

Portal mapan menawarkan hosting terkelola, dukungan, dan alur kerja manajemen aset yang luas. Misalnya, [DAM enterprise Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) menggabungkan penemuan aset, kontrol akses, alur kerja persetujuan, dan distribusi. Tumpukan Lolly lebih muda dan rantai persetujuannya berurutan, bukan alur kerja bercabang sembarang. [Lolly Work status and roadmap](/info/work-status.html) mencatat batas deployment-nya.

## Di mana keduanya beririsan

Keduanya mencakup aset yang disetujui, templat terkunci, kontrol akses, tinjauan, dan distribusi. Lolly membuat file: templat, token desain, dan input yang diizinkan menentukan apa yang boleh diubah seseorang, dan rendering dapat tetap di perangkat mereka. Lolly Work menambahkan identitas, penyimpanan bersama, kebijakan, persetujuan, dan pelaporan pada infrastruktur yang dikendalikan organisasi.

![Design system aktif di Settings, ditampilkan sebagai sampul dan halaman: warna, huruf, dan logo yang digambar setiap alat](/info/shots/dashboard-brand.svg)

## Apa yang disediakan Lolly dan Lolly Work

| Kebutuhan | Lolly + Lolly Work |
|---|---|
| Login dan penyediaan akun | Single sign-on OIDC, beberapa penyedia identitas, penyediaan pengguna SCIM 2.0 dan keanggotaan grup, dan penonaktifan akun yang mencabut sesi yang ada. Penyedia identitas yang hanya SAML dapat terhubung melalui jembatan OIDC seperti Keycloak. |
| Templat yang disetujui | Lolly mendefinisikan input templat yang dapat disunting; Lolly Work menerapkan visibilitas grup dan kebijakan input yang mengunci nilai, membatasi pilihan, atau menyembunyikan kontrol. |
| Pustaka aset bersama | Unggahan milik instans, koleksi, metadata kustom, dan katalog dengan kontrol akses, ditambah konektor yang membaca pustaka DAM dan penyimpanan yang ada. |
| Tinjauan | Langkah persetujuan berurutan, grup penyetuju yang memenuhi syarat, aturan kuorum, dan pemisahan tugas; tinjauan dapat mengatur pengajuan katalog dan pengiriman ke target organisasi. |
| Riwayat dan ketersediaan aset | Versi dan rollback untuk aset milik instans, retensi dan penahanan, ketersediaan terjadwal, kedaluwarsa, dan pencabutan. Penyedia terhubung menyimpan riwayat sumbernya sendiri. |
| Lisensi dan kredit | Lolly mencatat lisensi setiap sumber yang dipakai file dan menyiapkan kredit yang terutang; [Creative rights and credits](/info/creative-rights.html) menjelaskan apa yang dicatat dan di mana kredit ditulis. Ia tidak menyelesaikan hak. |
| Pelaporan | Hitungan pemakaian dan unduhan aset, aktivitas alat dan ekspor, dasbor, dan jejak audit. Atribusi penggunaan mengikuti kebijakan telemetri deployment; pengaturan atribusi default memerlukan persetujuan. |
| Distribusi | Tautan yang kedaluwarsa dan dapat dicabut, koleksi bersama, akses tamu, dan pengiriman ke tujuan organisasi yang dikonfigurasi. |
| Brand page publik | Lolly menulis [brand page](/info/brand-page.html) statis, dari Lolly Design System Setup atau baris perintah: logo, warna, jenis huruf, aturan, dan contoh untuk manusia, dengan token, `DESIGN.md`, dan skill untuk agen. Anda menghosting foldernya, atau administrator mengaktifkan [hosting brand page](/info/work-design-system-administration.html#host-a-brand-page) di Lolly Work, yang nonaktif secara default. |

[Catalog and content](/info/work-catalog.html), [Approvals](/info/work-approvals.html), dan [Policy and governance](/info/work-governance.html) menjelaskan fitur-fitur ini dan konfigurasinya.

## Menilai alur kerja gabungan

Gunakan [urutan produksi kartu acara](/info/dam-production.html) untuk menguji akses sumber, penyuntingan yang diizinkan, peninjauan keluaran, dan pengiriman dengan pustaka Anda sendiri. [What runs where](/info/compare.html#what-runs-where) mencantumkan batas yang dibagi setiap perbandingan. Koneksi sumber tidak dengan sendirinya menetapkan kemitraan vendor atau kualifikasi untuk setiap tenant.

Lihat [How Lolly compares](/info/positioning.html) untuk perbandingan kapabilitas. Nama vendor mengidentifikasi produk yang dibandingkan; Lolly tidak berafiliasi dengan mereka.
