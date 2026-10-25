# Lagu Rondocode

Lagu rondocode adalah musik yang ditulis sebagai kode: synth, pola, dan mix, dimainkan saat Anda mengetik. Lolly dapat memutar lagu di bawah video, dan utilitas **Rondocode** memungkinkan Anda menulis satu dan mengekspornya sebagai audio. Keduanya mencatat lagu dalam Content Credentials file, sehingga musik menyatakan asalnya.

## Putar lagu di Lolly

Pemilih aset menerima lagu sebagai file `.rondo` atau `.rondo.json`, atau tautan berbagi `rondocode.com` yang ditempel. Lagu adalah kode yang membuat suaranya sendiri, jadi diputar pada panjang berapa pun yang diminta kliknya. Ia dapat menjadi **music bed** di bawah ekspor video atau diputar di pemutar ambient Neurospicy Mode.

Kode lagu berjalan di sandbox Lolly, tanpa jaringan dan tanpa akses ke file Anda. Bagian apa pun yang tidak dapat diputar render, seperti mikrofon langsung, atau nyanyian tanpa model suara, dicantumkan di detail aset.

Dari terminal, `lolly mix` menerima lagu sebagai seluruh soundtrack; lihat [CLI rendering](/info/cli-rendering.html).

## Tulis dan ekspor lagu

Buka **Rondocode** dari **Utilities** untuk menulis lagu di editor langsung rondocode dan mendengarnya saat Anda mengetik. Ekspor sebagai **WAV**, **MP3**, **M4A**, **Opus**, atau **FLAC**, sebagai ZIP stem, sebagai **MIDI**, atau sebagai rekaman apa yang sedang diputar. **Export length** menetapkan berapa detik ekspor audio berlangsung. File lagu itu sendiri (`.rondo.json`) adalah kode Anda sebagaimana ditulis dan tidak membawa tambahan apa pun.

Lagu dapat menyanyikan liriknya dengan `sing()`. Nyanyian dibuat di perangkat Anda oleh model suara yang diunduh, dan file yang memuat nyanyian sintetis selalu mendeklarasikan nyanyian itu sebagai buatan AI (lihat [AI features](/info/ai-features.html)).

## Lagu dalam kredensial

Ekspor video atau audio yang memutar lagu rondocode mencatat setiap lagu dalam Content Credentials-nya sebagai sumber:

- nama lagu;
- SHA-256 dari file `.rondo.json`-nya;
- bagaimana ia dirender: di sandbox Lolly, kelas eksekusi `vm`, dengan versi dan seed perender, dan bagian apa pun yang tidak dapat diputar render.

Musik yang dihitung dari kode lagu ditandai sebagai media algoritmik, sehingga Verify tidak menandainya sebagai AI. Sebelum Anda mengekspor, baris di bawah **Download** mencantumkan lagu yang akan dicatat kredensial; setelah ekspor, baris yang sama melaporkan apa yang ditemukan pembacaan file yang dikirim. Hapus centang **C2PA Credentials** untuk tidak menyertakan catatan. Gambar diam tidak mencatat lagu, karena tidak membawa suara. `lolly mix` dan [server MCP](/info/mcp.html) menulis catatan yang sama.

## File dari utilitas Rondocode

Sebagian besar utilitas di perangkat tidak menulis kredensial, karena mentransformasi file yang sudah Anda miliki. Rondocode membuat audio baru, jadi setiap file audio yang ditulisnya membawa Content Credentials yang mencatat lagu sebagai sumbernya: namanya, SHA-256 file `.rondo.json`-nya, dan tempat kodenya dijalankan. Itu mencakup WAV, MP3, M4A, Opus, FLAC, setiap stem dalam ZIP stem, dan rekaman apa yang sedang diputar.

- Render editor sendiri berjalan di frame privatnya (kelas eksekusi `frame`) dan mencatat versi editor.
- Render yang dibuat CLI atau tautan berbagi berjalan di kelas `vm` dan mencatat versi dan seed perender.
- WAV juga menyatakan hal yang sama dalam komentar RIFF-nya.
- Musik yang dihitung dari kode lagu adalah media algoritmik dan tidak ditandai sebagai AI.

Bila lagu bernyanyi, file mendeklarasikan nyanyian itu buatan AI dalam bentuk yang dapat dibaca mesin. Tipe sumber digital kredensial adalah media komposit yang dibuat dengan model terlatih, catatan mencantumkan bagian yang dinyanyikan, dan satu pengungkapan AI C2PA per model mengidentifikasi setiap model yang dilalui nyanyian: text to speech Supertonic-3, aligner fonem wav2vec 2.0, encoder ContentVec, dan suara RVC, dengan repositori dan commit tempat Lolly meng-host-nya. File yang memuat nyanyian sintetis tidak pernah disimpan tanpa deklarasi itu.

File MIDI tidak memiliki tempat untuk kredensial, jadi peristiwa teks di dalam file membawa pernyataannya, dan panel ekspor memberi tahu Anda. Panel menjelaskan semua ini sebelum Anda mengekspor, dan setelah setiap ekspor editor membaca kembali file tersimpan dan hanya melaporkan apa yang ditemukan pembacaan itu.

Untuk apa yang dicatat Content Credentials secara umum, lihat [Export a file](/info/exporting.html#content-credentials-c2pa).
