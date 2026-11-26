# Lolly Rondocode şarkıları

<a id="rondocode-songs"></a>

Rondocode şarkısı, kod olarak yazılmış müziktir: yazarken çalınan sentezleyiciler, kalıplar ve bir miks. Lolly bir videonun altında şarkı çalabilir; **Rondocode** yardımcı aracı ise şarkı yazar ve ses olarak dışa aktarır. İkisi de şarkıyı dosyanın Content Credentials kaydına ekler.

<!--i:eti-music-->
## Lolly'de şarkı çal

Varlık seçici, şarkıyı `.rondo` veya `.rondo.json` dosyası olarak ya da yapıştırılmış bir `rondocode.com` paylaşım bağlantısı olarak alır. Şarkı, klibi ne kadar süre istiyorsa o kadar çalar. Bir video dışa aktarmasının altında **fon müziği** olabilir veya Neurospicy Mode'un ortam oynatıcısında çalabilir.

Şarkının kodu Lolly'nin korumalı alanında, ağ bağlantısı ve dosyalarına erişim olmadan çalışır. Canlı mikrofon veya ses modelleri olmadan şarkı söyleme gibi, render'ın çalamadığı her bölüm varlığın ayrıntılarında listelenir.

Terminalde `lolly mix`, şarkıyı ses kuşağının tamamı olarak alır; bkz. [CLI ile render](/info/cli-rendering.html).

<!--i:eti-code-->
## Şarkı yaz ve dışa aktar

Rondocode'un canlı düzenleyicisinde bir şarkı yazmak ve yazarken duymak için **Utilities** içinden **Rondocode** aracını aç. **WAV**, **MP3**, **M4A**, **Opus** veya **FLAC** olarak, ayrı ses kanallarından oluşan bir ZIP olarak, **MIDI** olarak ya da çalan sesin kaydı olarak dışa aktar. Terminalde `lolly rondocode --export=mid` aynı MIDI dosyasını yazar. **Export length**, ses dışa aktarmasının kaç saniye süreceğini belirler. Şarkı dosyası (`.rondo.json`), hiçbir şey eklenmeden kodunun yazıldığı halidir.

Bir şarkı, `sing()` ile sözlerini söyleyebilir. İndirilen ses modelleri şarkı söyleme sesini cihazında üretir. Sentezlenmiş şarkı söyleme içeren bir dosya, bu sesin yapay zekâ ile üretildiğini her zaman belirtir (bkz. [Yapay zekâ özellikleri](/info/ai-features.html)).

<!--i:eti-badge-check-->
## Kimlik bilgisindeki şarkılar

Bir rondocode şarkısı çalan video veya ses dışa aktarması, her şarkıyı Content Credentials içinde kaynak olarak kaydeder:

- şarkının adı;
- `.rondo.json` dosyasının SHA-256 özeti;
- nasıl render edildiği: Lolly'nin korumalı alanında, `vm` yürütme sınıfında, render motorunun sürümü ve tohum değeriyle birlikte ve render'ın çalamadığı her bölüm.

Şarkının kodundan hesaplanan müzik algoritmik medya olarak işaretlenir; bu yüzden Lolly Verify bunu yapay zekâ olarak işaretlemez. Dışa aktarmadan önce **Download** altındaki bir satır, kimlik bilgisinin kaydedeceği şarkıları listeler. Dışa aktarmadan sonra aynı satır, teslim edilen dosyanın okunmasıyla bulunanları bildirir. Kaydı dışarıda bırakmak için **C2PA Credentials** işaretini kaldır. Durağan bir görsel, sesi olmadığı için şarkı kaydetmez. Durağan bir görsel şarkı kaydetmez. `lolly mix` ve [MCP sunucusu](/info/mcp.html) aynı kaydı yazar.

<!--i:eti-file-->
## Rondocode yardımcı aracından gelen dosyalar

Cihazda çalışan yardımcı araçların çoğu kimlik bilgisi yazmaz; çünkü zaten sana ait olan bir dosyayı dönüştürürler. Lolly Rondocode yeni ses oluşturur; bu yüzden yazdığı her ses dosyası, şarkıyı kaynak olarak kaydeden Content Credentials taşır: WAV, MP3, M4A, Opus, FLAC, ayrı ses kanalları ZIP'indeki her kanal ve çalan sesin kaydı.

- Düzenleyicinin kendi render'ları özel çerçevesinde (`frame` yürütme sınıfı) çalışır ve düzenleyicinin sürümünü kaydeder.
- CLI veya bir paylaşım bağlantısıyla yapılan render, `vm` sınıfında çalışır ve render motorunun sürümünü ve tohum değerini kaydeder.
- WAV, RIFF yorumunda da aynı bilgiyi belirtir.

Bir şarkı sözlerini söylediğinde yapay zekâ beyanı makine tarafından okunabilir. Kimlik bilgisinin dijital kaynak türü, eğitilmiş modellerle oluşturulmuş bileşik medyadır; kayıt, söylenen bölümleri listeler ve model başına bir C2PA yapay zekâ bildirimi, şarkı söyleme sesinin geçtiği her modeli tanımlar: Supertonic-3 metinden konuşmaya modeli, wav2vec 2.0 fonem hizalayıcısı, ContentVec kodlayıcısı ve RVC sesi; Lolly'nin bunları barındırmak için aldığı depo ve commit bilgisiyle birlikte.

### MIDI dosyasının içeriği

MIDI dosyası, biçim 1 olan bir Standard MIDI File'dır. İlk iz tempoyu ve 4/4 ölçüyü tutar; ardından her sentezleyici için sentezleyicinin adını taşıyan bir iz gelir. Her nota başlangıcını, uzunluğunu ve vuruş şiddetini korur. Adı bas, yaylılar, pad veya piyano gibi bir enstrümanı belirten sentezleyici, eşleşen General MIDI enstrümanını alır; davul benzeri bir ad ise kanal 10'a gider. On iki tonlu olmayan bir akort, perde bükmeyle en yakın yarım tona yuvarlanır.

MIDI dosyası sentezleyici ayarlarını, filtreleri, efektleri, ses yollarını, ses örneklerini veya şarkı söyleme sesini tutamaz; bu yüzden DAW notaları kendi enstrümanlarıyla çalar. Tempo, bir döngü dört vuruşluk bir ölçü sayılarak şarkının saniyedeki döngü sayısından okunur; çünkü şarkının kendi ölçüsü, render motorunun döndürdüğü bilgiler arasında değildir.

MIDI dosyasında kimlik bilgisi için yer yoktur; bu yüzden dosyadaki bir metin olayı beyanı taşır ve dışa aktarma paneli bunu söyler. Panel, dışa aktarmadan önce bunların tümünü açıklar. Her dışa aktarmadan sonra düzenleyici kaydedilen dosyayı geri okur ve yalnızca bu okumanın bulduklarını bildirir.

Content Credentials'ın genel olarak neleri kaydettiği için bkz. [Dosya dışa aktar](/info/exporting.html#content-credentials-c2pa).
