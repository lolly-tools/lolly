# Perbandingan Lolly

Lolly menghasilkan fail yang mematuhi jenama pada peranti anda sendiri, tanpa akaun. **Lolly Work** ialah pelayan untuk pasukan: daftar masuk, projek kongsi, kelulusan dan render pelayan, pada mesin yang dikendalikan organisasi anda. Kedua-duanya sumber terbuka di bawah MPL-2.0.

Kebanyakan pasukan mengekalkan alat yang ada. Apl reka bentuk membekalkan reka bentuk, DAM kekal sebagai sumber rekod rasmi dan Lolly menukar input yang diluluskan menjadi fail siap. [Gunakan Lolly dengan DAM sedia ada anda](/info/use-with-dam.html) menerangkan gabungan itu. Idea di sebalik gabungan ini ialah [kedaulatan kandungan](/info/content-sovereignty.html).

<!--i:eti-gauge-->
## Alat masa kini

Setiap gelang menunjukkan sejauh mana sesuatu kelas produk memenuhi satu keperluan. Tekan **?** di sebelah baris untuk melihat bukti, dan **?** di sebelah petunjuk untuk melihat cara skor berfungsi.

::: figure positioning-comparison
Perbandingan keupayaan. Penyelidikan pesaing daripada dokumen vendor, Ogos hingga 21 November 2026. Lolly dan Lolly Work disemak pada 21 November 2026. Pemarkahan: 0 tiada, 25 jalan penyelesaian sementara, 50 wujud tetapi terhad aksesnya atau separa, 75 kukuh dengan batasan, 100 kecekapan teras.
:::

