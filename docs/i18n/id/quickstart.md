# Mulai

Di akhir halaman ini, alat Anda akan mengenakan warna dan font Anda sendiri, dan pekerjaan yang sudah Anda miliki siap dipakai ulang. Anda tidak memerlukan akun, dan membuat serta mengekspor berjalan di perangkat Anda.

::: timeline
- <!--i:sparkle--> **Buat satu file.** [Buat file pertama Anda](/info/make-something.html) memandu Anda membuat kode QR dalam beberapa menit.
- <!--i:palette--> **Masukkan brand Anda.** Mulai dari satu warna, file token, atau desain jadi.
- <!--i:layers--> **Buat lebih banyak yang serupa.** Bagikan tautan, isi spreadsheet, atau jalankan alat dari skrip.
:::

Baru mengenal gagasannya? [What is Lolly?](/info/what-is-lolly.html) adalah pengantar lima menit, dan [How Lolly works](/info/how-lolly-works.html) menunjukkan siapa melakukan apa.

## Masukkan brand Anda

lolly.tools terbuka di **Lolly Demo**, design system contoh milik Lolly sendiri; [Meet Lolly Demo](/info/lolly-demo.html) menunjukkan apa yang Anda lihat. Design system Anda menggantikannya: sekumpulan kecil token desain, yaitu warna, font, dan beberapa aturan, yang dipakai setiap alat untuk menggambar. Atur sekali, dan semua yang Anda buat langsung sesuai brand.

Pilih jalur yang cocok dengan apa yang Anda miliki:

