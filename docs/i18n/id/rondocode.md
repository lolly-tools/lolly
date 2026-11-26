# Lagu Lolly Rondocode

<a id="rondocode-songs"></a>

Lagu rondocode adalah musik yang ditulis sebagai kode: synth, pola dan mix, diputar saat Anda mengetik. Lolly dapat memutar lagu sebagai latar video, dan utilitas **Rondocode** menulis lagu serta mengekspornya sebagai audio; keduanya mencatat lagu dalam Content Credentials file.

<!--i:eti-music-->
## Putar lagu di Lolly

Pemilih aset menerima lagu sebagai file `.rondo` atau `.rondo.json`, atau tautan berbagi `rondocode.com` yang ditempel. Lagu diputar sepanjang durasi yang diminta klipnya. Lagu dapat menjadi **musik latar** pada ekspor video atau diputar di pemutar ambien Neurospicy Mode.

Kode lagu berjalan di sandbox Lolly, tanpa jaringan dan tanpa akses ke file Anda. Bagian apa pun yang tidak dapat diputar render, seperti mikrofon langsung, atau nyanyian tanpa model suara, dicantumkan dalam detail aset.

Dari terminal, `lolly mix` menerima lagu sebagai seluruh soundtrack; lihat [Render CLI](/info/cli-rendering.html).

<!--i:eti-code-->
## Tulis dan ekspor lagu

Buka alat **Rondocode** dari **Utilities** untuk menulis lagu di editor langsung rondocode dan mendengarnya saat Anda mengetik. Ekspor sebagai **WAV**, **MP3**, **M4A**, **Opus** atau **FLAC**, sebagai ZIP berisi stem, sebagai **MIDI** atau sebagai rekaman dari yang sedang diputar. Dari terminal, `lolly rondocode --export=mid` menulis file MIDI yang sama. **Export length** mengatur durasi ekspor audio dalam detik. File lagu (`.rondo.json`) adalah kode Anda sebagaimana ditulis, tanpa tambahan apa pun.

Lagu dapat menyanyikan liriknya dengan `sing()`. Model suara yang diunduh menghasilkan nyanyian di perangkat Anda. File yang memuat nyanyian sintetis selalu menyatakan nyanyian tersebut sebagai hasil AI (lihat [Fitur AI](/info/ai-features.html)).

<!--i:eti-badge-check-->
## Lagu dalam kredensial

Ekspor video atau audio yang memutar lagu rondocode mencatat setiap lagu dalam Content Credentials sebagai sumber:

- nama lagu;
- SHA-256 file `.rondo.json`-nya;
- cara lagu dirender: di sandbox Lolly, kelas eksekusi `vm`, dengan versi dan seed renderer, serta bagian yang tidak dapat diputar render.

Musik yang dihitung dari kode lagu ditandai sebagai media algoritmis, sehingga Lolly Verify tidak menandainya sebagai AI. Sebelum Anda mengekspor, baris di bawah **Download** mencantumkan lagu yang akan dicatat kredensial. Setelah ekspor, baris yang sama melaporkan hasil pembacaan file yang disampaikan. Hapus centang **C2PA Credentials** untuk tidak menyertakan catatan. Gambar diam tidak mencatat lagu, karena tidak memiliki suara. Gambar diam tidak mencatat lagu. `lolly mix` dan [server MCP](/info/mcp.html) menulis catatan yang sama.

<!--i:eti-file-->
## File dari utilitas Rondocode

Sebagian besar utilitas di perangkat tidak menulis kredensial, karena mentransformasi file yang sudah Anda miliki. Lolly Rondocode membuat audio baru, sehingga setiap file audio yang ditulisnya membawa Content Credentials yang mencatat lagu sebagai sumbernya: WAV, MP3, M4A, Opus, FLAC, setiap stem dalam ZIP berisi stem dan rekaman dari yang sedang diputar.

- Render editor sendiri berjalan dalam frame privatnya (kelas eksekusi `frame`) dan mencatat versi editor.
- Render yang dibuat CLI atau tautan berbagi berjalan dalam kelas `vm` dan mencatat versi serta seed renderer.
- WAV juga menyatakan hal yang sama dalam komentar RIFF-nya.

Bila lagu bernyanyi, deklarasi AI dapat dibaca mesin. Jenis sumber digital kredensial adalah media komposit yang dibuat dengan model terlatih, catatan mencantumkan bagian yang dinyanyikan, dan satu pengungkapan AI C2PA per model mengidentifikasi setiap model yang dilalui nyanyian: Supertonic-3 teks ke ucapan, penyelaras fonem wav2vec 2.0, encoder ContentVec dan suara RVC, beserta repositori dan commit asal yang digunakan Lolly untuk menyajikannya.

### Isi file MIDI

File MIDI adalah Standard MIDI File, format 1. Trek pertama memuat tempo dan tanda birama 4/4, diikuti satu trek per synth, dengan nama synth tersebut. Setiap not mempertahankan waktu mulai, durasi dan velocity. Synth yang namanya terbaca sebagai instrumen, seperti bas, gesek, pad atau piano, mendapat instrumen General MIDI yang sesuai, dan nama yang menyerupai drum ditempatkan pada kanal 10. Penyeteman yang bukan dua belas nada dibulatkan ke seminada terdekat dengan pitch bend.

File MIDI tidak dapat memuat pengaturan synth, filter, efek, bus, sampel atau nyanyian, sehingga DAW memainkan not dengan instrumennya sendiri. Tempo dibaca dari siklus per detik lagu dengan satu siklus sebagai satu birama empat ketukan, karena tanda birama lagu sendiri bukan bagian dari yang dikembalikan renderer.

File MIDI tidak memiliki tempat untuk kredensial, sehingga peristiwa teks dalam file membawa pernyataan itu, dan panel ekspor memberi tahu Anda. Panel menjelaskan semua ini sebelum Anda mengekspor. Setelah setiap ekspor, editor membaca kembali file tersimpan dan hanya melaporkan hasil pembacaan itu.

Untuk hal yang dicatat Content Credentials secara umum, lihat [Ekspor file](/info/exporting.html#content-credentials-c2pa).
