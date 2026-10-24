# Rondocode şarkıları

Bir rondocode şarkısı kod olarak yazılmış müziktir: sentezleyiciler, kalıplar ve bir miks; yazdıkça çalınır. Lolly bir videonun altında bir şarkı çalabilir ve **Rondocode** yardımcı aracı bir tane yazıp ses olarak dışa aktarmana izin verir. İkisi de şarkıyı dosyanın Content Credentials içinde kaydeder; böylece müzik nereden geldiğini söyler.

## Lolly'de bir şarkı çal

Varlık seçici bir şarkıyı `.rondo` veya `.rondo.json` dosyası olarak ya da yapıştırılmış bir `rondocode.com` paylaşım bağlantısı olarak kabul eder. Bir şarkı kendi sesini üreten koddur; bu yüzden klibinin istediği her uzunlukta çalar. Bir video dışa aktarmasının altındaki **music bed** olabilir ya da Neurospicy Mode'un ortam oynatıcısında çalabilir.

Şarkının kodu Lolly'nin sanal alanında, ağ ve dosyalarına erişim olmadan çalışır. Bir render'ın çalamadığı canlı mikrofon veya ses modelleri olmadan şarkı söyleme gibi her parça varlığın ayrıntılarında listelenir.

Terminalden `lolly mix` bir şarkıyı tüm ses kaydı olarak alır; bkz. [CLI rendering](/info/cli-rendering.html).

## Bir şarkı yaz ve dışa aktar

Rondocode'un canlı düzenleyicisinde bir şarkı yazmak ve yazdıkça duymak için **Utilities** içinden **Rondocode** aç. Onu **WAV**, **MP3**, **M4A**, **Opus** veya **FLAC** olarak, bir kök (stem) ZIP'i olarak, **MIDI** olarak ya da çalanın bir kaydı olarak dışa aktar. **Export length** bir ses dışa aktarmasının kaç saniye süreceğini belirler. Şarkı dosyasının kendisi (`.rondo.json`) yazdığın hâliyle kodundur ve eklenmiş hiçbir şey taşımaz.

Bir şarkı sözlerini `sing()` ile söyleyebilir. Şarkı söyleme, cihazında indirilen ses modelleriyle yapılır ve sentezlenmiş şarkı söyleme tutan bir dosya, söylemeyi her zaman yapay zekâ üretimi olarak bildirir (bkz. [AI features](/info/ai-features.html)).

## Kimlik bilgisindeki şarkılar

Bir rondocode şarkısı çalan bir video veya ses dışa aktarması, her şarkıyı Content Credentials içinde bir kaynak olarak kaydeder:

- şarkının adı;
- `.rondo.json` dosyasının SHA-256 değeri;
- nasıl render edildiği: Lolly'nin sanal alanında, `vm` yürütme sınıfı, render edicinin sürümü ve tohumu ve render'ın çalamadığı her parça.

Bir şarkının kodundan hesaplanan müzik algoritmik medya olarak işaretlenir; bu yüzden Verify onu yapay zekâ olarak işaretlemez. Dışa aktarmadan önce **Download** altındaki bir satır kimlik bilgisinin kaydedeceği şarkıları listeler; dışa aktarmadan sonra aynı satır teslim edilen dosyanın okunmasında bulunanı bildirir. Kaydı dışarıda bırakmak için **C2PA Credentials** işaretini kaldır. Durağan bir görsel ses taşımadığı için hiçbir şarkı kaydetmez. `lolly mix` ve [MCP server](/info/mcp.html) aynı kaydı yazar.

## Rondocode yardımcı aracından dosyalar

Cihaz üzerindeki yardımcı araçların çoğu, zaten sahip olduğun bir dosyayı dönüştürdükleri için kimlik bilgisi yazmaz. Rondocode yeni ses yapar; bu yüzden yazdığı her ses dosyası şarkıyı kaynağı olarak kaydeden Content Credentials taşır: adı, `.rondo.json` dosyasının SHA-256 değeri ve kodunun nerede çalıştığı. Bu WAV, MP3, M4A, Opus, FLAC, bir kök ZIP'indeki her kök ve çalanın bir kaydını kapsar.

- Düzenleyicinin kendi render'ları özel çerçevesinde (`frame` yürütme sınıfı) çalışır ve düzenleyicinin sürümünü kaydeder.
- CLI veya bir paylaşım bağlantısıyla yapılan bir render `vm` sınıfında çalışır ve render edicinin sürümünü ve tohumunu kaydeder.
- Bir WAV aynısını RIFF yorumunda da belirtir.
- Şarkının kodundan hesaplanan müzik algoritmik medyadır ve yapay zekâ olarak işaretlenmez.

Bir şarkı söylediğinde dosya, bu söylemeyi makine tarafından okunabilir biçimde yapay zekâ üretimi olarak bildirir. Kimlik bilgisinin dijital kaynak türü, eğitilmiş modellerle yapılmış bileşik medyadır, kayıt söylenen bölümleri listeler ve model başına bir C2PA yapay zekâ bildirimi şarkı söylemenin geçtiği her modeli tanımlar: Supertonic-3 metinden konuşmaya, wav2vec 2.0 fonem hizalayıcı, ContentVec kodlayıcı ve RVC sesi; Lolly'nin onu barındırdığı depo ve commit ile. Sentezlenmiş şarkı söyleme tutan bir dosya bu bildirim olmadan asla kaydedilmez.

Bir MIDI dosyasında kimlik bilgisi için yer yoktur; bu yüzden dosyadaki bir metin olayı beyanı taşır ve dışa aktarma paneli bunu söyler. Panel tüm bunları dışa aktarmadan önce anlatır ve her dışa aktarmadan sonra düzenleyici kayıtlı dosyayı geri okur ve yalnızca o okumanın bulduğunu bildirir.

Content Credentials'ın genel olarak neyi kaydettiği için bkz. [Export a file](/info/exporting.html#content-credentials-c2pa).
