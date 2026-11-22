# Cara Lolly berfungsi

Alat Lolly menyimpan peraturan untuk satu jenis fail: reka letak, tipografi, warna dan bahagian yang boleh diubah oleh orang lain. Anda, rakan sekerja, skrip atau ejen AI mengisi medan dan setiap fail mematuhi peraturan itu.

<!--i:eti-repeat-->
## Satu alat, peraturan anda, banyak fail

Peraturan jenama terkandung dalam alat. Sediakan alat sekali dan setiap output mendapat tipografi, warna dan jarak yang sama, daripada satu kad hingga hamparan berbaris-baris dalam sedozen bahasa.

![Alat logotaip dengan satu medan diisi: tipografi, warna dan jarak telah ditetapkan semasa alat dibuat](/info/shots/aud-rules-in-the-tool.svg)

Orang yang membuat fail keseratus hanya menaip perkataan. Anda menentukan cara kerja disemak dan siapa yang menyemaknya. Lolly mengurangkan perkara yang perlu disemak dan mempercepatkan pembuatan fail seterusnya.

<!--i:eti-users-->
## Siapa yang menggunakan alat

Tiga peranan dalam organisasi mengusahakan satu kad kempen.

![Pereka menetapkan peraturan sekali dalam alat; pembangun menjalankannya daripada skrip dan sesiapa sahaja boleh mengisi medannya; kedua-duanya menghasilkan fail siap](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Pereka menetapkan peraturan.** Mereka menyusun kad dalam Lolly Design dengan tipografi dan warna jenama, kemudian memilih medan yang kekal terbuka. Mereka melakukannya sekali, jadi tiada sesiapa perlu menyetempatkan kad itu secara manual lagi.
- <!--i:code--> **Pembangun memperluas penggunaan alat.** Alat yang sama berjalan dalam skrip setiap malam melalui baris perintah. Carta terkini atau versi bahasa baharu dihasilkan tanpa sesiapa membuka semula reka bentuk.
- <!--i:people--> **Sesiapa sahaja mengisinya.** Wakil jualan dalam pesawat, tanpa rangkaian dan tanpa latihan reka bentuk, membuka alat dan membuat kad untuk mesyuarat esok.
:::

Carta terkini pembangun ialah render seperti ini, dibuat daripada rentetan data dan beberapa tetapan:

![Carta kawasan bertindan bertajuk, dengan tiga sirinya berjalur dalam palet sejuk serta paksi, petunjuk dan tajuk semuanya diletakkan oleh templat dan bukannya secara manual](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Wakil jualan dapat menyiapkannya dalam seminit kerana peraturan pereka dan skrip pembangun. Setiap peranan menggunakan alat yang sama.

<!--i:eti-train-->
## Empat laluan untuk menghasilkan fail

Setiap laluan menjalankan enjin yang sama pada alat yang sama, jadi fail yang dihasilkan oleh skrip sepadan dengan fail yang anda pratonton dalam apl.

![Parameter URL dan argumen baris perintah menjadi model input yang sama, dijalankan melalui satu persekitaran masa jalan dan jambatan eksport yang dikongsi](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **Dalam apl, satu demi satu.** Buka alat, isi medan dan tekan **Export**. [Buat fail pertama anda](/info/make-something.html) membimbing anda membuat satu fail.
- <!--i:layers--> **Dalam apl, banyak serentak.** [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) mengambil jadual yang ditampal atau diimport dan merender satu fail siap bagi setiap baris.
- <!--i:cpu--> **Daripada skrip atau ejen AI.** [CLI](/info/cli.html) menjalankan alat tanpa antara muka grafik dan [pelayan MCP](/info/mcp.html) membolehkan ejen menemui dan menjalankan alat. Pautan ke alat turut membawa inputnya, jadi pautan ialah permintaan yang lengkap.
- <!--i:server--> **Melalui pelayan organisasi anda.** [Lolly Work](/info/organisation.html) merender pada pelayan mengikut dasar log masuk dan alat organisasi anda, menyimpan tugas yang boleh disambung semula serta menyimpan output untuk dimuat turun atau dihantar dengan kelulusan.

Laluan yang boleh digunakan oleh sesuatu tugas bergantung pada format alat dan keupayaan hos. Sesetengah format memerlukan pelayar, jadi baris perintah menyerahkannya kepada lapisan pelayar. [Render dengan CLI](/info/cli-rendering.html) menyenaraikan tempat setiap format dirender.

<!--i:eti-monitor-->
## Apa berjalan di mana

Pembuatan, penyuntingan dan eksport berjalan pada peranti anda, tanpa akaun. Ciri yang memerlukan pelayan, seperti Sync atau penghantaran fail ke perkhidmatan yang disambungkan, hanya menyambung apabila anda menggunakan ciri itu. Dengan Lolly Work, projek dikongsi, penyuntingan langsung oleh pasukan, kelulusan dan tugas pelayan menggunakan pelayan organisasi anda. [Apa berjalan di mana](/info/compare.html#what-runs-where) membandingkan kedua-dua bahagian itu sebelah menyebelah.

<!--i:eti-graduation-cap-->
## Bacaan seterusnya

- [Buat fail pertama anda](/info/make-something.html), untuk mencubanya sekarang.
- [Mula](/info/quickstart.html), untuk memasukkan sistem reka bentuk anda sendiri.
- [Automasikan](/info/builders.html), untuk baris perintah, pautan dan ejen.
- [Seni bina Lolly](/info/overview.html), untuk penyumbang: enjin, cangkerang dan peraturan yang menyatukannya.
