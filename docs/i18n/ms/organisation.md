# Gunakan Lolly di organisasi anda

Organisasi anda boleh menjalankan Lolly sendiri: apl yang sama, dengan alat dan sistem reka bentuk yang dipilihnya. Halaman ini menunjukkan cara mencapainya, log masuk dan apa yang berubah selepas itu.

::: note Apa yang anda perlukan daripada organisasi anda
Alamat web Lolly miliknya, atau satu fail persediaan `.lolly` yang dibuat oleh organisasi anda. lolly.tools dengan sendirinya tidak menyambung kepada mana-mana organisasi.
:::

## Dalam pelayar

Buka alamat yang diberikan organisasi anda. Jika halaman meminta anda log masuk, tekan **Sign in** dan ikuti halaman log masuk yang dibukanya. Selepas itu ia berfungsi seperti mana-mana Lolly, dengan alat dan sistem reka bentuk organisasi anda.

Anda juga boleh bermula daripada lolly.tools: buka **Settings**, dan pada kad **Lolly instance** tekan **Open a workspace**, masukkan alamat dan tekan **Open this instance**. Pelayar pergi ke alamat organisasi anda sendiri, kerana pelayar tidak boleh memuatkan alat Lolly lain daripada lolly.tools.

![Kad Lolly instance dalam Settings, tempat anda membuka ruang kerja organisasi atau mengubah dari mana apl mendapat alatnya](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

## Dalam aplikasi desktop atau mudah alih

Apl bermula dengan alat terbenamnya. Untuk menyambung, buka **Settings** dan tekan **Change** pada kad **Lolly instance**. Helaian bertanya **Where should Lolly get its tools?**

1. Pilih **Sambung ke instans Lolly**.
2. Masukkan alamat web organisasi anda dan tekan **Semak & sambung**.
3. Tekan **Guna instans ini**. Skrin seterusnya, **Import data anda (pilihan)**, membawa kerja tersimpan daripada satu sandaran Lolly; tekan **Langkau** jika anda tiada satu pun.
4. Log masuk jika aplikasi itu memintanya.

Alat daripada satu instans yang disambungkan berjalan dengan kepercayaan yang sama seperti alat aplikasi itu sendiri, jadi sambung hanya kepada satu yang anda percayai. Organisasi anda mungkin sebaliknya menghantar anda satu fail persediaan `.lolly` yang menyambungkan aplikasi itu untuk anda.

Untuk bertukar kemudian, gunakan **Change** sekali lagi, atau **Leave** pada kad yang sama.

### Log masuk dengan kod

Dalam apl desktop dan mudah alih, skrin log masuk juga menawarkan kod pendek, apabila Lolly organisasi anda menyokong log masuk kod. Tekan **Open sign-in in browser**, log masuk dan luluskan kod di situ. Atau buka alamat yang ditunjukkannya pada telefon atau komputer di mana anda sudah log masuk, dan masukkan kod. Kod bertahan kira-kira sepuluh minit.

## Apa yang berbeza di situ

- **Sesetengah kawalan ditetapkan untuk anda.** Kawalan yang ditadbir organisasi anda menunjukkan **Managed by** dan nama organisasi, atau **Managed by your organisation**. Kawalan tetap tidak boleh diubah, menu mungkin menawarkan hanya sebahagian pilihannya, dan baris yang bermula dengan **Set by** boleh menyatakan peraturan mana yang terpakai dan sebabnya. Sesetengah kawalan tidak ditunjukkan langsung.
- **Sesetengah sistem reka bentuk dikunci.** Sistem reka bentuk yang dibekalkan organisasi anda menunjukkan kunci dan kekal baca sahaja. Untuk mencuba perubahan, buat salinan boleh sunting dalam **Settings → Preferences → Design systems**.
- **Hanya alatnya disenaraikan.** Alat yang tidak ditawarkan organisasi anda tidak ditunjukkan langsung.
- **Projek dikongsi.** Jika organisasi anda berkongsi projek dengan anda, **Projects** menunjukkan jubin **Team projects**. Sesi ini berada pada pelayan organisasi. Buka satu untuk mengusahakannya, atau mulakan [work collab](/info/collaborate.html#work-collabs-with-lolly-work-optional) daripada **Share** apabila tersedia.
- **Sesetengah eksport mungkin memerlukan kelulusan.** Di mana organisasi anda meminta kelulusan, **Request approval** menggantikan **Download**, dan alat mungkin menawarkan lebih sedikit format.

### Apa yang kekal di mana

::: cols
## Pada peranti ini

- Simpanan anda sendiri, melainkan anda menghidupkan [Sync](/info/sync.html)
- Sistem reka bentuk yang anda buat sendiri
- Apa-apa yang anda buat dan muat turun

## Pada pelayan organisasi anda

- Identiti log masuk dan maklumat peranti anda
- Projek pasukan, sesi dikongsi dan suntingan langsung dalam collab kerja
- Aset yang anda muat naik ke pustaka dikongsi
- Permintaan kelulusan dan penghantaran yang diluluskan
- Peristiwa penggunaan, apabila organisasi anda menghidupkannya
:::

[Privacy](/info/privacy.html#organisation-services-with-lolly-work) menyenaraikan apa yang disimpan pelayan dan siapa yang mengawal data itu.

## Apa yang ditambah Lolly Work

Pelayan organisasi anda menjalankan **Lolly Work**, perisian organisasi daripada projek sumber terbuka yang sama. Apl tidak memerlukan akaun kerja atau Lolly Work apabila anda menggunakannya bersendirian.

::: details Apa yang boleh ditambah Lolly Work
Organisasi anda menghoskan [Lolly Work](https://github.com/lolly-tools/lolly-work) bersama Lolly dan memilih ciri yang hendak dihidupkan:

- **Log masuk dan akses.** Log masuk tunggal organisasi, kebenaran berasaskan kumpulan dan medan profil terurus. Pentadbir boleh menyediakan dan menyahaktifkan akaun melalui SCIM.
- **Kerja dikongsi.** Projek pasukan, sesi dikongsi dan [work collabs](/info/collaborate.html#work-collabs-with-lolly-work-optional), dengan penyuntingan langsung melalui pelayan organisasi.
- **Pustaka aset dikongsi.** Aset yang dimuat naik, koleksi dan pustaka bersambung, dengan peraturan akses, versi dan semakan.
- **Semakan dan penghantaran.** Langkah kelulusan, pautan terurus dengan tamat tempoh atau pembatalan, dan penghantaran ke destinasi yang dibenarkan organisasi.
- **Pentadbiran.** Pelaporan penggunaan di bawah dasar telemetri instans, serta rekod audit tindakan yang ditadbir.

Jika anda menyediakan perkhidmatan ini, mulakan dengan [Deployment](/info/deployment.html#organisation-services-with-lolly-work). Demo awam di [lolly.work](https://lolly.work) ialah kotak pasir; gunakan alamat organisasi anda sendiri untuk kerja yang perlu anda simpan.
:::

## Meninggalkan

**Leave**, pada kad **Lolly instance** dalam **Settings**, membuang sistem reka bentuk, alat dan katalog organisasi anda. Kerja anda sendiri kekal. Apa-apa yang anda buat dengan alatnya tidak akan dibuka lagi sehingga anda menyambung semula.

Apa-apa yang anda simpan ke organisasi kekal bersama organisasi, di bawah dasar akses dan pengekalannya. Meninggalkan atau mengosongkan peranti ini tidak memadam salinan pelayan itu. Dalam pelayar pada alamat organisasi anda sendiri tiada apa-apa untuk ditinggalkan: buka alamat lain sebaliknya.

## Siapa yang perlu ditanya

Apa yang sampai ke pelayan organisasi anda, siapa yang boleh melihat projek dikongsinya dan tetapan mana yang tetap adalah keputusan organisasi anda. Tanya sesiapa sahaja yang menjalankan Lolly organisasi anda. [Dasar Privasi](/info/privacy.html) merangkumi apa yang Lolly sendiri lakukan dengan data anda.
