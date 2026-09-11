# Panduan Cepat

Lolly mengubah aturan Anda - warna, tipografi, tata letak, logika - menjadi alat yang bisa dipakai siapa saja untuk membuat berkas jadi: gambar, PDF, kartu media sosial, video, cukup dengan mengisi beberapa kolom. Hampir tidak ada yang perlu dipelajari dan tidak ada yang perlu diunggah: pembuatan dan ekspor berjalan di perangkat Anda, online maupun offline.

Inilah halaman yang perlu dibaca lebih dulu. Dua hal membuat Anda produktif: **jadikan Lolly milik Anda** dan **bawa masuk apa yang sudah Anda punya** (berkas desain dan token Anda). Selebihnya hanya berjarak satu tautan.

> Baru mengenal Lolly dan hanya ingin membuat sesuatu? [Buat sesuatu dalam 60 detik](/info/make-something.html) memandu Anda lewat tiga contoh, atau [buka aplikasinya](/#/), pilih alat mana pun dari galeri, isi kolom yang kosong lalu tekan **Export**. Kembalilah ke sini saat Anda ingin hasilnya mengenakan merek *Anda*.

![Tampilan Utilities - alat andalan di perangkat seperti Strip Hidden Data, Compress PDF dan Convert Image, semuanya di satu tempat](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 1. Jadikan milik Anda - konfigurasikan Design System Anda

Merek Anda di Lolly adalah sebuah dokumen **design-tokens** kecil - warna, font dan beberapa aturan - yang menjadi acuan render setiap alat. Atur sekali dan semua yang Anda buat sesuai merek sejak awal, bukan karena diperiksa belakangan. Ada tiga jalan masuk; pilih yang cocok dengan tempat merek Anda berada sekarang.

### Mulai dari nol (pembangun design system)

Saat pertama dijalankan Anda mendarat di **galeri**, dengan dialog sambutan singkat di atasnya yang menawarkan tiga jalan masuk - **Make it yours** (Brand Studio di `#/start`), **Bring your design** (jatuhkan berkas Figma, Penpot, InDesign atau PDF dan berkas itu terbuka sebagai tata letak yang bisa disunting - rute tercepat menuju [Bawa masuk apa yang sudah Anda punya](#2-bring-in-what-you-already-have) di bawah) dan **Explore the community tools** - plus sebaris pilihan bahasa jika bahasa Inggris bukan bahasa Anda. Ambil kartu pertama dan Anda tiba di [**Brand Studio**](/info/brand-studio.html). Beri sebuah nama dan satu warna utama, lalu Lolly *menurunkan* palet lengkap yang mudah diakses dari warna itu - permukaan terang/gelap, teks, aksen - memakai matematika warna yang sama seperti yang dipakai engine di mana pun.

![Ruang Colours di Brand Studio - satu warna utama, dan palet mudah diakses yang diturunkan Lolly darinya](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours) Pilih font, dan dalam kurang dari semenit Anda punya merek yang siap pakai. Dari sana enam ruang studio - Overview, Colours, Type, Logos, Tokens, Files - membiarkan Anda melangkah sejauh yang Anda mau, dalam urutan bebas, menyempurnakan bagian mana pun kapan saja Anda kembali. Tab **Design system** di dasbor (`#/d`) menampilkan hasilnya secara hanya-baca dan menunjuk kembali ke `#/start`, tempat penyuntingan sebenarnya terjadi (kecuali Anda memakai build Lolly yang mereknya terkunci, di mana merek sudah tetap dan tidak ada yang bisa diubah).

### Impor merek yang sudah Anda punya

Jika merek Anda sudah tercatat sebagai design tokens - dari **Penpot**, **Tokens Studio** (Figma) atau berkas **DTCG** biasa - bawa masuk seluruhnya alih-alih mengetiknya ulang. Dua rute:

- <!--i:palette--> **Di aplikasi:** [pembangun design system: Brand Studio](/info/brand-studio.html) (`#/start`) menerimanya lewat **Add from…** di bagian bawah rel ruangnya - sebuah berkas token, ekspor Penpot, sebuah SVG atau paket `LollyBrand`. Jatuhkan ke sana dan paletnya langsung menyala.
- <!--i:code--> **Dari baris perintah**, untuk menyiapkan paket merek yang bisa dipakai ulang:

```bash
# a monolithic tokens.json, a one-file-per-set directory, or a Penpot project archive
npm run ingest:brand -- ./my-tokens.json --name acme --label "Acme" --activate
```

`ingest:brand` menerima ketiga wadah yang dipakai Penpot / Tokens Studio untuk mengekspor dokumen yang sama - satu `tokens.json`, sebuah direktori (`$metadata.json` + berkas per set) atau arsip `project.penpot`. Dengan `--activate` ia mendaftarkan merek sebagai profil, beralih ke profil itu dan membangun ulang katalog. Lihat [Konfigurasi](/info/configuration.html) untuk memahami bagaimana paket merek dan profil saling terkait.

### Sesuaikan di aplikasi

Begitu sebuah merek aktif, teruskan membentuknya di [**Brand Studio**](/info/brand-studio.html) (`#/start`) - ubah sebuah warna atau sebuah peran dan setiap pratinjau di seluruh aplikasi ikut berubah sambil Anda mengetik. (Tab **Design system** di dasbor pada `#/d` hanya *menampilkan* merek secara hanya-baca; Studio adalah tempat Anda menyuntingnya.)

![Tab Design-system di Dasbor - merek aktif ditampilkan hanya-baca](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand) Merek yang sama dirangkum pada kartu **Profile → Your brand**. Fontnya nyata: pilih dari Google Fonts dan Lolly menyimpan berkasnya **di perangkat Anda** sebagai aset merek, sehingga tipografi Anda ikut offline dan tidak ada yang diambil saat render.

Kalau sudah pas, **ekspor merek sebagai paket `LollyBrand`** - satu berkas yang bisa diimpor rekan kerja untuk mendapatkan palet, font dan aturan yang persis sama. Begitulah sebuah merek berpindah antar orang dan mesin tanpa server di tengahnya.

> **Token merek berjalan dua arah.** Karena merek Lolly *adalah* token DTCG - format yang dibaca dan ditulis Penpot secara native dan yang dibawa Tokens Studio ke Figma - palet yang Anda pakai *untuk mendesain* dan palet yang *ditegakkan* Lolly adalah satu dokumen, bukan dua daftar yang Anda selaraskan manual. Lihat [Design Tokens](/info/design-tokens.html).

## 2. Bawa masuk apa yang sudah Anda punya

Anda tidak memulai dari halaman kosong. Lolly membuka karya desain dan format terbuka yang sudah Anda miliki.

### Berkas desain open source

Karya jadi di **Figma, Penpot, Illustrator, InDesign atau aplikasi SVG apa pun** tidak harus terkunci di aplikasi tempat Anda menggambarnya. Buka **Design**, klik **Import a design**, dan berkas itu terbuka sebagai *tata letak hidup* - bukan gambar yang sudah diratakan. Setiap lapisan menjadi kotak yang bisa disunting: teks tetap bisa diketik ulang, bentuk tetap bentuk, gambar masuk ke pustaka Anda dan karya vektor yang rumit dipertahankan dengan setia. Semuanya tiba sudah menyesuaikan huruf dan aturan warna merek Anda.

| Yang Anda punya | Bawa masuk sebagai |
|---|---|
| Sebuah frame Figma | `.fig` native (File → Save local copy), atau ekspor SVG |
| Sebuah desain Penpot | Ekspor `.penpot`-nya, atau SVG apa pun |
| Sebuah berkas Illustrator | `.ai` native (kompatibel PDF) atau `.pdf` - langsung terbuka |
| Sebuah tata letak InDesign | `.idml` (File → Export → InDesign Markup) |
| Selain itu | **SVG apa pun** - pintu masuk universal |

Seluruh proses impor berlangsung **di perangkat Anda** - berkasnya diurai di peramban Anda dan tidak ada yang diunggah. Rincian lengkap, dan apa saja persisnya yang ikut terbawa, ada di [Impor sebuah desain](/info/design-import.html).

Punya **dek PowerPoint**? Jatuhkan `.pptx` ke **Deck Builder** untuk menyuntingnya slide demi slide, sudah menempel pada merek Anda - atau jalankan **Rebrand a Deck** untuk mendapatkan dek yang sama kembali dengan tema baru, bagan dan animasi tetap utuh.

### Dari sekali pakai menjadi templat

Inilah hasilnya: tata letak hasil impor adalah sesi Design biasa, jadi begitu Anda **simpan**, ia hidup di sebuah URL. Siapa pun yang punya Lolly bisa membuka URL itu, mengganti kata-katanya, menukar gambar dan merender versinya sendiri - tanpa aplikasi desain, dan bagian yang dikunci tetap terkunci. Desain sekali pakai berubah menjadi alat yang bisa dipakai ulang. Itulah inti gagasannya, tercapai tanpa menulis satu baris konfigurasi pun.

### Data terbuka dan alat terbuka

[Kumpulan alat komunitas](/info/builders.html) bersifat open source dan tidak terikat merek - kode QR, peta jalan, filter, utilitas privasi - dan semuanya dirender mengikuti merek *Anda* begitu Anda mengaktifkannya.

Beri alat data terbuka Anda sendiri juga: tempel atau jatuhkan tabel **CSV** atau **JSON** dan kolom berulang sebuah alat akan terisi darinya, satu aset jadi untuk tiap baris.

## 3. Buat sesuatu, lalu bagikan atau otomatiskan

Dengan merek yang aktif dan materi Anda di tangan, setiap alat menghasilkan berkas jadi:

- <!--i:download--> **Render** alat mana pun ke **SVG, PDF, PNG, JPG, WebP, video** dan lainnya - dengan ukuran cetak sebenarnya dan satuan fisik saat Anda membutuhkannya. Lihat [Ekspor & format](/info/exporting.html).
- <!--i:link--> **Bagikan tautan.** Setiap keadaan alat adalah sebuah URL, jadi aset jadi bisa direproduksi dan dialamatkan lewat parameter - simpan tautannya, hasilkan ulang saat dibutuhkan.
- <!--i:layers--> **Kerjakan sekaligus banyak.** Jalankan sebuah templat dari lembar sebar di [batch grid](/info/exporting.html): satu aset jadi untuk tiap baris.
- <!--i:cpu--> **Otomatiskan.** Render yang sama berjalan dari [CLI](/info/cli.html) dan dari [agen AI](/info/ai-agents.html) - URL itulah API-nya.

"URL itulah API-nya" harus dibaca apa adanya. Bagan di bawah ini tidak digambar oleh siapa pun: jenisnya, judulnya dan seluruh tabel datanya diketik di bilah alamat, dan tautan yang sama merender bagan yang sama di perangkat mana pun.

![Sebuah area chart signup bulanan, yang tiap nilainya datang sebagai parameter query, bukan sebagai klik](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Ke mana selanjutnya

Tiga jalur, tergantung apa yang ingin Anda kerjakan di sini:

- <!--i:people--> **[Lolly untuk Kreator](/info/creators.html)** - Anda membuat sesuatu. Keunggulannya, dan cara memaksimalkan aplikasinya.
- <!--i:code--> **[Lolly untuk Pengembang](/info/builders.html)** - Anda menulis alat, mengintegrasikan dan menerapkannya. Dokumentasi teknisnya.
- <!--i:shieldcheck--> **[Lolly untuk Operator](/info/operators.html)** - Anda bertanggung jawab atas merek, keamanan dan penggelaran di seluruh organisasi.
