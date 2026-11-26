# Mula

Tetapkan alat anda kepada warna dan fon anda sendiri, dan guna semula kerja yang sudah anda miliki. Anda tidak memerlukan akaun, dan pembuatan serta eksport berjalan pada peranti anda.

::: steps
- <!--i:eti-sparkles--> **[Buat satu fail](/info/make-something.html)** Kod QR dalam beberapa minit, dengan setiap langkah ditunjukkan.
- <!--i:eti-palette--> **[Masukkan jenama anda](#put-your-brand-in)** Mulakan dengan satu warna, fail token atau reka bentuk siap.
- <!--i:eti-folder-move--> **[Bawa masuk kerja anda](#bring-in-what-you-already-have)** Reka bentuk, dek dan data yang sudah anda miliki, dibaca pada peranti anda.
- <!--i:eti-repeat--> **[Buat lebih banyak yang serupa](#make-many-share-and-automate)** Kongsi pautan, isi hamparan atau jalankan alat daripada skrip.
:::

[Apa itu Lolly?](/info/what-is-lolly.html) ialah pengenalan lima minit. [Cara Lolly berfungsi](/info/how-lolly-works.html) menunjukkan siapa melakukan apa.

<!--i:eti-palette-->
## Masukkan jenama anda

lolly.tools dibuka dalam **Lolly Demo**, sistem reka bentuk contoh Lolly sendiri ([Kenali Lolly Demo](/info/lolly-demo.html)). Sistem reka bentuk anda menggantikan Lolly Demo. Ia ialah set kecil token reka bentuk (warna, fon dan beberapa peraturan) yang digunakan setiap alat untuk melukis. Tetapkannya sekali, dan segala yang anda buat bermula mengikut jenama.

Pilih laluan yang sepadan dengan apa yang anda miliki:

- <!--i:palette--> **Satu warna.** Buka paparan **Design System Setup** (`#/start`), namakan sistem reka bentuk anda dan pilih warna utama. Lolly menghasilkan palet yang mudah diakses daripada warna itu, dengan permukaan cerah dan gelap, teks dan aksen. Pilih fon dan anda mempunyai jenama yang sedia digunakan.
- <!--i:upload--> **Fail token.** **Add from…**, di bahagian atas Lolly Design System Setup, menerima fail token DTCG, Tokens Studio atau Penpot, SVG atau pek `LollyBrand`. Palet diisi daripada fail. Semasa sistem reka bentuk masih kosong, **Start from a reference** pada Board membuka pemilih yang sama.
- <!--i:pentool--> **Reka bentuk siap.** Dalam Lolly Design, pilih **Import a design** dan lepaskan fail Figma, Penpot, Illustrator, InDesign, Affinity, Photoshop, PowerPoint atau SVG ([setiap format](/info/design-import.html#what-comes-in-from-each-app)). Lihat [Bawa masuk apa yang sudah anda miliki](#bring-in-what-you-already-have) di bawah.

Kali pertama anda membuka galeri, ucapan alu-aluan di bahagian atas menawarkan satu langkah seterusnya. Pada lolly.tools, **Start making** membuka Lolly Design pada poster Launch. Pada pemasangan baharu, **Make it yours** membuka Lolly Design System Setup. Di bawah butang itu, **Bring a file** membuka pemilih fail untuk reka bentuk, dan pilihan yang satu lagi daripada dua pilihan itu ditunjukkan sebagai pautan. Mana-mana tindakan ini, atau butang tutup, menyembunyikan ucapan alu-aluan itu untuk selamanya.

![Ruang Colours Lolly Design System Setup pada sistem reka bentuk baharu: satu cip langsung, satu medan dan keseluruhan keputusan pertama](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-colours-new-system)

Lapan ruang, yang digunakan dalam apa-apa susunan, mengembangkan lagi sistem reka bentuk: **Board**, **Colours**, **Type**, **Logos**, **Tokens**, **Files**, **Rules** dan **Skills**. Setiap pratonton dalam apl dikemas kini semasa anda menaip. [Lolly Design System Setup](/info/brand-studio.html) meliputi setiap ruang.

Fon disimpan pada peranti anda. Google Font yang anda pilih disimpan sebagai aset jenama, jadi tipografi anda berfungsi luar talian dan tiada apa-apa diambil apabila alat melukis.

### Lihat, tukar dan kongsi sistem reka bentuk

- **Lihat yang aktif.** **Settings → Design system** menunjukkan sistem reka bentuk aktif sebagai kulit dan halaman, baca sahaja.
- **Tukar antaranya.** **Settings → Preferences → Design systems** menyenaraikan setiap sistem reka bentuk pada peranti ini. Satu organisasi boleh menjalankan beberapa sistem reka bentuk, atau satu dengan beberapa colourway. [Seni bina jenama](/info/brand-architectures.html) memetakan susunannya.
- **Kongsi satu.** Eksport sistem reka bentuk sebagai pek `LollyBrand`: satu fail yang diimport rakan sekerja untuk mendapatkan palet, fon dan peraturan yang sama.

Sistem reka bentuk yang dibekalkan oleh binaan atau organisasi anda adalah **diurus**: ia memaparkan mangga dan kekal baca sahaja. Untuk mengubahnya, buat salinan boleh sunting daripada **Settings → Preferences → Design systems**.

![Tab Design system dalam Settings: sistem reka bentuk aktif sebagai kulit dan halaman](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Sistem reka bentuk anda ialah token DTCG, format yang dibaca dan ditulis oleh Penpot serta dibawa oleh Tokens Studio ke Figma. Palet yang anda gunakan untuk mereka bentuk dan palet yang digunakan oleh Lolly ialah satu dokumen. [Token Reka Bentuk](/info/design-tokens.html) menerangkannya dengan terperinci.

::: details Untuk pembangun: bina pek jenama melalui baris perintah
`ingest:brand` membina pek jenama yang boleh digunakan semula dalam checkout. Ia menerima tiga bekas yang dieksport oleh Penpot dan Tokens Studio: satu `tokens.json`, direktori fail bagi setiap set dengan `$metadata.json` atau arkib `project.penpot`.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` mendaftarkan jenama sebagai profil serta membina dan mengesahkan katalognya. Ia tidak pernah mengubah profil lalai: jalankan dengan `LOLLY_PROFILE=acme` untuk menggunakan pek baharu itu. [Konfigurasi](/info/configuration.html) menerangkan hubungan antara pek jenama dengan profil.
:::

<!--i:eti-folder-move-->
## Bawa masuk apa yang anda sudah ada

**Fail Lolly Design.** Kerja siap daripada Figma, Penpot, Illustrator, InDesign atau mana-mana apl SVG dibuka dalam Lolly Design sebagai reka letak boleh sunting. Teks masih boleh ditaip semula, bentuk kekal sebagai bentuk dan imej masuk ke pustaka anda. Fail dibaca dalam pelayar anda dan tiada apa-apa dimuat naik. [Import reka bentuk](/info/design-import.html) menyenaraikan setiap format dan apa yang dikekalkan.

**Dek.** Lepaskan PowerPoint `.pptx` pada Lolly untuk menyimpan slaidnya sebagai aset. Tulis dek baharu daripada Markdown dalam **Lolly Markdown Slides**. [Jenamakan semula dek](/info/rebrand.html) memindahkan dek kepada sistem reka bentuk anda.

**Data.** Tampal atau lepaskan jadual CSV atau JSON untuk mengisi medan berulang sesuatu alat. [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) menghasilkan satu fail siap bagi setiap baris.

### Daripada karya sekali guna kepada templat

Reka letak yang diimport ialah sesi Lolly Design biasa. **Share with rules** menukar sesi itu menjadi alat. Anda memilih bahagian yang boleh diubah oleh orang lain dan mereka hanya mengisi bahagian itu.

![Simpan induk Lolly Design, pilih input dan had dalam salinan pengarangan, kemudian kongsi alat .lolly boleh guna semula yang diisi oleh penerima](/info/diagrams/concepts/share-with-rules.svg)

[Kongsi reka bentuk dengan peraturan](/info/create-a-tool.html) menerangkan setiap langkah.

<!--i:eti-repeat-->
## Buat banyak, kongsi dan automasikan

- <!--i:download--> **Eksport.** Alat menghasilkan SVG, PDF, PNG, JPG, WebP, video dan banyak lagi, pada saiz cetakan sebenar apabila diperlukan. Setiap alat menawarkan formatnya sendiri. Lihat [Eksport fail](/info/exporting.html).
- <!--i:link--> **Kongsi pautan.** Tetapan alat dibawa dalam pautannya, jadi pautan itu membuka semula fail yang sama di mana-mana.
- <!--i:layers--> **Buat satu bagi setiap baris.** Jalankan alat menggunakan hamparan dalam [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automasikan.** Render yang sama berjalan daripada [CLI](/info/cli.html) dan daripada [ejen AI](/info/ai-agents.html).

Pautan ialah permintaan yang lengkap. Jenis, tajuk dan jadual data carta di bawah ditaip ke dalam bar alamat.

![Carta bar pendaftaran bulanan mengikut saluran dalam warna sistem reka bentuk, dengan setiap nilai diterima sebagai parameter pertanyaan dan bukannya melalui klik](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26sty%3Dposter%26pl%3Droles%26transparentBg%3Dfalse%26d%3DMonth%2CWeb%2CApp%2CPartners%250AJan%2C120%2C60%2C25%250AFeb%2C180%2C95%2C40%250AMar%2C265%2C150%2C70%250AApr%2C340%2C210%2C110%250AMay%2C455%2C290%2C160%250AJun%2C560%2C380%2C230%26t%3DSignups%2520this%2520year%26st%3DBy%2520channel%252C%2520January%2520to%2520June%26full&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

<!--i:eti-map-pin-->
## Ke mana selepas ini

- <!--i:people--> **[Cipta](/info/creators.html)**: membuat, menganimasikan, merakam, berkongsi dan mengeksport.
- <!--i:code--> **[Automasikan](/info/builders.html)**: sistem reka bentuk, pengarangan alat, baris perintah, pautan dan ejen.
- <!--i:usercheck--> **[Urus](/info/operators.html)**: menjalankan Lolly untuk pasukan dengan Lolly Work.
- <!--i:server--> **[Atur guna](/info/operate.html)**: mengehoskan Lolly dan Lolly Work.
- <!--i:shieldcheck--> **[Kepercayaan](/info/trust.html)**: privasi, keselamatan dan menyemak fail sendiri.
