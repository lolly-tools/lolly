# Lolly dan portal jenama

_Disemak kali terakhir: 28 September 2026._

Lolly dan [lolly.work](https://lolly.work) bersama-sama merangkumi aliran kerja penciptaan dan tadbir urus yang digunakan pasukan portal jenama untuknya: aset yang diluluskan, templat berkunci, kawalan akses, semakan dan pengedaran. Bandingkan penyelesaian gabungan itu dengan Bynder, Frontify, Marq atau Brandfolder semasa memilih cara orang mencari aset jenama dan menghasilkan aset baharu.

## Perkhidmatan penciptaan dan organisasi

Enjin dan aplikasi Lolly menghasilkan fail. Templat, token reka bentuk dan input yang dibenarkan menentukan perkara yang boleh diubah oleh seseorang, dan pemaparan boleh kekal pada peranti mereka. Lolly kendiri tidak memerlukan akaun.

lolly.work ialah perkhidmatan organisasi dalam projek yang sama, diselenggara dalam [repositori berasingan](https://github.com/lolly-tools/lolly-work) dan digunakan bersama Lolly. Ia menambah identiti, storan kongsi, dasar, kelulusan dan pelaporan. Kedua-dua bahagian ialah sumber terbuka di bawah MPL-2.0. Pengasingan ini membolehkan individu menggunakan Lolly secara bebas dan organisasi menjalankan penyelesaian gabungan pada infrastruktur yang dikawalnya.

## Perkara yang disediakan oleh penyelesaian gabungan

| Keperluan | Lolly + lolly.work |
|---|---|
| Log masuk dan peruntukan | Log masuk tunggal OIDC, berbilang penyedia identiti, peruntukan pengguna SCIM 2.0 dan keahlian kumpulan, serta penyahaktifan akaun yang membatalkan sesi sedia ada. Penyedia identiti SAML sahaja boleh disambungkan melalui jambatan OIDC seperti Keycloak. |
| Templat yang diluluskan | Lolly menentukan input templat yang boleh disunting; lolly.work menggunakan keterlihatan kumpulan dan dasar input yang mengunci nilai, menghadkan pilihan atau menyembunyikan kawalan. |
| Pustaka aset kongsi | Muat naik milik instans, koleksi, metadata tersuai dan katalog berkawalan akses, serta penyambung yang membaca pustaka DAM dan storan sedia ada. |
| Semakan | Langkah kelulusan berurutan, kumpulan pelulus yang layak, peraturan kuorum dan pengasingan tugas; semakan boleh mengawal penyerahan katalog dan penghantaran ke sasaran organisasi. |
| Sejarah dan ketersediaan aset | Versi dan penarikan balik untuk aset milik instans, pengekalan dan penahanan, ketersediaan berjadual, tamat tempoh dan pembatalan. Penyedia yang disambungkan mengekalkan sejarah sumber mereka sendiri. |
| Pelaporan | Bilangan penggunaan dan muat turun aset, aktiviti alat dan eksport, papan pemuka dan jejak audit. Atribusi penggunaan mengikut dasar telemetri penggunaan; tetapan atribusi lalai memerlukan persetujuan. |
| Pengedaran | Pautan yang tamat tempoh dan boleh dibatalkan, koleksi kongsi, akses tetamu dan penghantaran ke destinasi organisasi yang dikonfigurasikan. |

[Panduan operator lolly.work](https://github.com/lolly-tools/lolly-work/tree/main/docs) menerangkan ciri ini dan konfigurasinya. Ia merupakan keupayaan yang tersedia, bukan ciri yang memerlukan sistem lain dibina di sekeliling Lolly.

## Memilih aliran kerja portal

Portal yang mantap menawarkan pengehosan terurus, sokongan dan aliran kerja DAM yang luas. Sebagai contoh, [DAM perusahaan Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) menggabungkan penemuan aset, kawalan akses, aliran kerja kelulusan dan pengedaran. Bandingkan aliran kerja semakan dan hak yang tepat yang anda perlukan: Lolly menyediakan kawalan metadata, akses dan ketersediaan, manakala pelepasan undang-undang dan obligasi lesen masih memerlukan proses organisasi. Rantaian kelulusannya bersiri; ia tidak memodelkan aliran kerja bercabang sewenang-wenangnya.

Tindanan Lolly lebih baharu, dan [halaman status lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) merekodkan had penggunaannya. Khususnya, tapak awam lolly.work ialah kotak pasir penilaian. Penggunaan organisasi yang berkekalan memerlukan storan berterusan dan seorang operator. Tiada caj lesen perisian setiap pengguna untuk hos kendiri; infrastruktur dan pentadbiran tetap memerlukan kos.

DAM sedia ada juga boleh kekal sebagai sumber kebenaran. Penyambung katalog lolly.work menjadikan asetnya yang diluluskan tersedia dalam Lolly, tempat orang mencipta fail baharu di bawah peraturan organisasi. Itu ialah pilihan integrasi; pustaka dan kelulusan Lolly sendiri tersedia apabila organisasi mahu menguruskan aliran kerja itu sendiri.

Lihat [Perbandingan Lolly](/info/positioning.html) untuk perbandingan keupayaan dan [Lolly dibandingkan, alat demi alat](/info/compare.html) untuk bahagian lain set ini. Nama vendor mengenal pasti produk yang dibandingkan; Lolly tidak berafiliasi dengan mereka.
