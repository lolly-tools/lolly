# Perbandingan Lolly

Lolly membuat file yang sesuai merek di perangkat Anda sendiri, tanpa akun. **Lolly Work** adalah server untuk tim: proses masuk, proyek bersama, persetujuan dan render server, pada mesin yang dijalankan organisasi Anda. Keduanya bersumber terbuka di bawah MPL-2.0.

Sebagian besar tim mempertahankan alat yang mereka miliki. Aplikasi desain menyediakan desain, DAM tetap menjadi sumber acuan resmi, dan Lolly mengubah input yang disetujui menjadi file jadi. [Gunakan Lolly dengan DAM yang sudah Anda miliki](/info/use-with-dam.html) menjelaskan kombinasi tersebut. Gagasan di balik kombinasi ini adalah [kedaulatan konten](/info/content-sovereignty.html).

<!--i:eti-gauge-->
## Alat masa kini

Setiap cincin menunjukkan seberapa lengkap suatu kategori produk memenuhi satu kebutuhan. Tekan **?** di samping baris untuk melihat buktinya, dan **?** di samping legenda untuk melihat cara kerja skor.

::: figure positioning-comparison
Perbandingan kapabilitas. Riset pesaing dari dokumen vendor, Agustus hingga 21 November 2026. Lolly dan Lolly Work ditinjau pada 21 November 2026. Skor: 0 tidak tersedia, 25 solusi alternatif, 50 ada tetapi aksesnya dibatasi atau hanya sebagian, 75 kuat dengan catatan, 100 kompetensi inti.
:::

