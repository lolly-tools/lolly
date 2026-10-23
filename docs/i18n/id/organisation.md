# Gunakan Lolly di organisasi Anda

Organisasi Anda dapat menjalankan Lolly-nya sendiri: aplikasi yang sama, dengan alat dan design system yang dipilihnya. Halaman ini menunjukkan cara menjangkaunya, login, dan apa yang berubah setelahnya.

::: note Apa yang Anda perlukan dari organisasi Anda
Alamat web Lolly miliknya, atau sebuah berkas pengaturan `.lolly` yang dibuat organisasi Anda. lolly.tools dengan sendirinya tidak terhubung ke organisasi mana pun.
:::

## Di browser

Buka alamat yang diberikan organisasi Anda. Jika halaman meminta Anda login, tekan **Sign in** dan ikuti halaman login yang dibukanya. Setelah itu aplikasi bekerja seperti Lolly mana pun, dengan alat dan design system organisasi Anda.

Anda juga bisa mulai dari lolly.tools: buka **Settings**, dan pada kartu **Lolly instance** tekan **Open a workspace**, masukkan alamat, lalu tekan **Open this instance**. Browser menuju alamat organisasi Anda sendiri, karena browser tidak dapat memuat alat Lolly lain dari lolly.tools.

![Kartu Lolly instance di Settings, tempat Anda membuka ruang kerja organisasi atau mengubah dari mana aplikasi mendapatkan alatnya](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

## Di aplikasi desktop atau mobile

Aplikasi dimulai dengan alat bawaannya. Untuk menyambung, buka **Settings** dan tekan **Change** pada kartu **Lolly instance**. Lembar itu bertanya **Where should Lolly get its tools?**

1. Pilih **Sambungkan ke instans Lolly**.
2. Masukkan alamat web organisasi Anda dan tekan **Periksa dan sambungkan**.
3. Tekan **Gunakan instans ini**. Layar berikutnya, **Impor data Anda (opsional)**, membawa karya tersimpan dari sebuah cadangan (backup) Lolly; tekan **Lewati** jika Anda tidak memilikinya.
4. Masuk jika aplikasi memintanya.

Tool dari sebuah instans yang tersambung berjalan dengan tingkat kepercayaan yang sama seperti tool bawaan aplikasi, jadi sambungkan hanya ke instans yang Anda percayai. Organisasi Anda mungkin sebagai gantinya mengirimkan sebuah berkas pengaturan `.lolly` yang menyambungkan aplikasi untuk Anda.

Untuk beralih nanti, gunakan **Change** lagi, atau **Leave** pada kartu yang sama.

### Login dengan kode

Di aplikasi desktop dan seluler, layar login juga menawarkan kode singkat, bila Lolly organisasi Anda mendukung login dengan kode. Tekan **Open sign-in in browser**, login, dan setujui kode di sana. Atau buka alamat yang ditampilkannya di ponsel atau komputer tempat Anda sudah login, dan masukkan kodenya. Kode berlaku sekitar sepuluh menit.

## Apa yang berbeda di sana

- **Beberapa kontrol sudah diatur untuk Anda.** Kontrol yang diatur organisasi Anda menampilkan **Managed by** dan nama organisasi, atau **Managed by your organisation**. Kontrol yang dikunci tidak dapat diubah, menu mungkin hanya menawarkan sebagian pilihannya, dan baris yang diawali **Set by** dapat menyebut aturan mana yang berlaku dan alasannya. Beberapa kontrol tidak ditampilkan sama sekali.
- **Beberapa design system dikunci.** Design system yang disediakan organisasi Anda menampilkan kunci dan tetap hanya-baca. Untuk mencoba perubahan, buat salinan yang dapat disunting di **Settings → Preferences → Design systems**.
- **Hanya alat miliknya yang dicantumkan.** Alat yang tidak ditawarkan organisasi Anda tidak ditampilkan sama sekali.
- **Proyek bersama.** Jika organisasi Anda membagikan proyek kepada Anda, **Projects** menampilkan ubin **Team projects**. Sesi-sesi ini berada di server organisasi. Buka satu untuk mengerjakannya, atau mulai [work collab](/info/collaborate.html#work-collabs-with-lolly-work-optional) dari **Share** bila tersedia.
- **Beberapa ekspor mungkin memerlukan persetujuan.** Bila organisasi Anda meminta persetujuan, **Request approval** menggantikan **Download**, dan sebuah alat mungkin menawarkan lebih sedikit format.

### Apa yang tetap di mana

::: cols
## Di perangkat ini

- Simpanan Anda sendiri, kecuali Anda mengaktifkan [Sync](/info/sync.html)
- Design system yang Anda buat sendiri
- Apa pun yang Anda buat dan unduh

## Di server organisasi Anda

- Identitas login dan informasi perangkat Anda
- Proyek tim, sesi bersama, dan suntingan langsung dalam work collab
- Aset yang Anda unggah ke pustaka bersama
- Permintaan persetujuan dan pengiriman yang disetujui
- Peristiwa penggunaan, bila organisasi Anda mengaktifkannya
:::

[Privacy](/info/privacy.html#organisation-services-with-lolly-work) mencantumkan apa yang disimpan server dan siapa yang mengendalikan data itu.

## Apa yang ditambahkan Lolly Work

Server organisasi Anda menjalankan **Lolly Work**, perangkat lunak organisasi dari proyek sumber terbuka yang sama. Aplikasi tidak memerlukan akun kerja maupun Lolly Work saat Anda memakainya sendiri.

::: details Apa yang dapat ditambahkan Lolly Work
Organisasi Anda meng-host [Lolly Work](https://github.com/lolly-tools/lolly-work) bersama Lolly dan memilih fitur mana yang diaktifkan:

- **Login dan akses.** Single sign-on organisasi, izin berbasis grup, dan field profil terkelola. Administrator dapat menyediakan dan menonaktifkan akun melalui SCIM.
- **Pekerjaan bersama.** Proyek tim, sesi bersama, dan [work collab](/info/collaborate.html#work-collabs-with-lolly-work-optional), dengan penyuntingan langsung melalui server organisasi.
- **Pustaka aset bersama.** Aset yang diunggah, koleksi, dan pustaka terhubung, dengan aturan akses, versi, dan tinjauan.
- **Tinjauan dan pengiriman.** Langkah persetujuan, tautan terkelola dengan masa berlaku atau pencabutan, dan pengiriman ke tujuan yang diizinkan organisasi.
- **Administrasi.** Pelaporan penggunaan di bawah kebijakan telemetri instans, ditambah catatan audit untuk aksi yang diatur.

Jika Anda menyiapkan layanannya, mulai dengan [Deployment](/info/deployment.html#organisation-services-with-lolly-work). Demo publik di [lolly.work](https://lolly.work) adalah sandbox; gunakan alamat organisasi Anda sendiri untuk pekerjaan yang perlu Anda simpan.
:::

## Keluar

**Leave**, pada kartu **Lolly instance** di **Settings**, menghapus design system, alat, dan katalog organisasi Anda. Pekerjaan Anda sendiri tetap ada. Apa pun yang Anda buat dengan alat-alatnya tidak akan terbuka lagi sampai Anda menyambung kembali.

Apa pun yang Anda simpan ke organisasi tetap bersama organisasi, di bawah kebijakan akses dan retensinya. Meninggalkan atau membersihkan perangkat ini tidak menghapus salinan di server itu. Di browser pada alamat organisasi Anda sendiri tidak ada yang perlu ditinggalkan: buka alamat lain sebagai gantinya.

## Kepada siapa harus bertanya

Apa yang mencapai server organisasi Anda, siapa yang dapat melihat proyek bersamanya dan pengaturan mana yang bersifat tetap adalah keputusan organisasi Anda. Tanyakan kepada siapa pun yang menjalankan Lolly organisasi Anda. [Kebijakan Privasi](/info/privacy.html) membahas apa yang dilakukan Lolly sendiri terhadap data Anda.
