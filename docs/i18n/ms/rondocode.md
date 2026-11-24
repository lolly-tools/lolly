# Lagu Lolly Rondocode

<a id="rondocode-songs"></a>

Lagu rondocode ialah muzik yang ditulis sebagai kod: pensintesis, corak dan campuran, dimainkan semasa anda menaip. Lolly boleh memainkan lagu sebagai latar video, dan utiliti **Rondocode** menulis lagu serta mengeksportnya sebagai audio; kedua-duanya merekodkan lagu dalam Content Credentials fail.

<!--i:eti-music-->
## Mainkan lagu dalam Lolly

Pemilih aset menerima lagu sebagai fail `.rondo` atau `.rondo.json`, atau sebagai pautan kongsi `rondocode.com` yang ditampal. Lagu dimainkan mengikut apa-apa tempoh yang diminta oleh klipnya. Ia boleh menjadi **muzik latar** dalam eksport video atau dimainkan dalam pemain ambien Neurospicy Mode.

Kod lagu berjalan dalam kotak pasir Lolly, tanpa rangkaian dan tanpa akses kepada fail anda. Sebarang bahagian yang tidak boleh dimainkan oleh render, seperti mikrofon langsung, atau nyanyian tanpa model suara, disenaraikan dalam butiran aset.

Daripada terminal, `lolly mix` menerima lagu sebagai keseluruhan runut bunyi; lihat [Render CLI](/info/cli-rendering.html).

<!--i:eti-code-->
## Tulis dan eksport lagu

Buka alat **Rondocode** daripada **Utilities** untuk menulis lagu dalam penyunting langsung rondocode dan mendengarnya semasa anda menaip. Eksport sebagai **WAV**, **MP3**, **M4A**, **Opus** atau **FLAC**, sebagai ZIP stem, sebagai **MIDI**, atau sebagai rakaman apa yang sedang dimainkan. Daripada terminal, `lolly rondocode --export=mid` menulis fail MIDI yang sama. **Export length** menetapkan tempoh eksport audio dalam saat. Fail lagu (`.rondo.json`) ialah kod anda seperti yang ditulis, tanpa sebarang tambahan.

Lagu boleh menyanyikan liriknya dengan `sing()`. Model suara yang dimuat turun menghasilkan nyanyian pada peranti anda. Fail yang menyimpan nyanyian sintesis sentiasa mengisytiharkan nyanyian itu sebagai dijana AI (lihat [Ciri AI](/info/ai-features.html)).

<!--i:eti-badge-check-->
## Lagu dalam kelayakan

Eksport video atau audio yang memainkan lagu rondocode merekodkan setiap lagu dalam Content Credentialsnya sebagai sumber:

- nama lagu;
- SHA-256 fail `.rondo.json`nya;
- cara ia dirender: dalam kotak pasir Lolly, kelas pelaksanaan `vm`, dengan versi dan benih perender, serta sebarang bahagian yang tidak boleh dimainkan oleh render.

Muzik yang dikira daripada kod lagu ditandakan sebagai media algoritma, jadi Lolly Verify tidak menandakannya sebagai AI. Sebelum anda mengeksport, baris di bawah **Download** menyenaraikan lagu yang akan direkodkan oleh kelayakan. Selepas eksport, baris yang sama melaporkan apa yang ditemui daripada pembacaan fail yang dihantar. Nyahtandakan **C2PA Credentials** untuk mengecualikan rekod. Imej pegun tidak merekodkan lagu, kerana ia tiada bunyi. Imej pegun tidak merekodkan lagu. `lolly mix` dan [pelayan MCP](/info/mcp.html) menulis rekod yang sama.

<!--i:eti-file-->
## Fail daripada utiliti Rondocode

Kebanyakan utiliti pada peranti tidak menulis kelayakan, kerana ia mengubah fail yang sudah anda miliki. Lolly Rondocode membuat audio baharu, jadi setiap fail audio yang ditulisnya membawa Content Credentials yang merekodkan lagu sebagai sumbernya: WAV, MP3, M4A, Opus, FLAC, setiap stem dalam ZIP stem dan rakaman apa yang sedang dimainkan.

- Render penyunting sendiri berjalan dalam bingkai peribadinya (kelas pelaksanaan `frame`) dan merekodkan versi penyunting.
- Render yang dibuat oleh CLI atau pautan kongsi berjalan dalam kelas `vm` dan merekodkan versi serta benih perender.
- WAV turut menyatakan perkara yang sama dalam komen RIFFnya.

Apabila lagu menyanyi, pengisytiharan AI boleh dibaca mesin. Jenis sumber digital kelayakan ialah media komposit yang dibuat dengan model terlatih, rekod menyenaraikan bahagian yang dinyanyikan, dan satu pendedahan AI C2PA bagi setiap model mengenal pasti setiap model yang dilalui nyanyian: teks kepada pertuturan Supertonic-3, penjajar fonem wav2vec 2.0, pengekod ContentVec dan suara RVC, bersama repositori dan komit sumber yang digunakan oleh Lolly untuk mengehoskannya.

### Apa yang disimpan dalam fail MIDI

Fail MIDI ialah Standard MIDI File, format 1. Trek pertama menyimpan tempo dan tanda masa 4/4, diikuti satu trek bagi setiap pensintesis, dinamakan mengikut pensintesis itu. Setiap not mengekalkan masa mula, panjang dan halajunya. Pensintesis yang namanya merujuk kepada instrumen, seperti bes, alat bertali, pad atau piano, mendapat instrumen General MIDI yang sepadan, dan nama yang menyerupai dram diletakkan pada saluran 10. Penalaan yang bukan dua belas nada dibundarkan kepada semiton terdekat dengan lenturan pic.

Fail MIDI tidak boleh menyimpan tetapan pensintesis, penapis, kesan, bas, sampel atau nyanyian, jadi DAW memainkan not dengan instrumennya sendiri. Tempo dibaca daripada kitaran sesaat lagu dengan satu kitaran sebagai bar empat ketukan, kerana tanda masa lagu sendiri bukan sebahagian daripada apa yang dikembalikan oleh perender.

Fail MIDI tiada tempat untuk kelayakan, jadi peristiwa teks dalam fail membawa pernyataan itu, dan panel eksport memberitahu anda. Panel menerangkan semua ini sebelum anda mengeksport. Selepas setiap eksport, penyunting membaca semula fail tersimpan dan hanya melaporkan apa yang ditemui daripada pembacaan itu.

Untuk apa yang direkodkan oleh Content Credentials secara umum, lihat [Eksport fail](/info/exporting.html#content-credentials-c2pa).
