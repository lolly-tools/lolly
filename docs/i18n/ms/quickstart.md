# Mula

Menjelang akhir halaman ini alat anda akan memakai warna dan fon anda sendiri, dan kerja yang sudah anda ada akan sedia untuk digunakan semula. Anda tidak memerlukan akaun, dan membuat serta mengeksport berjalan pada peranti anda.

::: timeline
- <!--i:sparkle--> **Buat satu fail.** [Buat fail pertama anda](/info/make-something.html) membimbing anda membuat kod QR dalam beberapa minit.
- <!--i:palette--> **Masukkan jenama anda.** Mulakan daripada satu warna, fail token atau reka bentuk yang siap.
- <!--i:layers--> **Buat lebih banyak yang serupa.** Kongsi pautan, isi hamparan atau jalankan alat daripada skrip.
:::

Baru dengan idea ini? [What is Lolly?](/info/what-is-lolly.html) ialah pengenalan lima minit, dan [How Lolly works](/info/how-lolly-works.html) menunjukkan siapa melakukan apa.

## Masukkan jenama anda

lolly.tools dibuka dalam **Lolly Demo**, sistem reka bentuk contoh Lolly sendiri; [Meet Lolly Demo](/info/lolly-demo.html) menunjukkan apa yang anda lihat. Sistem reka bentuk anda menggantikannya: set kecil token reka bentuk, iaitu warna, fon dan beberapa peraturan, yang digunakan oleh setiap alat untuk melukis. Tetapkan sekali, dan semua yang anda buat bermula dengan jenama yang betul.

Pilih laluan yang sepadan dengan apa yang anda ada:

