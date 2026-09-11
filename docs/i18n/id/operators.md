# Lolly untuk Operator

Anda mendapat kesempatan menjadi orang yang berkata ya pada sesuatu yang aman sekaligus populer. Anda menutup sebuah celah eksfiltrasi, memperoleh kapabilitas, dan menghapus sebuah antrean permintaan dalam satu langkah, yang merupakan kemenangan keamanan langka yang membuat Anda lebih disukai, bukan sebaliknya: tidak ada telepon jam 3 pagi karena berkas embargo sampai ke sebuah alat web sembarangan, lebih sedikit vendor dan kontrak di meja Anda, dan sebuah catatan yang bisa Anda tunjukkan saat seseorang bertanya. Pilih jalur di bawah yang sesuai dengan fungsi yang Anda tanggung jawabi.

Anda mengatur seluruh estafet: seorang kreatif menyusun aturannya dan seorang developer menskalakannya, dan operatorlah yang membuat itu aman dijalankan di seluruh organisasi, yang diikuti dari ujung ke ujung oleh [Siklus hidup sebuah kampanye](/info/overview.html#the-lifecycle-of-a-campaign).

Baru di sini? [Adopsi & Tata Kelola](/info/adoption-governance.html) adalah rollout secara lengkap. [Deployment](/info/deployment.html) mencakup deploy, serve, dan hybrid, dan [Configuration](/info/configuration.html) adalah yang membentuk satu instans.

## Penjualan

Datanglah ke rapat dengan tepat berkas yang Anda butuhkan, dibuat dalam perjalanan ke sana. Masukkan deck yang sudah Anda miliki dan bangun ulang setajam sebuah berkas deck native, tanpa antrean permintaan di antara Anda dan asetnya.

- **[Lolly untuk tim sales](/info/sales.html)** - playbook-nya: memperbaiki deck yang sudah Anda miliki, membangunnya ulang secara native, dan membuat aset satu kali sendiri.
- **[Ekspor & Format](/info/exporting.html)** - sisi deck, PDF, dan gambar dari panel ekspor, saat berkasnya harus terbuka di laptop orang lain.

## Pers

Data langsung menjadi chart, peta, dan tabel yang sudah sesuai dengan house style. Bangun format cerita sekali, lalu gunakan kembali setiap kali cerita itu tayang, untuk cetak maupun layar.

- **[Lolly untuk ruang redaksi](/info/press.html)** - playbook-nya: gaya info-editorial, data langsung masuk, dan output berkualitas publikasi.
- **[Tampilan utilitas](/info/utilities.html)** - spreadsheet dan konverter, untuk langkah sebelum membuat chart.

## Marketing

Setiap ukuran, setiap bahasa, satu source of truth. Tempel sebuah spreadsheet dan dapatkan satu berkas jadi per baris, tanpa agensi di tengah-tengah berkas rutin.

- **[Lolly untuk tim marketing](/info/marketing.html)** - playbook-nya: varian dalam volume besar, lokalisasi, dan apa yang berhenti menjadi bottleneck.
- **[Menggunakan Lolly](/info/using.html#batch-pro-mode)** - batch run itu sendiri: sheet masuk, folder aset keluar.

## Keamanan

Cara biasa pekerjaan kreatif rutin dikerjakan adalah sebuah permukaan liabilitas: berkas dikirim via email ke kontraktor luar, aset brand diunggah ke selusin editor web, data pelanggan ditempel ke situs orang asing hanya untuk membuat sebuah grafik cepat. Lolly adalah respons imun terhadap itu, karena Lolly menggantikan pekerjaannya, bukan menambahkan sebuah kontrol di atasnya: quote card, banner terlokalisasi, dan screenshot yang diredaksi dibuat di perangkat karyawan itu sendiri sesuai brand Anda, sehingga tidak ada yang terunggah selain yang Anda letakkan sendiri, dan setiap hasil dapat direproduksi dari inputnya. Ekspor dapat membawa beberapa lapis catatan kriptografis - sebuah C2PA Content Credential yang ditandatangani oleh sebuah kunci yang dibuat di perangkat dan tidak pernah dapat dibaca di luar perangkat itu, Lolly Imprint yang tak kasatmata, dan sebuah tanda durable opsional yang tetap bertahan melewati penyimpanan ulang - masing-masing bersifat tamper-evident dan dapat dihapus (strippable): sebuah credential menandai sebuah perubahan, bukan mencegahnya, dan justru itulah yang membuat verifikasi sepenuhnya offline menjadi mungkin. Kriptografi dan parser berkasnya sedang melalui hardening tingkat enterprise milik SUSE: segel, penandatanganan di perangkat, dan enkripsi sudah nyata dan dapat dipertanggungjawabkan sekarang, sehingga di mana sebuah kontrak menuntut jaminan tersertifikasi, terapkan itu sebagai defence-in-depth selama proses tersebut berlangsung.

- **[Trust](/info/trust.html)** - setiap klaim yang dibuat situs ini, beserta mekanisme yang menegakkannya di sampingnya.
- **[Keamanan & Verifikasi](/info/security.html)** - standar, primitif, trust model, dan pengujian, ditulis untuk seorang reviewer.
- **[Model Ancaman & Batas Kepercayaan](/info/threat-model.html)** - apa yang dipertahankan Lolly, apa yang secara eksplisit tidak, dan di mana setiap batas berada.
- **[Permukaan Server](/info/server-surface.html)** - inventaris lengkap tentang apa yang berjalan di sisi server (dua komponen opsional) dibandingkan apa yang berjalan di perangkat.
- **[Inventaris Parser](/info/parser-inventory.html)** - setiap parser yang menyentuh sebuah berkas yang dibuka pengguna dan apa yang menjadi target hardening masing-masing.
- **[Verifikasi Sendiri](/info/verify-yourself.html)** - periksa klaim-klaim tersebut terhadap sebuah ekspor sungguhan, langkah demi langkah, tanpa apa pun yang tidak bisa Anda jalankan sendiri.
- **[Kebijakan Privasi](/info/privacy.html)** - pernyataan formal tentang apa yang dikumpulkan, disimpan, dan dikirim, serta apa yang tidak.
- **[Produksi kreatif yang berdaulat](/info/sovereign-production.html)** - deployment air-gapped, jaringan yang bergantung pada persetujuan (consent-gated), dan penandatanganan di perangkat.
- **[Adopsi & Tata Kelola](/info/adoption-governance.html)** - siapa yang menyetujui sebuah alat, bagaimana aturan brand menjadi dapat ditegakkan, dan apa yang didapat dari opsi catalog-as-a-repository.

## Legal

MPL-2.0 tanpa contributor licence agreement, dinyatakan dengan jelas, dengan apa yang tidak diklaim dinyatakan sejelas apa yang diklaim. Content Credentials bersifat tamper-evident dan dapat dihapus (strippable), sehingga halaman-halaman di bawah ini menjelaskan apa yang sebenarnya ditegaskan oleh sebuah tanda tangan sebelum siapa pun menuliskannya ke dalam sebuah kontrak.

- **[Penandaan AI dan EU AI Act](/info/eu-ai-act.html)** - Article 50, Code of Practice yang mengarah ke C2PA dan kesesuaian jujur Lolly dengannya.
- **[Bagaimana Lolly dibandingkan](/info/positioning.html)** - fakta lisensi: MPL-2.0, tanpa contributor licence agreement, dan apa yang sebenarnya menjadi dasar dari "gratis selamanya".
- **[Identitas Content Credentials](/info/content-credentials-identity.html)** - apa yang ditegaskan oleh sebuah credential yang ditandatangani, apa yang tidak, dan nama siapa yang tercantum pada sertifikat.
- **[Data Transfer](/info/data-transfer.html)** - bundel cadangan yang menjadi jawaban atas sebuah permintaan catatan atau serah terima perangkat.

## AI

Agent menyuplai input, tidak pernah sebuah persona. AI membantu saat diminta, apa yang dibuatnya menyatakan demikian, dan pekerjaan Anda membawa nama Anda, bukan nama sebuah model.

- **[Sikap AI Kami](/info/ai-stance.html)** - apa yang Lolly lakukan dan tidak lakukan terhadap konten yang dihasilkan (generated), dan apa yang menegakkan setiap komitmen tersebut.
- **[Dibuat sekali, dirender sama](/info/ai-features.html)** - fitur AI yang dirilis, dan mengapa menciptakan piksel baru ditandai sementara menghapusnya tidak.
- **[Input, bukan impersonasi](/info/input-not-impersonation.html)** - mengapa sebuah agent menyuplai input dan tidak pernah sebuah persona, bagaimana itu ditegakkan, dan apa yang tetap tidak bisa dilakukan oleh sebuah agent nakal (rogue).
- **[Agen AI](/info/ai-agents.html)** - apa yang sebenarnya bisa dijalankan oleh sebuah agent, jika tim Anda sudah mengarahkan salah satunya ke sini.
