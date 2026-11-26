# Yedek yazı tipleri

Bir tasarım sisteminin yazı tipleri bir harfi çizemediğinde Lolly, harfi açık bir Noto yazı tipiyle çizer; böylece dışa aktarma harfi görsel yerine vektör dış çizgi olarak korur. Lolly Demo'nun yazı tipleri, başlıklar için Outfit ve metin için SUSE, Kiril, Yunan, Arap, İbrani, Devanagari, Bengal, Tay, Çin, Japon veya Kore harflerini içermez.

Tasarım sisteminin yazı tipleri, listelendikleri sırayla her zaman önce gelir. Outfit Vietnamca harfleri içermez; bu yüzden Vietnamca bir başlık bunları Lolly Demo'nun listesindeki sonraki yazı tipi olan SUSE'den alır. Yedek yazı tipi, yalnızca bu yazı tiplerinin hiçbirinin çizemediği karakterleri çizer. Bir marka yazı tipi, başka bir yazı sistemindeki sözcüğün içinde bile, Çin karakterleri dahil sahip olduğu her harfi, rakamı ve işareti korur.

<!--i:eti-package-->
## Pakette neler var

Tümü Google Fonts'tan sabitlenmiş bir commit'ten alınan on beş yazı tipi. Her dosya indirme boyutuyla gösterilir.

| Yazı sistemi | Yazı tipi | Sürüm | İndirme |
|---|---|---|---|
| Urduca ve Farsça harfler dahil Arap | Noto Sans Arabic | 2.012 | 211 KB |
| İbrani | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (Hintçe, Marathice, Nepalce) | Noto Sans Devanagari | 2.007 | 151 KB |
| Bengal | Noto Sans Bengali | 3.011 | 139 KB |
| Tay | Noto Sans Thai | 2.002 | 62 KB |
| Kiril | Noto Sans, Kiril harfleri | 2.015 | 115 KB, italik 132 KB |
| Yunan | Noto Sans, Yunan harfleri | 2.015 | 77 KB, italik 83 KB |
| Vietnamca ve diğer aksanlı harfler dahil Latin | Noto Sans, Latin harfleri | 2.015 | 316 KB, italik 350 KB |
| Basitleştirilmiş Çince, GB 2312 karakterleri | Noto Sans SC | 2.004 | 2,0 MB |
| Geleneksel Çince, Big5 karakterleri | Noto Sans TC | 2.004 | 3,8 MB |
| Japonca, Shift_JIS karakterleri | Noto Sans JP | 2.004 | 2,2 MB |
| Korece, her Hangul hecesi ve KS X 1001 karakterleri | Noto Sans KR | 2.004 | 2,5 MB |

Her yazı tipi kalınlık eksenindeki tüm kalınlıkları korur; böylece kalın bir Çince, Japonca veya Korece başlık kalın görünür. Noto Sans yazı tiplerinin genişlik ekseni normalde sabitlenmiştir; bu, her dosyanın boyutunu yarıya indirir. Çince, Japonca ve Korece yazı tiplerinde genişlik ekseni yoktur. Noto Sans yazı sistemine göre bölünmüştür; bu yüzden Kiril alfabesindeki bir sözcük yalnızca Kiril harflerini indirir. Dış çizgiler özgün kaynaktakiyle aynıdır.

::: details Yazı tiplerinin yeri ve nasıl derlendikleri
Yazı tipleri tek bir ortak klasörde, `community/fallback-fonts` içinde bulunur ve emoji setleri gibi `/catalog/packs/fallback-fonts/` yolundan her tasarım sistemine sunulur. `scripts/import-fallback-fonts.ts`, dosyaları `scripts/data/fallback-fonts.json` içinde sabitlenmiş kaynak yazı tiplerinden derler, her kaynak dosyayı kayıtlı SHA-256 özetiyle denetler ve lisans metinlerini yazı tiplerinin yanına yazar.
:::

<!--i:eti-globe-->
## Çince, Japonca ve Korece

Kırpılmamış bir Çince, Japonca veya Korece yazı tipi 9,6 MB ile 17,8 MB arasındadır. Her biri kendi ulusal karakter kümesiyle ve düz metindeki noktalama işaretleri, kana, tam genişlikli biçimler ve sembollerle sınırlanır:

- Basitleştirilmiş Çince: GB 2312, yaygın 6.763 hanzi ve sembolleri, toplam 7.522 karakter.
- Geleneksel Çince: Big5, 13.053 hanzi ve sembolleri, toplam 13.629 karakter. Hong Kong Ek Karakter Kümesi dahil değildir.
- Japonca: Windows ve web'in okuduğu biçimiyle Shift_JIS, yani 髙 ve 﨑 gibi adların ihtiyaç duyduğu NEC ve IBM ekleriyle JIS X 0208, tüm kana ve yarım genişlikli katakana, toplam 7.432 karakter.
- Korece: 11.172 Hangul hecesinin tümü ve 4.888 hanja içeren KS X 1001, toplam 17.082 karakter.

