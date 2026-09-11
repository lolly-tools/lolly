# Soalan Lazim

Soalan lazim yang dipaparkan dalam akordion pada halaman pendaratan `/info`.

**Cara menyelenggara:** setiap tajuk `##` di bawah ialah satu soalan; segala yang berada
di bawahnya (sehingga `##` berikutnya) ialah jawapannya. Jawapan menggunakan markdown
ringan yang sama seperti bahagian lain laman ini - pisahkan perenggan dengan satu baris
kosong. Tambah, buang atau susun semula soalan di sini dan jalankan semula `npm run build:info` (atau `npm run dev:web`).
Segala yang di atas `##` pertama (tajuk ini dan nota ini) diabaikan oleh binaan.

## Apa yang berlaku apabila saya opt-in pada halaman /profile?

Apabila anda mula-mula menggunakan Lolly, segala yang anda taip di mana-mana adalah peribadi sepenuhnya sehinggalah anda sendiri mahu maklumat itu keluar melalui media atau pautan kongsi (jika dalam talian).

Apabila opt-in dipilih, butiran profil yang anda pilih akan dimeterai ke dalam apa yang anda hasilkan, menamakan anda sebagai sumbernya. Tiada apa-apa disertakan tanpa anda memilihnya.

Lolly menghasilkan kandungan dalam jumlah yang besar. Kami mengambil pendekatan peminimuman data yang ketat untuk mengelakkan risiko.

## Adakah Lolly "vibe coded"?

Lolly dibangunkan dengan pengekodan berbantukan AI, penemuan berbantukan AI dan, di banyak tempat, kandungan berbantukan AI, menggunakan pelbagai model dan vendor, termasuk daripada syarikat cloud awam terkemuka.

Setakat penulisan ini, Lolly tidak mempunyai sebarang kelemahan keselamatan yang diketahui dalam rantaian bekalannya, dan komited kepada amalan tindak balas keselamatan yang pantas apabila CVE muncul.

Seorang manusia mencipta senibinanya, mengkurasi kodnya dengan sengaja dan mengarah seni pengalaman itu.

Yang lebih penting, Lolly berdiri di atas bahu inovasi open source berdekad-dekad daripada pakar sebenar di seluruh dunia.

Terdapat build-gate deterministik dalam kod asas Lolly untuk memastikan kod dan dokumentasi kekal koheren bagi pembaca purata dan "membersihkan slop" daripada pengalaman itu. Ini mungkin menyukarkan enumerasi sintetik proprietari terhadap asal-usulnya. Itu tidak disengajakan.

**Pendedahan AI generatif:**

- **Kod yang ditulis LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next (senarai ini mungkin berkembang)
- **Penemuan LLM:** Gemini 3.1, Fable
- **Dokumentasi:** Sonnet 5
- **Pustaka open source:** pengarang masing-masing, dinyatakan dalam SBOM, komen dan pengepala fail

Senarai ini tidak termasuk model yang divendorkan ke dalam Lolly.

**Sumbangan manusia:**

- **Senibina:** Andy Fitzsimon
- **Arahan seni:** Andy Fitzsimon
- **Kod yang ditulis manusia:** Andy Fitzsimon
- **Penjanaan idea, semakan dan maklum balas:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, Komuniti Penpot (senarai tidak lengkap)

## Apakah itu feature flags?

Feature flags menghidupkan atau mematikan bahagian-bahagian Lolly. Biasanya pentadbir yang mengawalnya - dengan Lolly, anda yang mengawal.