::: details Sumber untuk skor yang berubah pada November 2026
- Canva: [log perubahan API](https://www.canva.dev/docs/apps/rest-apis/changelog/), [apl perkhidmatan](https://www.canva.dev/blog/developers/canva-service-accounts/), [bantuan Brand Controls](https://www.canva.com/help/brand-control/)
- Adobe: [log perubahan InDesign API](https://developer.adobe.com/firefly-services/docs/indesign-apis/getting-started/changelog/), [harga Adobe Express](https://www.adobe.com/express/pricing)
- Figma: [kredit ejen dan AI](https://help.figma.com/hc/en-us/articles/42614902212887), [pelayan MCP](https://developers.figma.com/docs/figma-mcp-server/)
- Frontify dan Bynder: [nota keluaran Frontify Oktober 2026](https://news.frontify.com/163371-what-s-new-in-october-2026), [Frontify MCP](https://help.frontify.com/en/articles/14787214-frontify-mcp-beta)
- Bannerbear dan Placid: [harga Bannerbear](https://www.bannerbear.com/pricing/), [log perubahan Bannerbear](https://www.bannerbear.com/changelog/), [harga Placid](https://placid.app/pricing)
- Penpot: [harga pengehosan sendiri](https://penpot.app/pricing/self-host), [keluaran](https://github.com/penpot/penpot/releases)
- Cloudinary: [asal-usul kandungan](https://cloudinary.com/documentation/content_provenance_and_authenticity), [harga](https://cloudinary.com/pricing)
:::

Ciri dan rekod prestasi berada pada baris berasingan. Keluaran awam pertama Lolly ialah 1.0.1 pada 30 Ogos 2026, keselamatannya belum melalui audit bebas dan bukti penerimaannya baru berusia beberapa bulan. [Penerimaan & Tadbir Urus](/info/adoption-governance.html#status) mempunyai keadaan semasa.

<!--i:eti-hammer-->
## Bila patut memilih Lolly

::: cols
## Pilih Lolly apabila

- Jenis fail yang sama diperlukan berulang kali: jubin acara, lencana, sijil, amaran, kad sosial
- Banyak fail dihasilkan daripada satu templat dan jadual nilai, dalam [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) atau CLI
- Warna, tipografi dan aset mesti kekal dalam sistem reka bentuk, walaupun pada kanvas terbuka
- Reka bentuk Figma, Penpot, Illustrator, InDesign, Affinity atau PDF yang siap perlu menjadi boleh disunting dan dihasilkan semula ([Import reka bentuk](/info/design-import.html))
- Fail mesti dihasilkan pada peranti atau pelayan anda sendiri

## Pilih yang lain apabila

- Kerja melibatkan sentuhan semula foto yang terperinci atau ilustrasi
- Anda mereka bentuk dan membuat prototaip antara muka aplikasi
- Anda memerlukan pustaka stok dan templat yang besar tersedia pada hari pertama
- Anda memerlukan perkhidmatan terurus dengan rekod prestasi yang panjang pada skala besar
:::

Reka bentuk yang diimport dan token reka bentuk kongsi membolehkan pasukan menggabungkan Lolly dengan aplikasi khusus, sementara Lolly Work mentadbir aset kongsi, semakan dan penghantaran.

Untuk pasukan dengan DAM yang dikurasi, mulakan dengan mengekalkan pustaka dan pentadbirnya. [Pengalaman Brandfolder SUSE](/info/suse-brandfolder.html) merekodkan cara integrasi menyokong penerimaan dan pengurusan perubahan kelulusan. Vendor DAM dan rakan pelaksanaan boleh menilai susunan yang sama melalui [aliran kerja rakan kongsi](/info/dam-partners.html).

Dalam **Lolly Markdown Slides**, seluruh dek ditulis sebagai data, disusun reka letaknya secara langsung dan dieksport sebagai fail PowerPoint asli yang boleh disunting.

![Lolly Markdown Slides dalam paparan pisah: slaid dek disenaraikan sebagai blok di kiri, render dek yang telah disusun reka letaknya di kanan](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

<!--i:eti-shield-check-->
## Peraturan berada dalam alat

Lolly meletakkan peraturan jenama yang boleh digunakan semula dalam alat: warna, fon, jidar bleed, jarak dan input yang dibenarkan. Templat menetapkan bahagian yang tidak boleh diubah oleh penerima. Lolly Work menambah akses kumpulan dan dasar input pada templat itu, dengan rantaian kelulusan untuk penyerahan katalog dan penghantaran.

Menyemak alat sekali memudahkan pengeluaran berulang, kerana setiap output mewarisi peraturan reka letaknya. Teks, imej yang dimuat naik dan hak penggunaan masih boleh memerlukan semakan, dan Lolly Work menyediakan katalog kongsi dan langkah kelulusan untuk itu. Bagi pasukan kreatif, alat ialah pagar keselamatan: anda masih membawa data, teks dan imej, dan alat memastikan setiap hasil mematuhi jenama.

![Seluruh tugas penghasil: taip perkataan. Tipografi, warna dan jarak telah ditetapkan semasa alat dibuat](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Tiga lagi perbezaan:

- **Fail akhir, daripada input.** Input masuk, fail siap keluar, tanpa "sekarang simpan daripada alat reka bentuk anda dan kemaskannya".
- **Alat menggubah alat.** Satu alat boleh membenamkan render alat lain dalam satu fail siap, tanpa gandingan kod antara kedua-duanya.
- **Sumber terbuka.** Enjin ialah sumber terbuka, dan alat, aset serta token reka bentuk ialah fail yang boleh anda simpan dalam kawalan versi atau urus dalam Lolly Work, bukan baris dalam pangkalan data orang lain.

Reka bentuk berani masih boleh dihasilkan dalam batas itu. Peta bandar bermutu poster ini terdiri daripada laluan jalan dan air vektor sebenar, daripada senarai juntai bawah dan dua medan warna yang tidak boleh diarahkan ke luar sistem reka bentuk:

![Gelang terusan dan rangkaian jalan Amsterdam dilukis dari tepi ke tepi dengan dakwat sistem reka bentuk sendiri, setiap lejang diletakkan oleh templat dan bukannya dengan tangan](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

<!--i:eti-stamp-->
## Berinovasi secara kebarangkalian, tingkatkan skala secara deterministik

Kebanyakan tawaran "kreatif AI" meletakkan model di sisi yang salah pada garis pemisah lama. Penyalin dan penghias manuskrip telah menetapkan kedudukannya. Anda bekerja bebas pada lakaran, tempat apa sahaja boleh dicuba dan tiada apa-apa dimuktamadkan. Kemudian anda beralih ke mesin cetak, yang memuktamadkannya. Lakaran ialah tempat seni terhasil, dan mesin cetak ialah cara ia disebarkan, dan karya bercetak boleh dipercayai kerana mesin cetak menepati janjinya pada setiap tarikan.

Lolly ialah mesin cetak itu. Untuk idea, gunakan apa sahaja yang anda suka, sama ada model, pereka atau lukisan kasar, tetapi sebaik sahaja idea perlu menjadi banyak fail, ia melalui sesuatu yang merender dengan cara yang sama setiap kali, daripada input yang boleh dibaca semula oleh sesiapa sahaja. Perbandingan di atas sebenarnya tentang siapa yang menjadikan langkah pemuktamadan itu boleh diulang.

> Percayai proses kreatif, tingkatkan skala dengan ketelitian.

<!--i:eti-tag-->
## Percuma selamanya

**Jika ia dirender pada peranti anda, ia percuma selamanya.** Enjin, cangkerang, alat dan format ialah sumber terbuka, dan versi yang telah dikeluarkan tidak boleh ditarik balik. Lolly Work juga sumber terbuka. Organisasi membayar infrastruktur dan operasi yang dipilihnya, tanpa caj lesen perisian bagi setiap pengguna atau setiap render untuk pengehosan sendiri. [Soalan & jawapan](/info/faq.html) menceritakan kisah di sebalik janji itu.

<!--i:eti-map-pin-->
## Tempat kandungan anda disimpan

Kerja kreatif Lolly boleh berjalan pada perkakasan milik anda, dan token reka bentuk, fon, logo serta alatnya ialah fail yang boleh anda simpan. Dengan Lolly Work, projek kongsi, aset, dasar dan rekod audit disimpan dalam storan yang dikonfigurasi organisasi anda. [Kepercayaan](/info/trust.html) menerangkan mengapa itu penting, dan [Dasar Privasi](/info/privacy.html) serta [Sahkan Sendiri](/info/verify-yourself.html) membolehkan anda menyemak dakwaan itu dan bukannya menerima kata-kata kami begitu sahaja.

<!--i:eti-grid-->
## Alat demi alat

[Perbandingan Lolly, alat demi alat](/info/compare.html) membandingkan Lolly dengan Canva, Adobe, Figma, Penpot, portal jenama, API render dan penukar dalam talian, satu halaman setiap satu, serta menerangkan [apa yang berjalan di mana](/info/compare.html#what-runs-where).
