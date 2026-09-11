# Bagaimana Lolly dibandingkan

Apa yang dilakukan Lolly yang tidak dilakukan oleh alat kreatif hari ini, dan apa yang sengaja ditinggalkan kepada mereka.

Untuk versi alat demi alat, satu halaman untuk setiap satu Canva, Adobe, Figma, API pemaparan dan penukar dalam talian, lihat [Lolly compared, tool by tool](/info/compare.html). Setiap halaman menyatakan apa yang dilakukan alat lain dengan lebih baik dan apa yang dilakukan Lolly sebaliknya.

> **Status pilot:** Lolly adalah prototaip pilot tertutup, bukan produk siap, dan keselamatannya kini sedang menjalani pengukuhan infrastruktur ketat SUSE, bersiap sedia untuk skala perusahaan. Halaman [Adoption & Governance](/info/adoption-governance.html#status) merangkumi keadaan semasa.

## Alat hari ini

Setiap gelang di bawah menilai sejauh mana lengkapnya sesuatu kelas produk menyampaikan keupayaan **seperti yang dihantar hari ini** - bukan seperti yang dipasarkan - dengan setiap kelas dinilai berdasarkan wakil terbaiknya. Lolly dinilai dengan pisau yang sama: ia mengambil satu-satunya gelang merah pada papan, untuk kematangan. Buka nama baris untuk sebab di sebalik skornya. Lajur disusun mengikut baris kelengkapan Keseluruhan di bahagian atas - min bagi baris yang dinilai, dengan baris perbelanjaan dikecualikan.

::: figure positioning-comparison
Kelengkapan keupayaan merentasi alat kreatif hari ini, dikaji pada Ogos 2026. Pemarkahan: 0 tiada, 25 gred jalan pintas, 50 nyata tetapi terhad atau separa, 75 kukuh dengan kaveat, 100 kecekapan teras.
:::

**Nota penilaian.** Skor Lolly mengandaikan tuntutannya yang diterbitkan adalah benar, itulah sebabnya kematangan adalah satu-satunya gelang merahnya: pilot tertutup, pengukuhan keselamatan sedang berjalan, belum diaudit lagi. Penyelidikan menggerakkan beberapa sel.

Canva dinilai berdasarkan ahli keluarganya yang terbaik bagi setiap baris, kerana ia memiliki Affinity dan Cavalry (kedua-duanya diberikan percuma Oktober 2025). Pemaparan luar talian dan pada peranti mendapat 75 melalui Affinity - suite desktop yang masih memerlukan akaun yang disahkan dan membawa telemetri, potongan yang turut dikenakan kepada Adobe - manakala mod luar talian Canva sendiri hanya mengedit reka bentuk yang telah diselaraskan terlebih dahulu, satu peranti, tetingkap terhad. Autofill mendapat 50: sebenar tetapi berkunci-Enterprise, tak segerak, teks dan imej sahaja. Penjanaan pukal Figma naik daripada 25 kepada 50 apabila Buzz menghantar isian hamparan (beta percuma, Ogos 2026).

Satu peraturan mengawal papan ini: Penuh (100), pada baris yang menyentuh kandungan atau identiti anda, memerlukan keupayaan yang boleh anda guna tanpa akaun dan tanpa prasyarat awan; baris yang menerangkan produk itu sendiri (kematangan, kemudahan penggunaan) dikecualikan. Ini merugikan Adobe pada asal-usul (provenance): C2PA yang paling luas dihantar (Photoshop, Lightroom, Premiere, Firefly) menandatangani secara setempat dan dalam awan, tetapi tidak pernah tanpa akaun dan identiti Adobe, jadi 75. Ini turut mengehadkan API pemaparan pada penjanaan pukal dan automasi atas sebab yang sama.

Asal-usul 75 Lolly mencerminkan penandatanganan luar talian pada peranti: lebih kukuh dari segi seni bina tetapi belum diaudit, dan kunci peranti dibaca sebagai tidak disahkan dalam pengesah sedia ada sehingga identiti atau CA milik organisasi sendiri menjaminkannya. 50 Penpot datang melalui plugin Lolly Export rasmi: penandatanganan enjin yang sama, opt-in, didedahkan sebagai milik Lolly sendiri. Penpot juga mengambil satu-satunya gelang di luar skala pada papan, 90 pada pemaparan pada peranti - kanvas pelayar, simpan ke awan berdaulat anda sendiri (malah komputer riba), eksport peribadi; hanya lompatan pelayan yang memisahkannya daripada Lolly. Cloudinary mendapat lajurnya sendiri: saluran paip media (DAM, API transformasi, CDN), dan satu-satunya lajur awan yang menghantar C2PA (50, kerana fl_c2pa menandatangani semasa penghantaran, mengesahkan delivered-by-Cloudinary, bukan made-by-you).

Kerjasama langsung berjalan sebaliknya: Figma menetapkan penanda aras skala (200 penyunting) dan P2P berpasangan, tersekat udara (air-gapped) milik Lolly mendapat Separa. Harga adalah anggaran, dilabelkan sedemikian: pengiraan harga senarai atas gabungan kerusi yang realistik, sengaja luas, untuk skala bukan perolehan. API pemaparan mendapat 75 pada kekangan: templat terkunci, tiada lapisan tadbir urus jenama.

Jurang itu: tiada apa yang dihantar hari ini adalah kekangan-dahulu dan luar talian tanpa akaun dan tanpa pelayan dalam laluan pemaparan, dan tiada siapa yang menyalin klausa akaun itu. Lolly kini menghantar kanvas terbuka miliknya sendiri - **Design**, kanvas bebas manipulasi langsung - tetapi warna, jenis huruf dan aset padanya patuh kepada global jenama, jadi walaupun susunan bebas kekal kekangan-dahulu.

Apa yang Lolly masih **bukan** adalah suite reka bentuk tanpa kekangan; pereka bentuk akan terus menggunakan Illustrator dan Figma untuk kerja khusus - dan apabila kerja itu perlu menjadi aset yang ditadbir urus dan boleh dihasilkan semula, [Import a design](/info/design-import.html) pada alat Design membawa fail Figma, Penpot, Illustrator, InDesign atau PDF yang telah siap ke atas kanvas sebagai kotak yang boleh disunting dan patuh jenama.

![Kanvas bebas Design, di mana warna, taip muka dan aset yang ditawarkan adalah milik jenama sendiri](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&dark=1&filename=aud-open-canvas)

## Guna untuk

- Penjanaan pantas aset kreatif yang dioperasikan (jubin acara, lencana, tandatangan, amaran)
- Susunan bebas bentuk pada kanvas terbuka (Design) apabila kepingan - warna, jenis huruf, ikon, imej - perlu kekal patuh kepada global jenama
- Membawa masuk reka bentuk Figma, Penpot, Illustrator, InDesign atau PDF yang telah siap (Import a design pada alat Design) supaya ia boleh disunting, ditadbir urus dan dipapar semula secara deterministik dalam setiap format Lolly
- Aliran "isi tiga medan, dapatkan aset siap" satu-kepada-ramai - termasuk larian pukal daripada hamparan/CSV dalam grid kelompok `/pro` (tampal atau import baris, satu aset siap bagi setiap baris, muat turun sebagai zip)
- Output berjenama yang sentiasa aktif dan berulang
- Perkara di mana kawalan berpusat terhadap ekspresi jenama lebih penting berbanding fleksibiliti ekspresif

Deck Studio adalah ukuran yang baik bagi siling di sini: keseluruhan dek slaid diisytiharkan sebagai data, disusun atur secara langsung pada kanvas dan dieksport sebagai PowerPoint asli yang boleh disunting.

![Deck Studio dalam paparan berpecah - slaid dek disenaraikan sebagai blok di sebelah kiri, pemaparan dek yang telah disusun atur di sebelah kanan](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Jangan guna untuk

- Kandungan hero khusus atau unggulan (papan iklan, video besar)
- Kerja kempen unik yang benar-benar memerlukan pereka bentuk
- Penjanaan idea yang perlu keluar sepenuhnya daripada sistem jenama - kanvas terbuka Lolly masih mematuhi warna, jenis huruf dan aset kepada global jenama, dan itulah intinya

## Berinovasi secara kebarangkalian, berskala secara deterministik

Kebanyakan pitching "kreatif AI" meletakkan model di sisi yang salah pada satu garisan lama. Jurutulis dan penghias manuskrip sudah pun menetapkan di mana garisan itu jatuh: anda bekerja secara longgar pada lakaran, di mana apa sahaja boleh dicuba dan tiada apa yang komited, kemudian anda pergi ke mesin cetak, yang menggerunkan justeru kerana ia komited. Lakaran itulah tempat seninya berada. Mesin cetak itulah caranya ia diperjalankan. Dua alat, dua tugas, masing-masing inventif dengan caranya sendiri, dan karya cetakan itu boleh dipercayai kerana mesin cetak menepati janjinya pada setiap tarikan.

Lolly adalah mesin cetak, bukan lakaran. Bawa apa sahaja yang anda suka kepada penjanaan idea - model, pereka bentuk, tisu napkin - tetapi sebaik sahaja sesuatu idea perlu menjadi sepuluh ribu aset, ia melalui sesuatu yang memaparkan dengan cara yang sama setiap kali, daripada input yang boleh dibaca semula oleh sesiapa sahaja. Itulah sebenarnya inti perbandingan di atas: bukan siapa mempunyai penjana yang lebih baik, tetapi siapa yang menjadikan langkah komited itu boleh dihasilkan semula.

> Percayai proses kreatif, skala dengan ketelitian.

## Luluskan alat, bukan fail

Setiap alat lain di papan menghasilkan *fail* yang kemudian perlu disemak - pengurus jenama dalam satu bebenang Slack, bahagian undang-undang pada penafian, satu pusingan perubahan, satu lagi semakan. Lolly menggerakkan kelulusan **satu langkah ke hulu**. Peraturan jenama - kod hex yang tepat, fail fon berlesen, jidar bleed, jarak - dikodkan keras ke dalam HTML dan CSS alat tersebut, jadi templat itu *tidak boleh* menghasilkan aset yang terkeluar daripada jenama. Susun atur itu sendiri yang menguatkuasakannya.

Jadi anda berhenti meluluskan output dan mula meluluskan **alat** yang menghasilkannya. Luluskan sekali, dan setiap aset yang pernah dihasilkannya telah diluluskan terlebih dahulu secara binaan - tiada manusia dalam gelung, tiada kitaran semakan, pada sebarang jumlah.

Inilah perubahan yang sebenarnya dibawa oleh enjin deterministik: ia bukan versi lebih pantas bagi proses kelulusan lama, ia menghapuskan proses itu. Bagi pasukan kreatif, ia adalah pagar keselamatan, bukan penggantian - anda masih melontar bola (data, teks, imej) dan kod itu ialah lorong bumper yang memastikan setiap lontaran tidak jatuh ke dalam parit.

![Seluruh kerja penerbit: taip perkataan. Jenis huruf, warna dan jarak telah ditetapkan apabila alat itu diluluskan](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DApproved&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-approve-the-tool)

| Meluluskan aset cara lama | Meluluskan alat, cara Lolly |
|---|---|
| Setiap fail siap disemak, satu demi satu | Alat itu disemak sekali sahaja |
| Permintaan → pereka bina → semakan jenama → semakan undang-undang → perubahan → semakan semula | Satu perubahan parameter → aset siap |
| Pereka, pengurus jenama, undang-undang dan pemohon semuanya dalam gelung | Penerbit, bersendirian |
| Beberapa hari setiap aset | Beberapa saat setiap aset |
| 10,000 aset = 10,000 kitaran semakan | 10,000 aset = sifar (templat telah pun diluluskan) |

## Apa yang disediakan secara unik oleh ini

- **Potensi reka bentuk yang liar disampaikan dengan selamat dalam konteks.** Alat boleh meluahkan idea reka bentuk yang berani dalam pagar keselamatan yang dikodkan keras.

- **Automasi kandungan ditakrif perisian yang memulangkan aset akhir.** Input → fail akhir. Tiada "sekarang simpan daripada alat reka bentuk anda dan proses pascanya."
- **Alat menggubah alat.** Satu alat boleh membenamkan pemaparan alat lain dan memulangkannya sebagai sebahagian daripada satu aset siap tunggal, tanpa gandingan kod alat-ke-alat - satu primitif yang tiada produk kanvas terbuka atau templat DAM di papan menawarkannya.
- **Neutraliti vendor.** Kawalan penuh ke atas ciri dan kos. Enjin sumber terbuka. Alat dan aset ialah kandungan yang dijejaki git, bukan terkunci dalam pangkalan data SaaS.

Yang pertama itulah yang sering dipandang rendah oleh orang ramai. Peta bandar bertaraf poster, dilukis sebagai laluan jalan dan air vektor sebenar, daripada satu dropdown dan dua medan warna yang tidak boleh diarahkan keluar daripada jenama:

![Gelang terusan dan rangkaian jalan Amsterdam dilukis hujung ke hujung dalam dakwat jenama itu sendiri, setiap lejang diletakkan oleh templat dan bukan tangan](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Kedaulatan kandungan

Ada nama bagi apa yang dihimpunkan oleh seksyen sebelum ini: kedaulatan. Saluran media anda berjalan pada perkakasan yang anda miliki. Jenama anda - token, fon, logo, alat yang menguatkuasakannya - berada dalam fail yang anda pegang, dalam kawalan versi yang anda kawal, bukan dalam pangkalan data vendor dengan butang eksport. Pemaparan berlaku pada peranti di hadapan anda, jadi sesuatu aset tidak pernah melalui pihak ketiga untuk wujud, dan seluruh laluan daripada input hingga fail siap adalah sumber terbuka dan boleh diperiksa. Jika setiap vendor reka bentuk SaaS lenyap esok, penggunaan Lolly tidak akan terjejas.

Ini penting bagi sesiapa sahaja yang kerjanya sepatutnya bertahan lebih lama daripada langganan: ibu bapa yang buku fotonya berada pada komputer riba itu sama pentingnya dengan badan awam yang pustaka jenamanya tertakluk kepada peraturan perolehan. Bagi organisasi - badan awam, industri terkawal, sesiapa sahaja yang jenamanya ialah aset strategik dan bukan hiasan - "di mana kandungan kami berada dan siapa yang boleh mematikannya" ialah persoalan tadbir urus, bukan pilihan peribadi. Kedaulatan di sini ialah sifat seni bina itu sendiri dan bukan ciri pengehosan yang ditambah untuk pematuhan, dan halaman [Privacy Policy](/info/privacy.html) dan [Verify It Yourself](/info/verify-yourself.html) wujud supaya anda boleh menyemak dakwaan itu dan bukan sekadar mempercayainya.

Di sebalik semua itu terdapat satu janji, dinyatakan sebagai komitmen dan bukan ciri: **jika ia dipaparkan pada peranti anda, ia percuma selama-lamanya.** Enjin, shell, alat, format - keseluruhan laluan kreatif pada peranti adalah sumber terbuka dan kekal begitu. Janji itu mempunyai mekanisme: versi yang telah dikeluarkan dilesenkan supaya ia tidak boleh ditarik balik, dan tiada perjanjian penyumbang yang wujud yang boleh melesenkan semula kerja itu kemudian. Keseluruhan sempadan itu muat dalam satu ayat: segala yang dipaparkan pada peranti anda adalah percuma dan sumber terbuka, selama-lamanya; menyelaraskan manusia dan mesin merentasi rangkaian ialah tugas satah kawalan berasingan, [lolly.work](https://lolly.work).