![Setiap feature flag ialah suis milik anda, terletak dalam profil anda sendiri dan bukan dalam konsol pentadbir](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Bagaimana saya mendapatkan apl mudah alih atau desktop?

Sesiapa sahaja boleh mengedarkan apl mereka sendiri, dan alat serta konfigurasi apl itu sepatutnya berbeza-beza mengikut khalayak yang disasarkan. Jadi tiada satu apl tunggal melainkan anda yang membinanya atau seseorang yang berkaitan memberikannya kepada anda.

## Kenapa nama "Lolly Tools"?

**Lolly** kerana kebebasan itu manis, dan kerana di Australia, New Zealand dan Britain, lolly bermaksud gula-gula.

**Tools** kerana sesuatu alat hanya terletak diam sehingga anda mengambilnya. Ia tidak berjalan ketika anda tidak menggunakannya, dan ia tidak memerhati anda ketika anda menggunakannya.

## Apakah halangan yang mungkin saya hadapi apabila menerima pakai Lolly?

Lolly masuk di mana-mana tempat anda sudah menjana fail - CLI ialah enjin yang sama
dengan Apl, jadi saluran paip yang berjalan pada pukul 2 pagi tidak boleh terpesong
daripada apa yang dipratonton seseorang dalam pelayar. Geseran untuk menerima pakai jarang bersifat teknikal; ia bersifat organisasi. Jangkakan perkara berikut:

**Katalog jenama yang terkurasi perlu dikarang.** Lolly ialah platform, bukan pek
templat anda yang sudah siap. Untuk *pelancaran yang ditadbir*, seseorang perlu
mentakrifkan katalog aset dikongsi (logo, palet, fon sebagai ID kekal) dan menulis
manifest + templat bagi setiap jenis output. Namun individu tidak perlu menunggu semua
itu - dalam apl terbuka, sesiapa sahaja boleh memasukkan fail mereka sendiri ke dalam
katalog dan membina alat dalam Design sejak hari pertama.

**Tiada git diperlukan untuk menyumbang.** Pereka membina alat dan templat mereka
sendiri dalam apl, kemudian berkongsinya dengan rakan sekerja atau menghantarnya kepada
sesiapa yang menguruskan pemasangan itu untuk dimasukkan secara lalai.

**Ia memang sengaja sempit - bingkaikan ia begitu.** Lolly bukan untuk kandungan tempahan
khas atau kandungan hero. Ia *memang* DAM peribadi anda - dihidupkan dan diperkasakan oleh
sistem reka bentuk, alat dan katalog anda - dan ia *memang* mempunyai kanvas terbuka
(Design), tetapi di situ pun warna, tipografi dan aset mematuhi global reka bentuk yang
aktif, jadi susunan bebas kekal di dalam sistem. Jika dinilai berbanding Figma atau Canva
ia akan kelihatan terhad. Jika dinilai sebagai apa yang sebenarnya - penjanaan aset yang
beroperasi, berulang dan berskala besar - tiada apa yang menandinginya. Bingkai yang salah ialah halangan yang paling biasa.

**Pengurusan perubahan di pihak penghasil.** Proses sedia ada berfungsi hari ini, walaupun
hasilnya tidak menepati jenama. Mengalihkannya kepada enjin ini bermakna ujian semula dan pembelajaran semula,
dan "kami memang sudah boleh membuat fail" menjadi alasan untuk tidak berpindah. Mulakan dengan menukar
satu output berkualiti produksi yang paling ketara dan tunjukkan keadaan sebelum/selepas bersebelahan.

Lolly mengangkat semuanya.


## Apa yang membezakan utiliti daripada alat?

**Jawapan Ringkas →** Utiliti tidak semestinya perlu merender, jadi ia boleh mendapat UX yang berbeza. 

**Jawapan Sebenar →** Sebab utiliti boleh dihoskan di dalam Lolly Tools ialah untuk menambah satu lagi 'lapisan kemudahan' pertahanan bagi menghilangkan galakan untuk penyaluran keluar data. 

Kenapa? Kerana sudah diketahui bahawa setiap hari, orang mengambil **kandungan sulit yang sudah ada pada mereka** dan menyerahkannya kepada
laman web rawak untuk melakukan satu operasi mekanikal yang kecil:

- "**Mampatkan PDF ini**" → memuat naik kontrak / slip gaji / dek lembaga pengarah kepada entiti yang tidak diketahui.
- "**tukar HEIC kepada JPG**" → memuat naik foto peribadi (dengan GPS EXIF) kepada hos yang dibiayai iklan
- "**pangkas / ubah saiz imej ini**" → memuat naik tangkapan skrin produk atau aset yang belum dilancarkan
- "**formatkan JSON ini**" / "nyahkod JWT ini" → menampal respons API, token, rahsia ke dalam pemformat
- "**cantumkan PDF ini**" → memuat naik **dua dokumen yang sepatutnya tidak pernah berkongsi pelayan**

Laman-laman ini dan ekor panjang klonnya yang sangat banyak **tidak boleh dipercayai secara lalai** - dengan
penyimpanan yang tidak diketahui, bidang kuasa yang tidak diketahui, subpemproses yang tidak diketahui dan model
perniagaan iklan/afiliasi yang punya segala insentif untuk menyimpan apa yang anda berikan. Operasinya
remeh; **kandungan itulah kosnya.** 

Kita memenangi perang tadbir urus ini dengan kemudahan dan perkhidmatan yang cemerlang. 

![Paparan Utilities mengumpulkan kerja mekanikal yang biasanya diserahkan orang kepada laman web rawak, semuanya berjalan di dalam Lolly sebaliknya](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Bolehkah Lolly menyunting dan merender fail Figma, Penpot, Illustrator atau InDesign saya?

Ya. Buka **Design** dan klik **Import a design**: ia menerima fail asli Figma **.fig** (Save local copy), eksport Penpot **.penpot**, fail Illustrator **.ai** atau **.pdf**, fail InDesign **.idml** (File → Export → InDesign Markup) atau **sebarang SVG** (pintu paling luas - hampir semua apl reka bentuk mengeksportnya). Tiada akaun, tiada pemalam dan tiada lesen apl reka bentuk diperlukan.

![Design's open canvas - Import a design sits in the toolbar's Lolly menu](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

Lapisan tiba sebagai kotak yang boleh disunting pada kanvas terbuka: teks kekal boleh ditaip semula, bentuk kekal sebagai bentuk, imej masuk ke pustaka imej anda sendiri dan tipografi serta warna mematuhi global jenama. Simpan ia dan susun atur itu menjadi templat boleh guna semula yang beralamat URL, yang boleh diisi semula oleh sesiapa sahaja yang mempunyai Lolly - dan anda boleh mencampurkan alat langsung (kod QR, carta) yang dirender semula semasa dimuatkan. Dari situ ia dirender seperti apa-apa sahaja yang lain dalam Lolly - SVG, PDF, PNG dan selebihnya, boleh dihasilkan semula daripada URLnya. Lihat [Import a design](/info/design-import.html).

## Bolehkah saya berkongsi hasil kerja saya sebagai fail dan bukan pautan?

Ya. Apabila satu pautan tidak mampu membawa semuanya (foto anda sendiri, teks yang panjang), dialog Share menyatakan dengan tepat apa yang akan hilang dan menawarkan fail **.lolly** sebagai ganti: satu fail yang memuatkan reka bentuk itu, imej yang digunakannya dan, jika anda mahu, alat itu sendiri. Anda yang menentukan berapa banyak yang dibawa - nama dan butiran anda hanya dimasukkan jika profil anda opt-in, karya berlesen ditahan melainkan anda menyertakannya, dan sesiapa yang membuka fail yang membawa sesuatu alat akan ditanya sama ada mereka mempercayainya sebelum ia boleh berjalan. Lihat [Berkongsi hasil kerja anda](/info/using.html#sharing-your-work).

## Bolehkah dua orang bekerja pada reka bentuk yang sama tanpa internet?

Ya. Seorang berkongsi jemputan (pautan, kod QR atau kod pendek), seorang lagi menerimanya, dan kedua-dua peranti memegang sesi yang sama secara langsung - kehadiran, gelang fokus dan semuanya. Ia berfungsi pada mana-mana rangkaian yang dikongsi, termasuk hotspot telefon di dalam bilik bawah tanah, kerana tiada pelayan di tengah-tengah. Lihat [Bekerja bersama](/info/collaborate.html).

## Ke mana perginya alat berjenama SUSE?

Semuanya sudah pun berada dalam repositori peribadi yang berasingan. Klon awam langsung tidak mengambil pek jenama SUSE, jadi binaan awam menjalankan profil neutral `lolly-start` - alat komuniti yang tidak terikat jenama serta satu jenama kosong yang anda isi dengan jenama anda sendiri. SUSE mengendalikan instansnya sendiri untuk melindungi tanda dagangannya.

## Kenapa ia percuma? Apa muslihatnya?

**Kami membina Lolly untuk diri kami sendiri.** SUSE memerlukan beribu-ribu fail yang menepati jenama, setiap satunya dengan namanya dimeterai di dalam, dihasilkan tanpa menyerahkan apa-apa kepada perkhidmatan luar. Jadi kami membina alat yang melakukan semuanya pada peranti, dan melepaskannya sebagai sumber terbuka, seperti semua yang lain kami hasilkan. Kami terus menyelenggaranya kerana kami menggunakannya setiap hari. **Tiada apa-apa kewajipan:** semua yang ada di sini berfungsi dengan atau tanpa kami.

Garisan itu ditetapkan dalam lesen, bukan dalam janji: apa sahaja yang berjalan secara setempat adalah percuma, selama-lamanya. Versi yang telah dilepaskan dilesenkan supaya ia tidak boleh ditarik balik, dan tiada perjanjian penyumbang yang boleh melesenkan semula hasil kerja sesiapa. Lihat [pemposisian](/info/positioning.html) untuk kenyataan penuh.

## Berapa banyak yang SUSE simpan secara peribadi? (iaitu bila tikar akan ditarik dari bawah kaki)

Enjin, shell, skema dan alat yang tidak terikat jenama adalah sumber terbuka; tanda dagangan SUSE dan alat berjenamanya ialah bahagian yang kekal peribadi, dan semuanya sudah pun diasingkan. Instans awam di [lolly.tools](https://lolly.tools) berjalan atas jenama kosong.

Sempadan itu bersifat struktur, bukan sekadar janji. Setiap versi yang dilepaskan adalah sumber terbuka dan tidak boleh dinyahlepaskan, tiada perjanjian penyumbang yang boleh melesenkan semula hasil kerja sesiapa, dan satu-satunya perkara yang ditahan ialah tanda dagangan. Apabila sebuah syarikat lain menutup sumber Linux perusahaannya pada 2023, SUSE menjadi pengasas bersama [OpenELA](https://openela.org) untuk mengekalkan kod itu terbuka - pendirian yang sama diwarisi oleh projek ini.

Pendedahan penuh: SUSE *memang* sedang membina perkakas dalaman untuk menyepadukan Lolly dalam sistem ITnya - itu tentang susunan dalaman SUSE, bukan pembangunan awam lawan peribadi. Lolly juga menyasarkan untuk dibina melalui [Open Build Service](https://openbuildservice.org/), dengan artifak rantaian bekalan yang selamat disampaikan oleh [SUSE Application Collection](https://apps.rancher.io/applications).

## Logo Lolly itu perisa apa?

Ada yang kata Limau Nipis, ada yang kata Pudina dan kadangkala Epal, Lolly membawa manisnya, anda yang mewujudkan perisanya!