::: details Sumber untuk skor yang berubah pada November 2026
- Canva: [catatan perubahan API](https://www.canva.dev/docs/apps/rest-apis/changelog/), [aplikasi layanan](https://www.canva.dev/blog/developers/canva-service-accounts/), [bantuan Brand Controls](https://www.canva.com/help/brand-control/)
- Adobe: [catatan perubahan InDesign API](https://developer.adobe.com/firefly-services/docs/indesign-apis/getting-started/changelog/), [harga Adobe Express](https://www.adobe.com/express/pricing)
- Figma: [kredit agen dan AI](https://help.figma.com/hc/en-us/articles/42614902212887), [server MCP](https://developers.figma.com/docs/figma-mcp-server/)
- Frontify dan Bynder: [catatan rilis Frontify Oktober 2026](https://news.frontify.com/163371-what-s-new-in-october-2026), [Frontify MCP](https://help.frontify.com/en/articles/14787214-frontify-mcp-beta)
- Bannerbear dan Placid: [harga Bannerbear](https://www.bannerbear.com/pricing/), [catatan perubahan Bannerbear](https://www.bannerbear.com/changelog/), [harga Placid](https://placid.app/pricing)
- Penpot: [harga hosting mandiri](https://penpot.app/pricing/self-host), [rilis](https://github.com/penpot/penpot/releases)
- Cloudinary: [provenansi konten](https://cloudinary.com/documentation/content_provenance_and_authenticity), [harga](https://cloudinary.com/pricing)
:::

Fitur dan rekam jejak berada pada baris terpisah. Rilis publik pertama Lolly adalah 1.0.1 pada 30 Agustus 2026, keamanannya belum pernah diaudit secara independen dan bukti adopsinya baru berusia beberapa bulan. [Adopsi & Tata Kelola](/info/adoption-governance.html#status) memuat keadaan terkini.

<!--i:eti-hammer-->
## Kapan memilih Lolly

::: cols
## Pilih Lolly ketika

- Jenis file yang sama dibutuhkan berulang kali: kartu acara, lencana, sertifikat, peringatan, kartu media sosial
- Banyak file berasal dari satu templat dan tabel nilai, di [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) atau CLI
- Warna, jenis huruf dan aset harus tetap mengikuti design system, bahkan pada kanvas terbuka
- Desain Figma, Penpot, Illustrator, InDesign, Affinity atau PDF yang sudah jadi perlu dibuat dapat disunting dan diproduksi ulang ([Impor desain](/info/design-import.html))
- File harus dibuat di perangkat atau server Anda sendiri

## Pilih yang lain ketika

- Pekerjaannya adalah retouch foto atau ilustrasi yang terperinci
- Anda sedang mendesain dan membuat prototipe antarmuka aplikasi
- Anda memerlukan pustaka stok dan templat yang besar dan siap sejak hari pertama
- Anda memerlukan layanan terkelola dengan rekam jejak panjang pada skala besar
:::

Desain yang diimpor dan token desain bersama memungkinkan tim menggabungkan Lolly dengan aplikasi khusus, sementara Lolly Work mengatur aset bersama, peninjauan dan pengiriman.

Untuk tim dengan DAM yang terkurasi, mulailah dengan tetap mempertahankan pustaka tersebut dan administratornya. [Pengalaman SUSE dengan Brandfolder](/info/suse-brandfolder.html) mencatat bagaimana integrasi mendukung adopsi dan pengelolaan perubahan persetujuan. Vendor DAM dan mitra implementasi dapat mengevaluasi pengaturan yang sama melalui [alur kerja mitra](/info/dam-partners.html).

Di **Lolly Markdown Slides**, seluruh deck ditulis sebagai data, ditata secara langsung dan diekspor sebagai file PowerPoint native yang dapat disunting.

![Lolly Markdown Slides dalam tampilan terbagi: slide deck dicantumkan sebagai blok di kiri, hasil render deck yang telah ditata di kanan](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

<!--i:eti-shield-check-->
## Aturan ada di dalam alat

Lolly menempatkan aturan merek yang dapat digunakan ulang di dalam alat: warna, font, margin bleed, jarak dan input yang diizinkan. Templat mengunci bagian yang tidak boleh diubah penerima. Lolly Work menambahkan akses grup dan kebijakan input di seputar templat itu, dengan rantai persetujuan untuk pengajuan katalog dan pengiriman.

Memeriksa alat sekali memudahkan produksi berulang, karena setiap keluaran mewarisi aturan tata letaknya. Teks, gambar yang diunggah dan hak penggunaan mungkin masih perlu diperiksa, dan Lolly Work menyediakan katalog bersama dan langkah persetujuan untuk itu. Bagi tim kreatif, alat menjadi pagar pengaman: Anda tetap menyediakan data, teks dan gambar, dan alat menjaga setiap hasil tetap sesuai merek.

![Seluruh tugas pembuat: mengetik kata-katanya. Jenis huruf, warna dan jarak sudah ditetapkan saat alat dibuat](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Tiga perbedaan lainnya:

- **File akhir, dari input.** Input masuk, file jadi keluar, tanpa "sekarang simpan dari alat desain Anda dan rapikan".
- **Alat menyusun alat.** Satu alat dapat menyematkan render alat lain dalam satu file jadi, tanpa ketergantungan kode di antara keduanya.
- **Sumber terbuka.** Engine bersumber terbuka, dan alat, aset serta token desain adalah file yang dapat Anda simpan dalam kontrol versi atau kelola di Lolly Work, bukan baris di database milik orang lain.

Desain yang berani tetap bisa berkembang di dalam pagar pengaman. Peta kota berkualitas poster ini berupa path jalan dan perairan vektor sejati, dari sebuah dropdown dan dua field warna yang tidak dapat diarahkan ke luar design system:

![Lingkar kanal dan jaringan jalan Amsterdam digambar dari tepi ke tepi dengan warna design system itu sendiri, setiap goresan ditempatkan oleh templat alih-alih dengan tangan](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

<!--i:eti-stamp-->
## Berinovasi secara probabilistik, tingkatkan skala secara deterministik

Sebagian besar tawaran "kreativitas AI" menempatkan model di sisi yang salah dari batas yang sudah lama ada. Para juru tulis dan pelukis iluminasi telah menetapkan letak batas itu. Anda bekerja bebas pada sketsa, tempat apa pun dapat dicoba dan belum ada yang ditetapkan. Lalu Anda beralih ke mesin cetak, yang menetapkan hasilnya. Sketsa adalah tempat seni diciptakan, dan mesin cetak adalah sarana penyebarannya, dan karya cetak dapat dipercaya karena mesin cetak menepati janjinya pada setiap tarikan.

Lolly adalah mesin cetaknya. Gunakan apa pun yang Anda suka untuk mengembangkan ide, model, desainer atau gambar kasar, tetapi saat sebuah ide harus menjadi banyak file, ide itu melewati sesuatu yang merender dengan cara yang sama setiap kali, dari input yang dapat dibaca kembali oleh siapa pun. Perbandingan di atas sebenarnya membahas siapa yang membuat langkah penetapan hasil itu dapat diulangi.

> Percayai proses kreatif, tingkatkan skala dengan ketelitian.

<!--i:eti-tag-->
## Gratis selamanya

**Jika dirender di perangkat Anda, gratis selamanya.** Engine, shell, alat dan formatnya bersumber terbuka, dan versi yang telah dirilis tidak dapat ditarik kembali. Lolly Work juga bersumber terbuka. Organisasi membayar infrastruktur dan operasional yang dipilihnya, tanpa biaya lisensi perangkat lunak per pengguna atau per render untuk hosting mandiri. [Pertanyaan & jawaban](/info/faq.html) menceritakan kisah di balik janji tersebut.

<!--i:eti-map-pin-->
## Tempat konten Anda berada

Pekerjaan kreatif Lolly dapat berjalan di perangkat keras milik Anda, dan token desain, font, logo serta alatnya adalah file yang dapat Anda simpan. Dengan Lolly Work, proyek bersama, aset, kebijakan dan catatan audit berada di penyimpanan yang dikonfigurasi organisasi Anda. [Kepercayaan](/info/trust.html) menjelaskan mengapa hal itu penting, dan [Kebijakan Privasi](/info/privacy.html) serta [Verifikasi Sendiri](/info/verify-yourself.html) memungkinkan Anda memeriksa klaim tersebut alih-alih sekadar mempercayai kami.

<!--i:eti-grid-->
## Alat per alat

[Perbandingan Lolly, alat per alat](/info/compare.html) membandingkan Lolly dengan Canva, Adobe, Figma, Penpot, portal merek, API render dan konverter online, masing-masing satu halaman, serta menjelaskan [apa yang berjalan di mana](/info/compare.html#what-runs-where).
