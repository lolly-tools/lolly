# Lolly dan Penpot

_Terakhir diperiksa: 28 September 2026._

Lolly dan Penpot sama-sama menawarkan alat desain sumber terbuka, token desain bersama, dan kolaborasi langsung. Lolly menggabungkan pembuatan di perangkat dengan [lolly.work](https://lolly.work), layanan organisasinya yang diterapkan secara terpisah.

## Fondasi desain bersama

[Token desain Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) memakai format DTCG, yang juga dibaca Lolly. Warna, tipografi, dan nilai token lainnya dapat dibagikan di kedua alur kerja. [Impor desain](/info/design-import.html) di Lolly membuka ekspor `.penpot` sebagai tata letak yang dapat diedit.

Plugin Lolly Export untuk Penpot dikelola oleh Lolly. Plugin ini memakai mesin Lolly untuk C2PA Content Credentials opt-in di perangkat. Integritas tanda tangan dan kepercayaan pada penandatangan adalah dua hal yang terpisah: verifier memerlukan identitas yang dipercayainya, seperti dijelaskan di [Identitas Content Credentials](/info/content-credentials-identity.html).

## Alur kerja desain dan tim

[Penpot](https://penpot.app/) menyediakan desain antarmuka, komponen, tata letak fleksibel, prototipe interaktif, dan inspeksi pengembang. Penpot menawarkan penerapan ter-hosting dan hosting mandiri, dengan [opsi instalasi Docker dan Kubernetes](https://help.penpot.app/technical-guide/getting-started/).

Kanvas Design di Lolly membuat aset yang dapat diedit dan dapat mengubah tata letak menjadi [alat dengan aturan](/info/create-a-tool.html). Alat yang sama merender di peramban, aplikasi desktop, atau CLI dan dapat menghasilkan varian dari data. Untuk kerja tim, Lolly memiliki [collab pribadi](/info/collaborate.html) dua perangkat secara langsung maupun collab kerja melalui lolly.work, dengan pengeditan bersama, kursor, dan sesi tim yang tersimpan.

## Perbedaan penerapannya

Lolly mandiri merender dan menandatangani di perangkat tanpa akun atau server. lolly.work menambahkan SSO, provisioning SCIM, katalog dan proyek bersama, peran, persetujuan, catatan audit, dan perenderan server. Kedua repositori berlisensi sumber terbuka MPL-2.0 dan dapat dijalankan oleh organisasi. Pekerjaan bersama memakai instans yang dikonfigurasi; pembuatan lokal tetap tersedia secara independen.

Pilihannya bergantung pada pekerjaan: alur kerja desain antarmuka dan prototipe Penpot, produksi aset berulang Lolly, atau kombinasi yang memakai token bersama dan desain yang diimpor. Kolaborasi kerja Lolly saat ini berjalan pada satu node server, dan [status penerapannya](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) perlu menjadi bagian dari evaluasi organisasi.

Penpot adalah merek dagang pemiliknya. Plugin di atas adalah milik Lolly. Lihat [Perbandingan Lolly](/info/positioning.html) dan [ringkasan solusi gabungan](/info/compare.html) untuk perbandingan yang lebih luas.