Bu dört yazı tipi, tasarım sisteminin yazı tiplerinin ve yukarıdaki yazı tiplerinin çizdiği Latin, Yunan ve Kiril harflerini dışarıda bırakır. Kümeler, Encoding Standard'ın sabitlenmiş bir commit'teki dizin dosyalarından gelir; bu yüzden yeniden derleme aynı dosyaları verir.

Çince, Japonca ve Korece karakterlerinin çoğunu paylaşır ama birçoğunu farklı çizer. Örneğin 直, Çincede bir şekilde, Japoncada başka bir şekilde yazılır. Bir metin parçası, ortak karakterlerinin tamamını bu yazı tiplerinden yalnızca birinden alır, asla ikisinden almaz. Lolly yazı tipini şu sırayla seçer:

1. Parçanın dili, kendi öğesinin veya belgede onu çevreleyen en yakın öğenin `lang` değerinden alınır. Sertifikadaki Language gibi bir aracın dil ayarı bunu belirler. Lolly'nin kendi arayüzünün dili ve tasarım sisteminin dili hesaba katılmaz; böylece belge herkes için aynı şekilde dışa aktarılır.
2. Parçanın yazı sistemi: kana Japonca, Hangul Korece anlamına gelir. Parçada ikisi de yoksa Lolly belgeyi okur; böylece Japonca bir belgedeki yalnızca kanji içeren başlık Japonca çizilir. Hem kana hem Hangul içeren bir belge bu adımda bir sonuca varılmasını sağlamaz.
3. Parçada veya yoksa belgede 體 veya 說 gibi yalnızca Geleneksel Çincenin kullandığı bir karakter varsa bu, Geleneksel Çince anlamına gelir; ancak aynı metinde yalnızca Basitleştirilmiş Çincenin kullandığı bir karakter de varsa bu kural geçerli olmaz.
4. Aksi halde Basitleştirilmiş Çince.

Seçilen yazı tipinde olmayan bir karakter diğer üç yazı tipinden asla alınmaz. Görsel olarak kalır. Japonca olarak işaretlenmiş bir satırdaki Korece sözcükler gibi, seçilen yazı tipinde olmayan kana veya Hangul yine de Japonca veya Korece yazı tipinden gelebilir; ancak yalnızca o yazı tipi satırın hiçbir ortak karakterini çizmeyecekse.

Sayfada, bu dillerden ikisini içeren bir tuval her iki yazı tipini de listeler ve tarayıcı ortak karakterleri ilk yazı tipiyle çizer. Dışa aktarma her parçayı kendi yazı tipiyle çizer.

<!--i:eti-download-->
## Yazı tipi ne zaman indirilir

Belge, tasarım sistemindeki hiçbir yazı tipinin çizemediği bir karakter içerene kadar hiçbir şey indirilmez. İngilizce bir satırdaki ★ veya ※ gibi bir sembol hiçbir zaman Çince, Japonca veya Korece yazı tipi indirmez.

Bir belge ilk kez yedek yazı tipine ihtiyaç duyduğunda Lolly yalnızca o yazı tipini indirir ve cihazında tutar. Japonca bir belge yalnızca 2,2 MB'lık Japonca yazı tipini, Geleneksel Çince bir belge ise 3,8 MB'lık Geleneksel Çince yazı tipini indirir. Bundan sonra yazı sistemi çevrimdışı çizilir ve katalog temizlendiğinde yazı tipi kalır. Yazı tipi, yüklediğin yazı tiplerinin arasında değil, kataloğun dosyalarıyla birlikte tutulur ve markanın yazı tipi listesinde görünmez.

Komut satırı, terminal uygulaması ve MCP sunucusu aynı dosyaları diskten okur; bu yüzden indirme gerekmez.

<!--i:eti-eye-->
## Sayfada ve dışa aktarmada

Sayfa, dışa aktarmayla aynı yedek yazı tipini kullanır; böylece bu harfleri içeren bir satırın genişliği ikisinde de aynıdır. Lolly yalnızca o tuvalde yedek yazı tipini tasarım sisteminin kendi yazı tiplerinden sonra ve tüm sistem yazı tiplerinden önce ekler. Stillerinde veya öğelerinde kendi yazı tipi listesini belirleyen bir araç da yedek yazı tipini aynı konumda alır. Tasarım sisteminin kapsadığı bir tuvalin yazı tipi listesi değişmez.

Yazı tipi listesi `system-ui` veya Helvetica gibi bir sistem yazı tipiyle başlıyorsa sayfa listeyi olduğu gibi bırakır; çünkü dışa aktarma o metni tasarım sisteminin yazı tipleriyle çizerken sayfa böyle yapmaz.

PDF'te, metin ayarı ne olursa olsun sözcükler yedek yazı tipinde dış çizgilere dönüşür; çünkü canlı PDF metni, gömülü yazı tipinde olmayan bir yazı sistemini taşıyamaz. SVG, EMF, EPS, DXF ve WMF'te, metin dış çizgilere dönüştürüldüğünde onlar da dış çizgilere dönüşür. Metin canlı tutulduğunda bunları okuyucunun kendi yazı tipleri çizer. Dışa aktarmanın bir bölümünü yedek yazı tipi çizdiğinde, dışa aktarma paneli şöyle bir not gösterir:

