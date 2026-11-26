# Gunakan Lolly di organisasi Anda

Organisasi Anda dapat menjalankan Lolly sendiri: aplikasi yang sama, dengan alat dan design system pilihannya. Pelajari cara mengaksesnya, masuk dan apa yang berubah.

Untuk merencanakan penyiapan organisasi, [Gunakan Lolly dengan DAM yang sudah Anda miliki](/info/use-with-dam.html) menjelaskan bagaimana pustaka yang telah disetujui dapat tetap digunakan sementara orang membuat konten di Lolly. [Kedaulatan konten](/info/content-sovereignty.html) menjelaskan kendali yang lebih luas atas pembuatan, tata kelola, penyimpanan dan portabilitas.

::: note Yang Anda perlukan dari organisasi
Alamat web Lolly milik organisasi, atau file penyiapan `.lolly` yang dibuat organisasi Anda. lolly.tools sendiri tidak terhubung ke organisasi.
:::

<!--i:eti-globe-->
## Di browser

Buka alamat yang diberikan organisasi Anda. Jika halaman meminta Anda masuk, tekan **Sign in** dan ikuti halaman masuk yang terbuka. Setelah itu, Lolly berfungsi seperti biasa, dengan alat dan design system organisasi Anda.

Anda juga dapat memulai dari lolly.tools: buka tampilan **Settings**, lalu pada kartu **Lolly instance** tekan **Open a workspace**, masukkan alamat dan tekan **Open this instance**. Browser beralih ke alamat organisasi Anda sendiri, karena browser tidak dapat memuat alat dari Lolly lain melalui lolly.tools.

