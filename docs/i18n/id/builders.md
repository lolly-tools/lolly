# Lolly untuk Pembangun

Dokumentasi teknis - untuk siapa pun yang membuat tool, mengintegrasikan Lolly ke dalam sebuah pipeline, meng-host-nya sendiri, atau memperluas platform ini.

**Apa manfaatnya bagi Anda.** Bangun sebuah tool sekali dan permintaan itu berhenti kembali kepada Anda. Permintaan berulang "bisa tolong buatkan saya…" yang menghabiskan sore hari Anda berubah menjadi template yang diisi sendiri oleh orang lain - dengan benar, tanpa melibatkan Anda. Karya Anda adalah HTML/CSS/JS biasa: terkontrol versi, dapat di-diff, dapat ditinjau, dan berjalan di atas engine terbuka tanpa vendor lock-in, sehingga tetap menjadi milik Anda. Otomatiskan proses produksi dan waktu Anda tercurah untuk masalah yang menarik, bukan untuk ekspor yang kesepuluh ribu.

Lolly adalah **engine** yang agnostik terhadap platform dan menjalankan jalur render yang sama di beberapa **shell** (web PWA, Tauri desktop/mobile, CLI, TUI). Tool adalah **data, bukan kode yang di-bundle** - sebuah manifest ditambah template ditambah hook opsional - sehingga tool baru dirilis tanpa pembaruan aplikasi. Mulailah dengan [Ikhtisar](/info/overview.html) untuk arsitekturnya, lalu ikuti jalur yang sesuai dengan apa yang sedang Anda bangun.

Baru mengenal platform ini? **[Mulai Cepat](/info/quickstart.html)** menyiapkan sebuah brand dan render pertama Anda sebelum Anda mendalaminya lebih jauh.

## Memahami arsitektur



- **[Ikhtisar](/info/overview.html)** - mengapa Lolly ada, pemisahan engine/shell/tools, capability bridge, dan komitmen arsitektur yang sudah ditetapkan.
- **[Token Desain](/info/design-tokens.html)** - model token DTCG yang digunakan untuk mengekspresikan brand, dan bagaimana tool mengonsumsinya.

## Membuat tool

Setiap kontrol di bawah dihasilkan dari input yang dideklarasikan di `tool.json`. Anda menulis satu baris manifest, host menggambar widget-nya, dan model yang sama itu menjalankan CLI maupun URL.

![One declared input, one generated control: a url, a colour, a select, a number, a boolean](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&height=900&dpi=192&waitMs=2000&cropSelector=.tool-inputs&walker=1&format=svg&dark=1&filename=aud-manifest-controls)

Skalanya jauh melampaui lima kontrol. Beri sebuah input properti `section` dan host akan melipatnya, sehingga tool dengan lima puluh input seperti D3 Chart Studio tetap terbuka sebagai daftar pendek, sisanya tersimpan di balik grup-grup bernama.

![The D3 sidebar - a handful of primary controls, then Data, Columns, Chart, Axes and the other sections collapsed into one line each](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=1600&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-d3-sections)

- **[Membuat Tool](/info/authoring-tools.html)** - panduan lengkap: manifest, template, gaya, hook, komposisi, dan publikasi.
- **[Membuat Aset](/info/authoring-assets.html)** - aset katalog, tier, lokal, palet, ikon yang dapat ditema, dan font.
- **[Host API](/info/host-api.html)** - capability bridge `HostV1` yang menjadi dasar penulisan setiap tool (satu-satunya API yang dilihat tool).
- **[Mode URL](/info/url-mode.html)** - setiap input sebagai parameter URL; parameter cadangan, encoding ringkas, dan tautan terpaket.

## Menjalankan & mengintegrasikan

- **[CLI](/info/cli.html)** - render headless; jalur render yang sama seperti GUI, dijalankan oleh argv `--foo=bar`.
- **[TUI](/info/tui.html)** - shell terminal interaktif.
- **[Server MCP](/info/mcp.html)** - endpoint native yang memungkinkan agen AI menemukan dan menjalankan tool.
- **[Agen AI](/info/ai-agents.html)** - menjalankan Lolly dari sebuah model: URL adalah API-nya.
- **[Ekstensi Chrome](/info/extension.html)** - menangkap URL langsung sebagai aset yang dapat digunakan ulang.

## Merilis & mengoperasikannya

- **[Panduan Build](/info/build-guide.html)** - build setiap target: CLI, TUI, desktop, mobile.
- **[Penerapan](/info/deployment.html)** - aplikasi web, aplikasinya, dan layanan backend; tempat setiap bagian berjalan.
- **[Konfigurasi](/info/configuration.html)** - profil, brand pack, capability gating, feature flag, dan validasi katalog.

## Kepercayaan & data

Hak dan kepengarangan adalah input seperti yang lain. Embed & Track Image mendeklarasikan field pembuat, hak cipta, lisensi, dan kontak, lalu proses ekspor menuliskannya ke metadata berkas itu sendiri dan ke manifest C2PA-nya.

![The Embed and Track Image controls - creator, copyright, a licence dropdown, contact and title, filled from the link](/t/url-shot?url=%2F%23%2Ftool%2Fclaim%3Fcreator%3DAda%2520Lovelace%26title%3DEngine%2520Notes&width=1440&height=1200&dpi=192&waitMs=2200&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-rights-fields)

- **[Identitas Content Credentials](/info/content-credentials-identity.html)** - penandatanganan yang diterbitkan CA untuk C2PA di perangkat; kontrak engine dan runbook operator.
- **[Transfer Data](/info/data-transfer.html)** - bundel `lolly-backup`: envelope, integritas, dan jaminan lintas-shell.
- **[Tentang](/info/about.html)** - proyek ini, batasan lisensinya, dan repositorinya.