> Japonca metin Noto Sans JP ile çizilir; çünkü bu tasarım sisteminin yazı tipleri o harfleri içermiyor.

Komut satırı aynı cümleyi not olarak yazdırır.

<!--i:eti-image-->
## Neler görsel olarak kalır

𠮷 veya bir Hong Kong ek karakteri gibi dört ulusal kümenin dışındaki bir karakterin yedek yazı tipi yoktur. 𠮷 gibi nadir karakterler, Hong Kong için ek kümeyle eklenen karakterler ve Tamil, Etiyopya veya Süryani gibi yedek yazı tipi olmayan yazı sistemlerinin tümü aynı şekilde işlenir. Tamil, Etiyopya veya Süryani gibi bir yazı sisteminin de yedek yazı tipi yoktur. PDF'te böyle metin içeren satır 300 dpi görsel olarak eklenir ve dışa aktarma paneli yazı sistemlerini listeler. SVG'de metin parçası, okuyucunun kendi yazı tiplerinin çizdiği canlı metin olarak kalır.

::: details EPS, WMF ve EMF dışa aktarmalarında
**Outline fonts** açık olan EPS, WMF veya EMF'te başvurulacak canlı metin yoktur; bu yüzden metin parçası burada da 300 dpi görsel olarak eklenir. Görsel, metnin rengini yalnızca harflerin olduğu yerde boyar; böylece arka plan görünür. Dışa aktarma paneli yazı sistemlerini listeler. Görsel yalnızca dik çizilir; bu yüzden döndürülmüş veya eğilmiş bir metin parçası, parçayı alıntılayan bir mesajla dışa aktarmayı durdurur. WMF veya EMF'te görsel, maske ve boyamadan oluşan bir bitmap işlem çiftidir. Microsoft Office ve LibreOffice bunları amaçlandığı gibi çizer. Inkscape gibi bunları yok sayan bir uygulama, sözcükleri beyaz bir kutu üzerinde gösterir.

**Outline fonts** kapalı olan bir EMF, böyle bir parçayı okuyucunun kendi yazı tiplerinin çizdiği canlı metin olarak tutar. Harf aralığı olan metin gibi, canlı EMF metninin taşıyamadığı parçalar istisnadır. Lolly o parçayı dış çizgilere dönüştürür; bu yüzden hiçbir yazı tipinin çizemediği bir parça orada da görsel olarak eklenir.
:::

::: warning DXF dışa aktarması, hiçbir yazı tipinin çizemediği metinde durur
DXF, dış çizgilere ihtiyaç duyan kesim makinelerine ve CAD yazılımlarına gider; bu yüzden hiçbir yazı tipinin çizemediği bir metin parçası DXF dışa aktarmasını durdurur. Mesaj parçayı alıntılar ve yazı sistemini belirtir. O harfleri içeren bir yazı tipi ekle veya SVG ya da PDF dışa aktar.
:::

<!--i:eti-checklist-->
## Dışa aktarmadan önceki denetim

Lolly Design'ın **Before you export** kartı ve `lolly check` komutunun `render` denetimleri, hiçbir yazı tipinin çizemediği metinleri bildirir. Yedek yazı tiplerini, dışa aktarmanın yaptığı gibi, aynı yazı tipi bazındaki karakter listelerinden hesaba katarlar; bu yüzden yedek yazı tipinin çizdiği metin bildirilmez. Tamil gibi yedek yazı tipi olmayan bir yazı sistemi ve ulusal kümelerin dışındaki bir Çince, Japonca veya Korece karakter yine de bildirilir; çünkü dışa aktarma bunları görsel veya canlı metin olarak çizer ve DXF dışa aktarması bunlarda durur. Denetim bu listeleri katalogdan okur ve hiçbir yazı tipi indirmez.

<!--i:eti-stamp-->
## Lisanslar ve kaynak belirtimleri

Her yedek yazı tipi SIL Open Font License 1.1 kapsamındadır. Her katalog girdisi bu lisansı, lisans metninin özetiyle birlikte kaydeder; böylece [Yaratıcı hakları ve kaynak belirtimleri](/info/creative-rights.html) içindeki hak kuralları lisansı diğer yazı tiplerinin lisansları gibi okur. Lisans metinleri yazı tiplerinin yanında bulunur. Noto Sans dosyaları hiçbir Reserved Font Name belirtmez. Çince, Japonca ve Korece yazı tipleri Adobe'ye aittir ve Source adını saklı tutar. Kırpılmış dosyalar, bu adı kullanmayan Noto adlarını korur.

Lisans, şartlarının bu yazı tipleriyle oluşturulan belgelere uygulanmadığını söyler. Dışa aktarılan dosya, tasarım sisteminin kendi yazı tiplerinde olduğu gibi, yalnızca kullandığı harflerin dış çizgilerini içerir. Lolly, yedek yazı tipi için yazı tipi programı, kaynak belirtme satırı veya yeni bir içerik kimlik bilgisi kaydı eklemez.