![Kartu Lolly instance di Settings, tempat Anda membuka ruang kerja organisasi atau mengubah sumber alat aplikasi](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

<!--i:eti-monitor-->
## Di aplikasi desktop atau seluler

Aplikasi dimulai dengan alat bawaannya. Untuk menghubungkan, buka tampilan **Settings** dan tekan **Change** pada kartu **Lolly instance**. Panel menanyakan **Where should Lolly get its tools?**

1. Pilih **Connect to a Lolly instance**.
2. Masukkan alamat web organisasi Anda dan tekan **Check & connect**.
3. Tekan **Use this instance**. Layar berikutnya, **Import your data (optional)**, memindahkan pekerjaan tersimpan dari cadangan Lolly. Tekan **Skip** jika Anda tidak memilikinya.
4. Masuk jika aplikasi meminta.

Alat dari instans yang terhubung berjalan dengan tingkat kepercayaan yang sama seperti alat bawaan aplikasi, jadi hubungkan hanya ke instans yang Anda percayai. Organisasi Anda juga dapat mengirim file penyiapan `.lolly` yang menghubungkan aplikasi untuk Anda.

Untuk beralih nanti, gunakan **Change** lagi, atau **Leave** pada kartu yang sama.

### Masuk dengan kode

Di aplikasi desktop dan seluler, layar masuk juga menawarkan kode singkat bila Lolly organisasi Anda mendukung masuk dengan kode. Tekan **Open sign-in in browser**, masuk dan setujui kode di sana. Atau buka alamat yang ditampilkan layar di ponsel atau komputer tempat Anda sudah masuk, lalu masukkan kode. Kode berlaku sekitar sepuluh menit.

<!--i:eti-sliders-->
## Apa yang berbeda di sana

- **Beberapa kontrol diatur untuk Anda.** Kontrol yang diatur organisasi Anda menampilkan **Managed by** dan nama organisasi, atau **Managed by your organisation**. Kontrol yang sudah ditetapkan tidak dapat diubah, dan menu mungkin hanya menawarkan sebagian pilihannya. Beberapa kontrol disembunyikan. Konsol organisasi Anda mencatat aturan mana yang menetapkan kontrol dan alasannya. Tanyakan kepada pengelola Lolly organisasi Anda.
- **Beberapa design system dikunci.** Design system yang disediakan organisasi Anda menampilkan ikon gembok dan tetap hanya-baca. Untuk mencoba perubahan, buat salinan yang dapat disunting di **Settings → Preferences → Design systems**.
- **Hanya alatnya yang tercantum.** Alat yang tidak ditawarkan organisasi Anda tidak ditampilkan.
- **Proyek bersama.** Jika organisasi Anda berbagi proyek dengan Anda, **Projects** menampilkan kartu **Team projects**. Sesi ini berada di server organisasi. Buka sesi untuk mengerjakannya, atau mulai [kolaborasi kerja](/info/collaborate.html#collabs-through-lolly-work-optional) dari **Share** bila tersedia.
- **Beberapa ekspor mungkin memerlukan persetujuan.** Jika organisasi Anda meminta persetujuan, **Request approval** menggantikan **Download**, dan alat mungkin menawarkan lebih sedikit format.
- **Beranda Anda mungkin langsung menampilkan templat.** Jika organisasi Anda menerbitkan templat untuk Anda, misalnya untuk perusahaan mitra, beranda menampilkannya sebagai pengganti sapaan kunjungan pertama. Setiap templat berupa satu kartu, dengan **Your copy** untuk melanjutkan dan **New version** saat templat berubah. Lihat [Templat mitra](/info/work-partner-templates.html).

### Apa yang tersimpan di mana

::: cols
## Di perangkat ini

- Simpanan Anda sendiri, kecuali Anda mengaktifkan [Sync](/info/sync.html)
- Design system yang Anda buat sendiri
- Apa pun yang Anda buat dan unduh

## Di server organisasi Anda

- Identitas masuk dan informasi perangkat Anda
- Proyek bersama tim, sesi bersama dan suntingan langsung dalam kolaborasi kerja
- Aset yang Anda unggah ke pustaka bersama
- Permintaan persetujuan dan pengiriman yang disetujui
- Log masuk Anda dan apa yang Anda lakukan di sana
:::

Saat ruang kerja terhubung, baris privasi di layar pertama aplikasi menyatakan hal yang sama. Aplikasi milik Lolly sendiri tidak mengirim peristiwa penggunaan ke ruang kerja. [Privasi](/info/privacy.html#organisation-services-with-lolly-work) mencantumkan apa yang disimpan server dan siapa yang mengendalikan data tersebut.

<!--i:eti-building-->
## Yang ditambahkan Lolly Work

Server organisasi Anda menjalankan **Lolly Work**, perangkat lunak organisasi dari proyek open-source yang sama. Aplikasi tidak memerlukan akun kerja maupun Lolly Work saat Anda menggunakannya sendiri.

::: details Yang dapat ditambahkan Lolly Work
Organisasi Anda menghosting [Lolly Work](https://github.com/lolly-tools/lolly-work) bersama Lolly dan memilih fitur yang akan diaktifkan:

- **Masuk dan akses.** Single sign-on organisasi, izin berbasis grup dan field profil yang dikelola. Administrator dapat menyediakan dan menonaktifkan akun melalui SCIM.
- **Pekerjaan bersama.** Proyek bersama tim, sesi bersama dan [kolaborasi kerja](/info/collaborate.html#collabs-through-lolly-work-optional), dengan penyuntingan langsung melalui server organisasi.
- **Pustaka aset bersama.** Aset yang diunggah, koleksi dan pustaka terhubung, dengan aturan akses, versi dan peninjauan.
- **Peninjauan dan pengiriman.** Tahap persetujuan, tautan terkelola dengan masa berlaku atau pencabutan serta pengiriman ke tujuan yang diizinkan organisasi.
- **Administrasi.** Catatan audit tindakan yang diatur, serta pelaporan penggunaan sesuai kebijakan telemetri instans untuk klien yang mengirim peristiwa penggunaan. Aplikasi milik Lolly sendiri saat ini tidak mengirimnya.
:::

Untuk menyiapkan layanan, mulai dengan [Deployment](/info/deployment.html#organisation-services-with-lolly-work). Demo publik di [lolly.work](https://lolly.work) adalah sandbox. Gunakan alamat organisasi Anda sendiri untuk pekerjaan yang perlu disimpan.

<!--i:eti-palette-->
## Brand organisasi lain

Mitra, klien atau sponsor dapat mengirim brand mereka sebagai file design system (`.lolly`), bukan alamat. Membuka file itu tidak menghubungkan aplikasi ke apa pun. File menambahkan design system mereka di samping milik Anda pada perangkat ini. File penyiapan dari organisasi Anda sendiri menghubungkan aplikasi ke Lolly organisasi. Sebelum ada perubahan, pratinjau menunjukkan apa yang akan terjadi saat file dibuka. [Bekerja dengan mitra](/info/partners.html) membahas kedua sisi bekerja dengan brand organisasi lain.

<!--i:eti-unlink-->
## Keluar

**Leave**, pada kartu **Lolly instance** di **Settings**, menghapus design system, alat dan katalog organisasi Anda. Pekerjaan Anda sendiri tetap tersimpan. Apa pun yang Anda buat dengan alat organisasi tidak dapat dibuka lagi hingga Anda terhubung kembali. Jika Lolly organisasi Anda menyediakannya, **Sign out everywhere** pada kartu yang sama mengakhiri sesi Anda di setiap perangkat, termasuk perangkat ini.

Apa pun yang Anda simpan ke organisasi tetap berada di organisasi, sesuai kebijakan akses dan retensinya. Keluar atau mengosongkan perangkat ini tidak menghapus salinan di server. Di browser yang membuka alamat organisasi Anda sendiri, tidak ada koneksi yang perlu diakhiri: cukup buka alamat lain.

<!--i:eti-help-->
## Kepada siapa harus bertanya

Apa yang sampai ke server organisasi, siapa yang dapat melihat proyek bersamanya dan pengaturan mana yang ditetapkan adalah keputusan organisasi Anda. Tanyakan kepada pengelola Lolly organisasi Anda. [Privasi](/info/privacy.html) membahas apa yang dilakukan Lolly sendiri terhadap data Anda.
