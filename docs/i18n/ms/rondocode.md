# Lagu Rondocode

Lagu rondocode ialah muzik yang ditulis sebagai kod: sintesis, corak dan campuran, dimainkan semasa anda menaip. Lolly boleh memainkan lagu di bawah video, dan utiliti **Rondocode** membolehkan anda menulis satu dan mengeksportnya sebagai audio. Kedua-duanya merekodkan lagu dalam Content Credentials fail, supaya muzik menyatakan dari mana asalnya.

## Mainkan lagu dalam Lolly

Pemilih aset menerima lagu sebagai fail `.rondo` atau `.rondo.json`, atau sebagai pautan kongsi `rondocode.com` yang ditampal. Lagu ialah kod yang membuat bunyinya sendiri, jadi ia dimainkan pada panjang apa pun yang diminta kliipnya. Ia boleh menjadi **music bed** di bawah eksport video atau dimainkan dalam pemain ambien Neurospicy Mode.

Kod lagu dijalankan dalam kotak pasir Lolly, tanpa rangkaian dan tanpa akses kepada fail anda. Mana-mana bahagian yang tidak dapat dimainkan render, seperti mikrofon langsung, atau nyanyian tanpa model suara, disenaraikan dalam butiran aset.

Daripada terminal, `lolly mix` mengambil lagu sebagai keseluruhan runut bunyi; lihat [CLI rendering](/info/cli-rendering.html).

## Tulis dan eksport lagu

Buka **Rondocode** daripada **Utilities** untuk menulis lagu dalam penyunting langsung rondocode dan mendengarnya semasa anda menaip. Eksportnya sebagai **WAV**, **MP3**, **M4A**, **Opus** atau **FLAC**, sebagai ZIP stem, sebagai **MIDI**, atau sebagai rakaman apa yang dimainkan. **Export length** menetapkan berapa saat eksport audio bertahan. Fail lagu itu sendiri (`.rondo.json`) ialah kod anda seperti yang ditulis dan tidak membawa tambahan.

Lagu boleh menyanyikan liriknya dengan `sing()`. Nyanyian dibuat pada peranti anda oleh model suara yang dimuat turun, dan fail yang memegang nyanyian sintesis sentiasa mengisytiharkan nyanyian itu sebagai dijana AI (lihat [AI features](/info/ai-features.html)).

## Lagu dalam kredensial

Eksport video atau audio yang memainkan lagu rondocode merekodkan setiap lagu dalam Content Credentials sebagai sumber:

- nama lagu;
- SHA-256 fail `.rondo.json`-nya;
- cara ia dirender: dalam kotak pasir Lolly, kelas pelaksanaan `vm`, dengan versi dan benih perender, dan mana-mana bahagian yang tidak dapat dimainkan render.

Muzik yang dikira daripada kod lagu ditandakan sebagai media algoritma, jadi Verify tidak menandakannya sebagai AI. Sebelum anda mengeksport, baris di bawah **Download** menyenaraikan lagu yang akan direkodkan kredensial; selepas eksport, baris yang sama melaporkan apa yang ditemui oleh bacaan fail yang dihantar. Nyahtanda **C2PA Credentials** untuk tidak menyertakan rekod. Imej pegun tidak merekodkan lagu, kerana ia tidak membawa bunyi. `lolly mix` dan [pelayan MCP](/info/mcp.html) menulis rekod yang sama.

## Fail daripada utiliti Rondocode

Kebanyakan utiliti pada peranti tidak menulis kredensial, kerana ia mengubah fail yang sudah anda miliki. Rondocode membuat audio baharu, jadi setiap fail audio yang ditulisnya membawa Content Credentials yang merekodkan lagu sebagai sumbernya: namanya, SHA-256 fail `.rondo.json`-nya dan di mana kodnya dijalankan. Itu meliputi WAV, MP3, M4A, Opus, FLAC, setiap stem dalam ZIP stem dan rakaman apa yang dimainkan.

- Render penyunting sendiri dijalankan dalam bingkai persendiriannya (kelas pelaksanaan `frame`) dan merekodkan versi penyunting.
- Render yang dibuat oleh CLI atau pautan kongsi dijalankan dalam kelas `vm` dan merekodkan versi dan benih perender.
- WAV juga menyatakan perkara yang sama dalam komen RIFF-nya.
- Muzik yang dikira daripada kod lagu ialah media algoritma dan tidak ditandakan sebagai AI.

Apabila lagu menyanyi, fail mengisytiharkan nyanyian itu dijana AI dalam bentuk boleh dibaca mesin. Jenis sumber digital kredensial ialah media komposit yang dibuat dengan model terlatih, rekod menyenaraikan bahagian yang dinyanyikan, dan satu pendedahan AI C2PA bagi setiap model mengenal pasti setiap model yang dilalui nyanyian: teks-ke-pertuturan Supertonic-3, penjajar fonem wav2vec 2.0, pengekod ContentVec dan suara RVC, dengan repositori dan commit tempat Lolly menghoskannya. Fail yang memegang nyanyian sintesis tidak pernah disimpan tanpa pengisytiharan itu.

Fail MIDI tiada tempat untuk kredensial, jadi peristiwa teks dalam fail membawa kenyataan sebaliknya, dan panel eksport memberitahu anda. Panel menerangkan semua ini sebelum anda mengeksport, dan selepas setiap eksport penyunting membaca semula fail yang disimpan dan melaporkan hanya apa yang ditemui bacaan itu.

Untuk apa yang direkodkan Content Credentials secara umum, lihat [Export a file](/info/exporting.html#content-credentials-c2pa).
