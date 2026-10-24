# Profil

Atur nama, detail kontak, dan foto profil Anda sekali, dan setiap alat yang dibuat untuk memakainya mengisinya untuk Anda: tanda tangan email, tanda pengenal, kartu pembicara. Catatan kecil itu adalah **profil** Anda, dan berada di perangkat Anda.

Profil Anda juga menyimpan apa yang Anda kumpulkan saat bekerja: sesi tersimpan, gambar yang diunggah, dan hitungan aktivitas lokal Anda. Anda mengelolanya di **Settings → Preferences**; alat hanya membaca field yang dibuat untuk diisi otomatis. Penggunaan mandiri tidak memerlukan akun, dan Sync opsional, berbagi, serta layanan organisasi masing-masing memiliki aliran datanya sendiri, dijelaskan di bawah.

## Apa yang ada dalam profil

| Bagian | Apa itu |
|---|---|
| **Name** | Nama depan dan belakang. |
| **Contact** | Email dan telepon. |
| **Location** | Kota dan negara. |
| **Headshot** | Foto opsional, dipotong persegi dan disimpan sebagai gambar lokal, untuk alat seperti tanda tangan email, kartu kutipan, dan bagan organisasi. |
| **Use my details to create** | Satu sakelar ikut serta (berbunyi **Using my details** setelah dinyalakan). Ia menentukan apakah detail Anda ikut sebagai kredit pembuat dalam file ekspor dan pada proses Batch. Ia tidak memengaruhi pengisian otomatis; lihat [How tools use your profile](#how-tools-use-your-profile). |
| **Preferences** | Tema, pengaturan aksesibilitas Anda, dan bagian aplikasi yang Anda aktifkan di **Feature flags**. |
| **Your work** | Sesi tersimpan beserta thumbnail-nya, diatur di [Projects](/info/find-your-work.html), gambar yang Anda unggah, dan statistik aktivitas lokal Anda. |

Tidak ada yang wajib. Profil kosong berfungsi; isi hanya apa yang menghemat ketikan Anda.

![Settings pada tab Preferences: rel pengaturan, dan Your details dengan sakelar Use my details to create serta field nama, kontak, dan lokasi](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Settings](/info/dashboard.html) memetakan semua hal lain di bawah Preferences, dari tampilan dan emoji hingga penyimpanan dan unduhan offline.

## Anda, tim, atau peran

Kata "profil" menyiratkan satu orang yang tetap. Di Lolly ia lebih mirip konteks pembuatan: siapa Anda saat membuat hal ini. Ia dapat berbentuk tiga, dan Lolly menangani masing-masing dengan cara yang sama.

::: cols
## Sebagai diri sendiri

Default. Nama, email, dan foto profil Anda. Atur sekali dan tanda tangan, tanda pengenal, dan lockup konferensi Anda terisi sendiri.

## Sebagai tim

Nama bersama sebuah tim, kotak masuk grup seperti `events@…`, departemen, dan lambang tim. Satu orang menyiapkan dan mengekspornya, dan semua orang lain memuat profil yang sama, sehingga file tim membawa detail yang konsisten. Kios bersama atau laptop demo dapat menjalankan satu profil tim.

## Sebagai peran

Manajer acara tiga hari dalam setahun menginginkan kotak masuk acara dan sub-brand acara pada tanda pengenal dan papan petunjuk, lalu kembali ke identitas biasanya. Simpan peran itu sebagai file profil tersimpan, muat untuk acara, dan simpan kembali sesudahnya.
:::

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Profil di organisasi yang memakai Lolly Work
Saat Anda login ke [Lolly organisasi](/info/organisation.html), Lolly Work dapat menyediakan field profil terverifikasi dari penyedia identitasnya dan menetapkan field atau preferensi di bawah kebijakan organisasi. Field terkelola diberi label di aplikasi.

Login itu juga mengendalikan akses ke proyek dan aset bersama. File profil tim tetap file lokal: ia tidak memberi keanggotaan organisasi atau menggantikan akun kerja. **Use my details to create** mengendalikan kredit dalam ekspor Anda, bukan catatan login atau audit organisasi. Lihat [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
:::

## Simpan beberapa, pakai satu

Satu instalasi memiliki satu profil aktif pada satu waktu, dan tidak ada pengalih di aplikasi. Sebagai gantinya, setiap profil adalah file portabel, file cadangan yang sama yang Anda pakai untuk pindah ke perangkat baru. Untuk masuk ke konteks lain:

::: timeline
- <!--i:download--> **Export my data** di bawah **Settings → Storage → Move to another device** menyimpan profil saat ini sebagai satu `.zip`.
- <!--i:trash--> **Clear all my data** mengosongkan instalasi ini.
- <!--i:upload--> **Import data…** memuat file profil untuk konteks yang akan Anda masuki.
:::

Mengimpor tanpa membersihkan lebih dulu akan **menggabungkan**. Sesi dan gambar yang diimpor ditambahkan; bila kedua salinan ada, yang disimpan lebih baru dipertahankan. Folder, favorit, dan templat ditambahkan di samping milik Anda, dan detail Anda sendiri tetap, kecuali field kosong, yang mengambil nilai dari file. Itu cocok untuk memasukkan sesi satu tim ke pengaturan Anda, tetapi bukan untuk pemisahan bersih antar peran.

Untuk dua konteks sekaligus, gunakan profil browser terpisah, akun pengguna terpisah, atau salinan kedua aplikasi web yang terpasang: masing-masing membawa profil Lolly independennya sendiri.

![Dua tombol yang memindahkan seluruh instalasi: Export my data menulis satu zip, Import data membacanya kembali](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> Simpan satu file per konteks dan namai masing-masing sesuai isinya, seperti `LollyTools-events-2026.zip` dan `LollyTools-me.zip`. File itulah profilnya.

[Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device) membahas apa yang dimuat file, apa yang tertinggal, dan cara lain untuk memindahkan, termasuk Sync.

## Cara tool menggunakan profil Anda

**Pengisian otomatis.** Pembuat alat menandai input agar diambil dari profil Anda (`bindToProfile: "firstname"`, `"email"`, `"headshot"`, dan seterusnya). Saat alat dibuka, input itu terisi dari profil Anda, dan Anda dapat menimpanya untuk satu sesi tanpa mengubah profil, kecuali kebijakan organisasi mengunci input itu. Pengisian otomatis adalah kemudahan lokal dan terjadi baik **Use my details** aktif maupun tidak.

**Kredit.** Saat mengekspor, detail Anda dapat ikut sebagai kredit pembuat di metadata file (PNG, PDF, SVG, dan lainnya), sehingga file jadi dapat menyatakan siapa yang membuat karya. **Use my details to create** mengatur ini, dan pembuat pada proses Batch. Bila mati, ekspor tetap menyatakan dibuat dengan Lolly, dan tidak membawa baris pembuat atau kontak pribadi.

Pembuat alat: lihat [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) dan [`host.profile`](/info/host-api.html#host-profile).

![Satu sakelar Use my details to create, bertanda ikut serta dan mati sampai Anda menyalakannya](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Profil, design system, dan capabilities

Tiga hal berdekatan di Settings dan mudah tertukar:

- <!--i:people--> **Profil** - Anda, tim Anda, atau peran yang sedang Anda jalani: nama, kontak, foto profil, dan pekerjaan tersimpan. Pribadi, disimpan di perangkat, dan portabel sebagai file.
- <!--i:palette--> **Design system** - brand: warna, font, dan pengaturan yang dipakai setiap alat untuk merender. Bersama dan konsisten, bukan pribadi; lihat [Design System Setup](/info/brand-studio.html).
- <!--i:sliders--> **Capabilities** - apa yang dapat dilakukan aplikasi: fitur dan alat yang tersedia bagi Anda.

Profil mengubah dari siapa sebuah file; design system mengubah tampilan file; capabilities adalah apa yang dapat Anda buat.

Kata ini memiliki tiga arti lain di Lolly. **Content profile** adalah pengaturan build yang memilih alat dan katalog apa yang dikirim sebuah deployment; [Glossary](/info/glossary.html) mendefinisikan istilahnya. Parameter tautan `profile` memilih profil warna untuk ekspor, seperti kondisi cetak CMYK; lihat [Reserved URL parameters](/info/url-parameters.html#print). **Verified identity** adalah sertifikat penandatanganan opsional yang mengikat email Anda ke ekspor bertanda tangan, terpisah dari detail ini, meskipun **Use my details to create** mengatur apakah salah satunya disematkan; lihat [Content Credentials](/info/content-credentials-identity.html).

![The Verified identity card, phone-width: the certificate lifetime picker and the enrolment step beneath it - the identity profile, separate from your personal details](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Privasi

Profil pribadi Anda disimpan secara lokal. Detail Anda dapat ikut dalam salinan cadangan atau Sync, dalam konten yang Anda bagikan atau ekspor, dan selama pendaftaran Content Credentials opsional. Pada instans Lolly Work, login, pekerjaan bersama, kebijakan telemetri, dan catatan audit terpisah dari profil lokal ini. **Settings → Preferences → Clear all my data** membersihkan perangkat ini; ia tidak menghapus salinan yang dipegang penyedia penyimpanan atau organisasi Anda. Lihat [Privacy Policy](/info/privacy.html).