- <!--i:palette--> **Satu warna.** Buka **Design System Setup** (`#/start`), beri nama design system Anda dan pilih warna utama. Lolly menurunkan palet lengkap yang aksesibel darinya, dengan permukaan terang dan gelap, teks, dan aksen. Pilih font dan Anda sudah punya brand yang berfungsi.
- <!--i:upload--> **File token.** **Add from…**, di dasar rel ruangan di Design System Setup, menerima file token DTCG, Tokens Studio, atau Penpot, SVG, atau paket `LollyBrand`. Letakkan dan palet terisi. Selama design system masih kosong, **Start from a reference** di ruangan Overview membuka pemilih yang sama.
- <!--i:pentool--> **Desain jadi.** Di Design, pilih **Import a design** dan letakkan file `.fig`, `.penpot`, `.ai`, `.idml`, atau SVG. Lihat [Bawa masuk yang sudah Anda miliki](#bring-in-what-you-already-have) di bawah.

Saat pertama kali membuka galeri, sambutan singkat menawarkan pilihan yang sama: **Make it yours** membuka Design System Setup, **Bring your design** membuka pemilih file untuk sebuah desain, dan **Explore the community tools** menutup sambutan.

![Ruangan Colours di Design System Setup pada instalasi baru: satu chip langsung, satu field, dan keseluruhan keputusan pertama](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

Dari sana, tujuh ruangan membawanya sejauh yang Anda mau, dalam urutan apa pun: **Overview**, **Colours**, **Type**, **Logos**, **Tokens**, **Files**, dan **Usage & rules**. Setiap pratinjau di aplikasi diperbarui saat Anda mengetik. [Design System Setup](/info/brand-studio.html) membahas setiap ruangan.

Font disimpan di perangkat Anda. Pilih Google Font dan Lolly menyimpan filenya sebagai aset brand, sehingga tipografi Anda ikut offline dan tidak ada yang diambil saat alat menggambar.

### Lihat, beralih, dan bagikan design system

- **Lihat yang aktif.** **Settings → Design system** menampilkan design system aktif sebagai sampul dan halaman, hanya-baca.
- **Beralih di antara keduanya.** **Settings → Preferences → Design systems** mencantumkan setiap design system di perangkat ini. Satu organisasi dapat menjalankan beberapa design system, atau satu dengan beberapa colourway; [Brand architectures](/info/brand-architectures.html) memetakan susunannya.
- **Bagikan satu.** Ekspor design system sebagai paket `LollyBrand`: satu file yang diimpor rekan untuk mendapatkan palet, font, dan aturan yang sama.

Design system yang disediakan build atau organisasi Anda bersifat **managed**: menampilkan kunci dan tetap hanya-baca. Untuk mengubahnya, buat salinan yang dapat disunting dari **Settings → Preferences → Design systems**.

![Tab Design system di Settings: design system aktif sebagai sampul dan halaman](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Design system Anda adalah token DTCG, format yang dibaca dan ditulis Penpot dan dibawa Tokens Studio ke Figma, jadi palet yang Anda gunakan untuk mendesain dan palet yang diterapkan Lolly adalah satu dokumen. [Design Tokens](/info/design-tokens.html) memuat detailnya.

::: details Untuk pengembang: membangun paket brand dari baris perintah
Untuk menyiapkan paket brand yang dapat dipakai ulang di sebuah checkout, `ingest:brand` menerima tiga wadah yang diekspor Penpot dan Tokens Studio: satu `tokens.json`, direktori berisi file per set dengan `$metadata.json`, atau arsip `project.penpot`.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` mendaftarkan brand sebagai profil dan membangun serta memvalidasi katalognya. Ini tidak pernah mengubah profil default: jalankan dengan `LOLLY_PROFILE=acme` untuk memakai paket baru. [Configuration](/info/configuration.html) menjelaskan bagaimana paket brand dan profil saling melengkapi.
:::

## Bawa masuk yang sudah Anda miliki

Anda tidak mulai dari halaman kosong.

**File desain.** Karya jadi dari Figma, Penpot, Illustrator, InDesign, atau aplikasi SVG mana pun terbuka di Design sebagai tata letak hidup: teks tetap dapat diketik ulang, bentuk tetap bentuk, dan gambar masuk ke pustaka Anda. File dibaca di browser Anda dan tidak ada yang diunggah. [Import a design](/info/design-import.html) mencantumkan setiap format dan apa yang terbawa.

**Deck.** Letakkan `.pptx` PowerPoint ke Lolly untuk menyimpan slide-nya sebagai aset, tulis deck baru dari Markdown di **Markdown Slides**, atau gunakan [Rebrand a deck](/info/rebrand.html) untuk memindahkan seluruh deck ke design system Anda.

**Data.** Tempel atau letakkan tabel CSV atau JSON dan field berulang sebuah alat terisi darinya, atau [Batch](/info/batch.html#make-many-versions-of-one-design) membuat satu file jadi per baris.

### Dari sekali pakai menjadi templat

Tata letak yang diimpor adalah sesi Design biasa. **Share with rules** mengubahnya menjadi alat: Anda memilih bagian mana yang boleh diubah orang lain, dan mereka hanya mengisi bagian itu.

![Simpan master Design, pilih input dan batas di salinan penulisan, lalu bagikan alat .lolly yang dapat dipakai ulang yang diisi penerima](/info/diagrams/concepts/share-with-rules.svg)

[Share a design with rules](/info/create-a-tool.html) memandu setiap langkah.

## Buat banyak, bagikan, dan otomatiskan

- <!--i:download--> **Ekspor.** Alat menghasilkan SVG, PDF, PNG, JPG, WebP, video, dan lainnya, dalam format yang ditawarkan tiap alat, pada ukuran cetak yang sebenarnya bila Anda perlukan. Lihat [Export a file](/info/exporting.html).
- <!--i:link--> **Bagikan tautan.** Pengaturan sebuah alat ikut dalam tautannya, sehingga tautan membuka kembali file yang sama di mana pun.
- <!--i:layers--> **Buat satu per baris.** Jalankan alat dari spreadsheet di [Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Otomatiskan.** Render yang sama berjalan dari [CLI](/info/cli.html) dan dari [agen AI](/info/ai-agents.html).

Tautan adalah permintaan yang lengkap. Tidak ada yang menggambar bagan di bawah ini: tipe, judul, dan seluruh tabel datanya diketik di bilah alamat, dan tautan yang sama menggambar bagan yang sama di perangkat mana pun.

![Sebuah area chart signup bulanan, yang tiap nilainya datang sebagai parameter query, bukan sebagai klik](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Ke mana selanjutnya

- <!--i:people--> **[Create](/info/creators.html)**: membuat, menganimasikan, merekam, membagikan, dan mengekspor.
- <!--i:code--> **[Automate](/info/builders.html)**: design system, penulisan alat, baris perintah, tautan, dan agen.
- <!--i:usercheck--> **[Manage](/info/operators.html)**: menjalankan Lolly untuk tim dengan Lolly Work.
- <!--i:server--> **[Deploy](/info/operate.html)**: meng-host Lolly dan Lolly Work.
- <!--i:shieldcheck--> **[Trust](/info/trust.html)**: privasi, keamanan, dan memeriksa file sendiri.
