# Mula Pantas

Lolly menukar peraturan anda - warna, tipografi, susun atur, logik - menjadi alat yang boleh digunakan sesiapa sahaja untuk menghasilkan fail siap: imej, PDF, kad sosial, video, dengan mengisi beberapa medan. Tidak banyak yang perlu dipelajari dan tiada apa-apa yang perlu dimuat naik: penghasilan dan pengeksportan berjalan pada peranti anda, dalam talian atau luar talian.

Inilah halaman pertama yang perlu dibaca. Dua perkara menjadikan anda produktif: **jadikan Lolly milik anda** dan **bawa masuk apa yang anda sudah ada** (fail reka bentuk dan token anda). Selebihnya hanya sepautan jauhnya.

> Baru mengenal Lolly dan hanya mahu menghasilkan sesuatu? [Hasilkan sesuatu dalam 60 saat](/info/make-something.html) membimbing anda melalui tiga, atau [buka aplikasi](/#/), pilih mana-mana alat daripada galeri, isi ruang kosong dan tekan **Export**. Kembali ke sini apabila anda mahu ia memakai jenama *anda*.

![Paparan Utilities - alat kerja harian atas peranti seperti Strip Hidden Data, Compress PDF dan Convert Image, semuanya di satu tempat](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 1. Jadikan ia milik anda - konfigurasikan Sistem Reka Bentuk anda

Jenama anda dalam Lolly ialah satu dokumen **design-tokens** yang kecil - warna, fon dan beberapa peraturan - yang dijadikan rujukan oleh setiap alat semasa menghasilkan output. Tetapkan sekali dan segala yang anda hasilkan menepati jenama secara binaan, bukan melalui semakan. Ada tiga jalan masuk; pilih yang sepadan dengan tempat jenama anda berada sekarang.

### Mula dari kosong (pembina sistem reka bentuk)

Larian pertama membawa anda ke **galeri**, dengan dialog aluan ringkas di atasnya yang menawarkan tiga jalan masuk - **Make it yours** (Brand Studio di `#/start`), **Bring your design** (lepaskan fail Figma, Penpot, InDesign atau PDF dan ia terbuka sebagai susun atur boleh sunting - laluan terpantas ke [Bawa masuk apa yang anda sudah ada](#2-bring-in-what-you-already-have) di bawah) dan **Explore the community tools** - serta sebaris bahasa jika bahasa Inggeris bukan bahasa anda. Ambil kad pertama dan anda tiba di [**Brand Studio**](/info/brand-studio.html). Berikan nama dan satu warna utama, dan Lolly *menerbitkan* palet lengkap yang mudah diakses daripadanya - permukaan cerah/gelap, teks, aksen - menggunakan matematik warna yang sama seperti yang digunakan enjin di tempat lain.

![Bilik Colours dalam Brand Studio - satu warna utama, dan palet mudah akses yang diterbitkan Lolly daripadanya](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours) Pilih fon, dan anda sudah mempunyai jenama yang berfungsi dalam masa kurang seminit. Dari situ, enam bilik studio - Overview, Colours, Type, Logos, Tokens, Files - membolehkan anda membawanya sejauh yang anda mahu, dalam apa-apa susunan, memperhalusi mana-mana bahagiannya bila-bila anda kembali. Tab **Design system** pada papan pemuka (`#/d`) memaparkan hasilnya secara baca sahaja dan menunjuk kembali ke `#/start`, iaitu tempat penyuntingan berlaku (melainkan anda menggunakan binaan Lolly yang dikunci jenama, iaitu jenamanya tetap dan tiada apa-apa untuk diubah).

### Import jenama yang anda sudah ada

Jika jenama anda sudah dirakam sebagai design tokens - daripada **Penpot**, **Tokens Studio** (Figma) atau mana-mana fail **DTCG** biasa - bawa masuk keseluruhannya dan bukan menaipnya semula. Dua laluan:

- <!--i:palette--> **Dalam aplikasi:** [pembina sistem reka bentuk: Brand Studio](/info/brand-studio.html) (`#/start`) menerimanya melalui **Add from…** di bahagian bawah rel biliknya - fail token, eksport Penpot, SVG atau pek `LollyBrand`. Lepaskan ia dan palet pun menyala.
- <!--i:code--> **Daripada baris arahan**, untuk menyediakan pek jenama yang boleh diguna semula:

```bash
# a monolithic tokens.json, a one-file-per-set directory, or a Penpot project archive
npm run ingest:brand -- ./my-tokens.json --name acme --label "Acme" --activate
```

`ingest:brand` menerima ketiga-tiga bekas yang digunakan Penpot / Tokens Studio untuk mengeksport dokumen yang sama - satu `tokens.json` tunggal, sebuah direktori (`$metadata.json` + fail bagi setiap set) atau arkib `project.penpot`. Dengan `--activate` ia mendaftarkan jenama itu sebagai profil, bertukar kepadanya dan membina semula katalog. Lihat [Konfigurasi](/info/configuration.html) untuk memahami bagaimana pek jenama dan profil saling berkait.

### Perhalusi ia dalam aplikasi

Setelah sesebuah jenama aktif, teruskan membentuknya dalam [**Brand Studio**](/info/brand-studio.html) (`#/start`) - tukar satu warna atau satu peranan dan setiap pratonton di seluruh aplikasi dikemas kini sambil anda menaip. (Tab **Design system** pada papan pemuka di `#/d` *memaparkan* jenama itu secara baca sahaja; Studio ialah tempat anda menyuntingnya.)

![Tab Design-system pada Papan Pemuka - jenama aktif dipaparkan secara baca sahaja](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand) Jenama yang sama diringkaskan pada kad **Profile → Your brand**. Fon di sini fon sebenar: pilih daripada Google Fonts dan Lolly menyimpan failnya **pada peranti anda** sebagai aset jenama, jadi tipografi anda ikut bersama secara luar talian dan tiada apa-apa yang diambil semasa penghasilan.

Apabila anda berpuas hati, **eksport jenama itu sebagai pek `LollyBrand`** - satu fail yang boleh diimport oleh rakan sekerja untuk mendapat palet, fon dan peraturan yang sama persis. Begitulah sesebuah jenama berpindah antara orang dan mesin tanpa pelayan di tengah-tengah.

> **Token jenama berulang-alik dua hala.** Oleh sebab jenama Lolly *ialah* token DTCG - format yang dibaca dan ditulis Penpot secara asli dan dibawa Tokens Studio ke Figma - palet yang anda *guna* untuk mereka bentuk dan palet yang *dikuatkuasakan* Lolly ialah satu dokumen, bukan dua senarai yang anda selaraskan dengan tangan. Lihat [Design Tokens](/info/design-tokens.html).

## 2. Bawa masuk apa yang anda sudah ada

Anda tidak bermula dari halaman kosong. Lolly membuka kerja reka bentuk dan format terbuka yang sudah anda miliki.

### Fail reka bentuk sumber terbuka

Kerja siap dalam **Figma, Penpot, Illustrator, InDesign atau mana-mana aplikasi SVG** tidak perlu terkunci dalam aplikasi tempat anda melukisnya. Buka **Design**, klik **Import a design**, dan fail itu terbuka sebagai *susun atur hidup* - bukan gambar yang dileperkan. Setiap lapisan menjadi kotak boleh sunting: teks kekal boleh ditaip semula, bentuk kekal bentuk, imej masuk ke pustaka anda dan seni vektor yang rumit dikekalkan dengan setia. Ia tiba dalam keadaan sudah menepati muka taip dan peraturan warna jenama anda.

| Anda ada | Bawa masuk sebagai |
|---|---|
| Bingkai Figma | `.fig` asli (File → Save local copy), atau eksport SVG |
| Reka bentuk Penpot | Eksport `.penpot` miliknya, atau mana-mana SVG |
| Fail Illustrator | `.ai` asli (serasi PDF) atau `.pdf` - terbuka terus |
| Susun atur InDesign | `.idml` (File → Export → InDesign Markup) |
| Apa-apa lagi | **Mana-mana SVG** - pintu masuk sejagat |

Seluruh proses import berlaku **pada peranti anda** - fail itu dihurai dalam pelayar anda dan tiada apa-apa yang dimuat naik. Butiran penuh, dan apa sebenarnya yang terbawa bersama, ada dalam [Import reka bentuk](/info/design-import.html).

Ada **dek PowerPoint** pula? Lepaskan fail `.pptx` pada **Deck Builder** untuk menyuntingnya slaid demi slaid, sudah pun terikat pada jenama anda - atau jalankan **Rebrand a Deck** untuk mendapat dek yang sama kembali dengan tema baharu, carta dan animasi utuh.

### Daripada kerja sekali guna kepada templat

Inilah hasilnya: susun atur yang diimport ialah sesi Design biasa, jadi sebaik anda **simpan** ia, ia hidup pada satu URL. Sesiapa yang ada Lolly boleh membuka URL itu, menukar perkataan, menukar imej dan menghasilkan versi mereka sendiri - tanpa aplikasi reka bentuk, dan bahagian yang dikunci kekal terkunci. Reka bentuk sekali guna menjadi alat yang boleh diguna semula. Itulah keseluruhan ideanya, dicapai tanpa menulis satu baris konfigurasi pun.

### Data terbuka dan alat terbuka

[Set alat komuniti](/info/builders.html) ialah sumber terbuka dan bebas jenama - kod QR, peta jalan, penapis, utiliti privasi - dan ia menghasilkan output mengikut jenama *anda* sebaik sahaja anda mengaktifkannya.

Suapkan juga data terbuka anda sendiri kepada alat: tampal atau lepaskan jadual **CSV** atau **JSON** dan medan berulang sesebuah alat akan diisi daripadanya, satu aset siap bagi setiap baris.

## 3. Hasilkan sesuatu, kemudian kongsi atau automasikannya

Dengan jenama yang aktif dan bahan anda di tangan, setiap alat menghasilkan fail yang siap:

- <!--i:download--> **Hasilkan** mana-mana alat ke **SVG, PDF, PNG, JPG, WebP, video** dan lain-lain - pada saiz cetakan sebenar dan unit fizikal apabila anda memerlukannya. Lihat [Mengeksport & format](/info/exporting.html).
- <!--i:link--> **Kongsi pautan.** Setiap keadaan alat ialah satu URL, jadi aset yang siap boleh dihasilkan semula dan boleh dialamatkan melalui parameter - simpan pautannya, jana semula bila-bila perlu.
- <!--i:layers--> **Buat secara pukal.** Pacu templat daripada hamparan dalam [grid kelompok](/info/exporting.html): satu aset siap bagi setiap baris.
- <!--i:cpu--> **Automasikannya.** Penghasilan yang sama berjalan daripada [CLI](/info/cli.html) dan daripada [ejen AI](/info/ai-agents.html) - satu URL ialah API.

"Satu URL ialah API" itu bermaksud harfiah. Carta di bawah tidak dilukis oleh sesiapa pun: jenisnya, tajuknya dan keseluruhan jadual datanya ditaip ke dalam bar alamat, dan pautan yang sama menghasilkan carta yang sama pada mana-mana peranti.

![Satu carta kawasan pendaftaran bulanan, setiap nilainya tiba sebagai parameter pertanyaan dan bukannya klik](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Ke mana seterusnya

Tiga laluan, bergantung pada tujuan anda di sini:

- <!--i:people--> **[Lolly untuk Pencipta](/info/creators.html)** - anda menghasilkan sesuatu. Kelebihannya, dan cara mendapat manfaat maksimum daripada aplikasi ini.
- <!--i:code--> **[Lolly untuk Pembina](/info/builders.html)** - anda mengarang alat, mengintegrasi dan menggunakannya. Dokumentasi teknikal.
- <!--i:shieldcheck--> **[Lolly untuk Pengendali](/info/operators.html)** - anda bertanggungjawab ke atas jenama, keselamatan dan pelaksanaan di seluruh organisasi.
