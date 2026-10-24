# Cara Lolly berfungsi

Alat Lolly memegang peraturan bagi satu jenis fail: reka letak, tipografi, warna dan bahagian yang boleh diubah orang lain. Anda, rakan sekerja, skrip atau ejen AI mengisi medan, dan setiap fail keluar dengan betul. Halaman ini menunjukkan siapa melakukan apa, dan empat laluan daripada alat kepada fail siap.

## Satu alat, peraturan anda, banyak fail

Peraturan jenama berada dalam alat, bukan dalam setiap fail yang dihasilkannya. Betulkan alat sekali dan setiap output mewarisi tipografi, warna dan jarak yang sama, sama ada satu kad atau hamparan baris dalam sedozen bahasa.

![Alat logotaip dengan satu medan diisi: tipografi, warna dan jarak telah ditetapkan semasa alat dibuat](/info/shots/aud-rules-in-the-tool.svg)

Orang yang membuat fail keseratus hanya menaip perkataan. Cara anda menyemak kerja, dan siapa yang menyemaknya, kekal keputusan anda. Lolly mengecilkan perkara yang layak disemak, dan menjadikan fail seterusnya lebih pantas dibuat.

## Siapa yang menyentuh alat

Ikuti satu kad kempen melalui organisasi dan tiga pasang tangan muncul. Setiap satu membina atas yang sebelumnya.

![Pereka menetapkan peraturan sekali dalam alat; pembangun menjalankannya daripada skrip dan sesiapa boleh mengisi mediannya; kedua-duanya menghasilkan fail siap](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Pereka menetapkan peraturan.** Mereka menyusun atur kad dalam Design dengan tipografi dan warna jenama, kemudian memilih medan yang kekal terbuka. Mereka melakukannya sekali, jadi tiada siapa melokalkan kad itu dengan tangan lagi.
- <!--i:code--> **Pembangun menskalakan alat.** Alat yang sama berjalan dalam skrip malam melalui baris perintah, jadi carta baharu atau versi bahasa baharu tiba tanpa sesiapa membuka semula reka bentuk.
- <!--i:people--> **Sesiapa boleh mengisinya.** Wakil jualan dalam pesawat, tanpa rangkaian dan tanpa latihan reka bentuk, membuka alat dan membuat kad untuk mesyuarat esok.
:::

Carta baharu dalam langkah pembangun ialah render seperti ini, dibuat daripada rentetan data dan beberapa tetapan tanpa sesiapa membuka fail reka bentuk:

![Carta kawasan bertindan bertajuk, tiga sirinya berjalur dalam palet sejuk, dengan paksi, legenda dan tajuk semuanya diletakkan oleh templat dan bukan dengan tangan](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Seminit mudah wakil itu hanya mungkin kerana ketelitian pereka dan skrip pembangun. Setiap peranan bekerja dengan alat yang sama, bukan produk berasingan.

## Empat laluan kepada fail

Setiap laluan menjalankan enjin yang sama pada alat yang sama, jadi fail yang dibuat skrip sepadan dengan yang anda pratonton dalam apl.

![Parameter URL dan hujah baris perintah menjadi model input yang sama, dijalankan melalui satu masa jalan dan jambatan eksport dikongsi](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **Dalam apl, satu demi satu.** Buka alat, isi medan dan tekan **Export**. [Buat fail pertama anda](/info/make-something.html) membimbing anda melalui satu.
- <!--i:layers--> **Dalam apl, banyak sekali gus.** [Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) mengambil jadual yang ditampal atau diimport dan merender satu fail siap bagi setiap baris.
- <!--i:cpu--> **Daripada skrip atau ejen AI.** [CLI](/info/cli.html) menjalankan alat tanpa kepala, dan [pelayan MCP](/info/mcp.html) membolehkan ejen menemui dan menjalankan alat. Pautan kepada alat turut membawa inputnya, jadi pautan ialah permintaan yang lengkap.
- <!--i:server--> **Melalui pelayan organisasi anda.** [Lolly Work](/info/organisation.html) merender pada pelayan di bawah log masuk dan dasar alat organisasi anda, menyimpan tugasan yang boleh disambung semula dan memegang output untuk muat turun atau penghantaran yang diluluskan.

Laluan yang boleh digunakan sesuatu tugasan bergantung pada format alat dan apa yang boleh dilakukan hos: sesetengah format memerlukan pelayar, jadi baris perintah menyerahkannya kepada peringkat pelayar. [Render with the CLI](/info/cli-rendering.html) menyenaraikan format yang dirender di mana.

## Apa yang berjalan di mana

Membuat, menyunting dan mengeksport berjalan pada peranti anda, tanpa akaun. Ciri yang memerlukan pelayan, seperti Sync atau menghantar fail ke perkhidmatan bersambung, hanya bersambung apabila anda menggunakan ciri itu. Dengan Lolly Work, projek dikongsi, penyuntingan pasukan langsung, kelulusan dan tugasan pelayan menggunakan pelayan organisasi anda. [What runs where](/info/compare.html#what-runs-where) meletakkan kedua-dua bahagian bersebelahan.

## Baca seterusnya

- [Buat fail pertama anda](/info/make-something.html), untuk mencuba sekarang.
- [Mula](/info/quickstart.html), untuk memasukkan sistem reka bentuk anda sendiri.
- [Automasi](/info/builders.html), untuk baris perintah, pautan dan ejen.
- [Seni bina Lolly](/info/overview.html), untuk penyumbang: enjin, shell dan peraturan yang mengikatnya bersama.
