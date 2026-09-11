# Lolly untuk Pembina

Dokumentasi teknikal - untuk sesiapa sahaja yang mencipta alat, mengintegrasikan Lolly ke dalam saluran paip, mengehos sendiri platform ini, atau melanjutkan platform ini.

**Apa faedahnya untuk anda.** Bina alat sekali sahaja dan permintaan itu tidak lagi kembali kepada anda. Permintaan berulang "boleh tak buatkan saya…" yang menghabiskan masa petang anda bertukar menjadi templat yang orang lain isi sendiri - dengan betul, tanpa anda perlu terlibat. Kerja anda adalah HTML/CSS/JS biasa: terkawal versi, mudah dibandingkan, mudah disemak, dan berjalan atas enjin terbuka tanpa terikat kepada mana-mana vendor, jadi ia kekal milik anda. Automasikan larian pengeluaran dan masa anda tertumpu kepada masalah yang menarik, bukan eksport yang ke sepuluh ribu.

Lolly ialah **enjin** platform-agnostik yang menjalankan laluan render yang sama merentasi beberapa **shell** (web PWA, Tauri desktop/mudah alih, CLI, TUI). Alat adalah **data, bukan kod terbungkus** - satu manifest ditambah satu templat ditambah hook pilihan - jadi alat baharu boleh dilancarkan tanpa kemas kini aplikasi. Mulakan dengan [Gambaran Keseluruhan](/info/overview.html) untuk seni bina, kemudian ikuti laluan yang sesuai dengan apa yang anda bina.

Baru dengan platform ini? **[Mula Pantas](/info/quickstart.html)** akan menyediakan jenama dan render pertama anda sebelum anda menyelami lebih mendalam.

## Fahami seni bina



- **[Gambaran Keseluruhan](/info/overview.html)** - sebab Lolly wujud, pemisahan engine/shell/tools, jambatan keupayaan, dan komitmen seni bina yang telah ditetapkan.
- **[Token Reka Bentuk](/info/design-tokens.html)** - model token DTCG yang menjadi asas cara jenama diungkapkan, dan cara alat menggunakannya.

## Cipta alat

Setiap kawalan di bawah dijana daripada input yang diisytiharkan dalam `tool.json`. Anda menulis baris manifest, hos melukis widget, dan model yang sama memacu CLI dan URL.

![One declared input, one generated control: a url, a colour, a select, a number, a boolean](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&height=900&dpi=192&waitMs=2000&cropSelector=.tool-inputs&walker=1&format=svg&dark=1&filename=aud-manifest-controls)

Ia berskala lebih jauh daripada lima kawalan. Berikan sesuatu input satu `section` dan hos akan melipatnya, jadi alat dengan lima puluh input seperti D3 Chart Studio masih terbuka sebagai senarai pendek, manakala yang lain difailkan di belakang kumpulan bernama.

![The D3 sidebar - a handful of primary controls, then Data, Columns, Chart, Axes and the other sections collapsed into one line each](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=1600&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-d3-sections)

- **[Mencipta Alat](/info/authoring-tools.html)** - panduan lengkap: manifest, templat, gaya, hook, komposisi, dan penerbitan.
- **[Mencipta Aset](/info/authoring-assets.html)** - aset katalog, tingkatan, lokel, palet, ikon boleh ditema, dan fon.
- **[API Hos](/info/host-api.html)** - jambatan keupayaan `HostV1` yang menjadi asas penulisan setiap alat (satu-satunya API yang dilihat oleh alat).
- **[Mod URL](/info/url-mode.html)** - setiap input sebagai parameter URL; parameter dikhaskan, pengekodan padat, pautan padat.

## Jalankan & integrasikan

- **[CLI](/info/cli.html)** - pemaparan tanpa kepala (headless); laluan render yang sama seperti GUI, dipacu oleh argv `--foo=bar`.
- **[TUI](/info/tui.html)** - shell terminal interaktif.
- **[Pelayan MCP](/info/mcp.html)** - endpoint asli yang membolehkan ejen AI menemui dan menjalankan alat.
- **[Ejen AI](/info/ai-agents.html)** - menggerakkan Lolly daripada model: URL itu sendiri adalah API.
- **[Sambungan Chrome](/info/extension.html)** - tangkap URL langsung sebagai aset boleh guna semula.

## Lancarkan & operasikan

- **[Panduan Bina](/info/build-guide.html)** - bina setiap sasaran: CLI, TUI, desktop, mudah alih.
- **[Pelaksanaan](/info/deployment.html)** - aplikasi web, aplikasi-aplikasi, dan perkhidmatan backend; di mana setiap bahagian berjalan.
- **[Konfigurasi](/info/configuration.html)** - profil, pek jenama, sekatan keupayaan, bendera ciri, dan pengesahan katalog.

## Kepercayaan & data

Hak dan pengarangan juga merupakan input seperti yang lain. Embed & Track Image mengisytiharkan medan pencipta, hak cipta, lesen dan hubungan, dan proses eksport menulisnya ke dalam metadata fail itu sendiri serta manifes C2PA-nya.

![The Embed and Track Image controls - creator, copyright, a licence dropdown, contact and title, filled from the link](/t/url-shot?url=%2F%23%2Ftool%2Fclaim%3Fcreator%3DAda%2520Lovelace%26title%3DEngine%2520Notes&width=1440&height=1200&dpi=192&waitMs=2200&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-rights-fields)

- **[Identiti Content Credentials](/info/content-credentials-identity.html)** - tandatangan yang dikeluarkan oleh CA untuk C2PA pada peranti; kontrak engine dan runbook operator.
- **[Pemindahan Data](/info/data-transfer.html)** - bungkusan `lolly-backup`: sampul, integriti, dan jaminan merentasi shell.
- **[Perihal](/info/about.html)** - projek ini, sempadan lesennya, dan repositori.