- <!--i:palette--> **Satu warna.** Buka **Design System Setup** (`#/start`), namakan sistem reka bentuk anda dan pilih warna utama. Lolly menerbitkan palet lengkap yang mudah diakses daripadanya, dengan permukaan cerah dan gelap, teks dan aksen. Pilih fon dan anda mempunyai jenama yang berfungsi.
- <!--i:upload--> **Fail token.** **Add from…**, di kaki rel bilik dalam Design System Setup, menerima fail token DTCG, Tokens Studio atau Penpot, SVG atau pek `LollyBrand`. Letakkannya di situ dan palet terisi. Selagi sistem reka bentuk masih kosong, **Start from a reference** dalam bilik Overview membuka pemilih yang sama.
- <!--i:pentool--> **Reka bentuk yang siap.** Dalam Design, pilih **Import a design** dan letakkan fail `.fig`, `.penpot`, `.ai`, `.idml` atau SVG. Lihat [Bawa masuk apa yang anda sudah ada](#bring-in-what-you-already-have) di bawah.

Kali pertama anda membuka galeri, sambutan ringkas menawarkan pilihan yang sama: **Make it yours** membuka Design System Setup, **Bring your design** membuka pemilih fail untuk reka bentuk dan **Explore the community tools** menutup sambutan.

![Bilik Colours dalam Design System Setup pada pemasangan baharu: satu cip langsung, satu medan dan keseluruhan keputusan pertama](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

Dari situ, tujuh bilik membawanya sejauh yang anda mahu, dalam sebarang susunan: **Overview**, **Colours**, **Type**, **Logos**, **Tokens**, **Files** dan **Usage & rules**. Setiap pratonton dalam apl dikemas kini semasa anda menaip. [Design System Setup](/info/brand-studio.html) meliputi setiap bilik.

Fon disimpan pada peranti anda. Pilih Google Font dan Lolly menyimpan fail sebagai aset jenama, jadi tipografi anda dibawa luar talian dan tiada apa-apa diambil apabila alat melukis.

### Lihat, tukar dan kongsi sistem reka bentuk

- **Lihat yang aktif.** **Settings → Design system** menunjukkan sistem reka bentuk aktif sebagai kulit dan halaman, baca sahaja.
- **Tukar antaranya.** **Settings → Preferences → Design systems** menyenaraikan setiap sistem reka bentuk pada peranti ini. Satu organisasi boleh menjalankan beberapa sistem reka bentuk, atau satu dengan beberapa colourway; [Brand architectures](/info/brand-architectures.html) memetakan susunan tersebut.
- **Kongsi satu.** Eksport sistem reka bentuk sebagai pek `LollyBrand`: satu fail yang diimport rakan sekerja untuk mendapat palet, fon dan peraturan yang sama.

Sistem reka bentuk yang dibekalkan binaan atau organisasi anda ialah **terurus**: ia menunjukkan kunci dan kekal baca sahaja. Untuk mengubah satu, buat salinan boleh sunting daripada **Settings → Preferences → Design systems**.

![Tab Design system dalam Settings: sistem reka bentuk aktif sebagai kulit dan halaman](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Sistem reka bentuk anda ialah token DTCG, format yang dibaca dan ditulis Penpot dan dibawa Tokens Studio ke Figma, jadi palet yang anda reka dan palet yang digunakan Lolly ialah satu dokumen. [Design Tokens](/info/design-tokens.html) mempunyai butirannya.

::: details Untuk pembangun: bina pek jenama daripada baris perintah
Untuk menyediakan pek jenama boleh guna semula dalam checkout, `ingest:brand` menerima tiga bekas yang dieksport Penpot dan Tokens Studio: satu `tokens.json`, direktori fail bagi setiap set dengan `$metadata.json`, atau arkib `project.penpot`.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` mendaftarkan jenama sebagai profil dan membina serta mengesahkan katalognya. Ia tidak pernah mengubah profil lalai: jalankan dengan `LOLLY_PROFILE=acme` untuk menggunakan pek baharu. [Configuration](/info/configuration.html) menerangkan cara pek jenama dan profil berpadu.
:::

## Bawa masuk apa yang anda sudah ada

Anda tidak bermula daripada halaman kosong.

**Fail reka bentuk.** Kerja siap daripada Figma, Penpot, Illustrator, InDesign atau mana-mana apl SVG dibuka dalam Design sebagai reka letak hidup: teks kekal boleh ditaip semula, bentuk kekal bentuk dan imej mendarat dalam pustaka anda. Fail dibaca dalam pelayar anda dan tiada apa-apa dimuat naik. [Import a design](/info/design-import.html) menyenaraikan setiap format dan apa yang dibawa.

**Dek.** Letakkan `.pptx` PowerPoint pada Lolly untuk memfailkan slaidnya sebagai aset, tulis dek baharu daripada Markdown dalam **Markdown Slides**, atau gunakan [Rebrand a deck](/info/rebrand.html) untuk memindahkan seluruh dek ke sistem reka bentuk anda.

**Data.** Tampal atau letakkan jadual CSV atau JSON dan medan berulang alat terisi daripadanya, atau [Batch](/info/batch.html#make-many-versions-of-one-design) membuat satu fail siap bagi setiap baris.

### Daripada kerja sekali guna kepada templat

Reka letak yang diimport ialah sesi Design biasa. **Share with rules** menukarnya menjadi alat: anda memilih bahagian yang boleh diubah orang lain, dan mereka hanya mengisi bahagian itu.

![Simpan induk Design, pilih input dan had dalam salinan pengarangan, kemudian kongsi alat .lolly boleh guna semula yang diisi penerima](/info/diagrams/concepts/share-with-rules.svg)

[Share a design with rules](/info/create-a-tool.html) membimbing setiap langkah.

## Buat banyak, kongsi dan automasikan

- <!--i:download--> **Eksport.** Alat menghasilkan SVG, PDF, PNG, JPG, WebP, video dan lagi, dalam format yang ditawarkan setiap alat, pada saiz cetak sebenar apabila anda perlu. Lihat [Export a file](/info/exporting.html).
- <!--i:link--> **Kongsi pautan.** Tetapan alat dibawa dalam pautannya, jadi pautan membuka semula fail yang sama di mana-mana.
- <!--i:layers--> **Buat satu bagi setiap baris.** Gerakkan alat daripada hamparan dalam [Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automasikan.** Render yang sama berjalan daripada [CLI](/info/cli.html) dan daripada [ejen AI](/info/ai-agents.html).

Pautan ialah permintaan yang lengkap. Tiada siapa melukis carta di bawah: jenisnya, tajuknya dan keseluruhan jadual datanya ditaip ke dalam bar alamat, dan pautan yang sama melukis carta yang sama pada mana-mana peranti.

![Satu carta kawasan pendaftaran bulanan, setiap nilainya tiba sebagai parameter pertanyaan dan bukannya klik](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Ke mana seterusnya

- <!--i:people--> **[Cipta](/info/creators.html)**: membuat, menganimasi, merakam, berkongsi dan mengeksport.
- <!--i:code--> **[Automasi](/info/builders.html)**: sistem reka bentuk, pengarangan alat, baris perintah, pautan dan ejen.
- <!--i:usercheck--> **[Urus](/info/operators.html)**: menjalankan Lolly untuk pasukan dengan Lolly Work.
- <!--i:server--> **[Terap](/info/operate.html)**: menghoskan Lolly dan Lolly Work.
- <!--i:shieldcheck--> **[Percaya](/info/trust.html)**: privasi, keselamatan dan menyemak fail sendiri.
