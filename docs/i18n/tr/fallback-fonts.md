# Yedek yazı tipleri

Bir tasarım sisteminin yazı tipleri çoğu zaman dünyadaki yazı sistemlerinin yalnızca bir kısmını kapsar. Lolly Demo başlıkları Outfit, metni SUSE ile dizer ve bu yazı tiplerinin hiçbirinde Kiril, Yunan, Arap, İbrani, Devanagari, Bengal, Tay, Çin, Japon veya Kore harfleri yoktur. Bir belge, tasarım sisteminin yazı tiplerinin çizemediği harfler içerdiğinde Lolly bu harfleri açık bir Noto yazı tipiyle çizer; böylece dışa aktarma, sözcükleri bir görsele çevirmek yerine onları vektör anahatları olarak korur.

Tasarım sisteminin yazı tipleri her zaman önce gelir, tasarım sisteminin listelediği sırayla. Outfit'te Vietnam harfleri yoktur; bu yüzden Vietnamca bir başlık bunları, Lolly Demo'nun listesindeki sonraki yazı tipi olan SUSE'den alır. Bir yedek yazı tipi yalnızca bu yazı tiplerinin hiçbirinin çizemediği karakterleri çizer; böylece bir marka yazı tipi, başka bir yazı sistemindeki bir sözcüğün içinde bile sahip olduğu her harfi, rakamı ve işareti korur. Bir Çince karakteri olan bir marka yazı tipi o karakteri de korur.

## Pakete neler dahil

On beş yazı tipi; hepsi sabitlenmiş bir commit'teki Google Fonts'tan gelir ve hepsi SIL Open Font License 1.1 altındadır. Her dosya indirme boyutuyla gösterilir.

| Yazı sistemi | Yazı tipi | Sürüm | İndirme |
|---|---|---|---|
| Arapça, Urduca ve Farsça harfler dahil | Noto Sans Arabic | 2.012 | 206 KB |
| İbranice | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (Hintçe, Marathi, Nepalce) | Noto Sans Devanagari | 2.007 | 147 KB |
| Bengalce | Noto Sans Bengali | 3.011 | 136 KB |
| Tayca | Noto Sans Thai | 2.002 | 61 KB |
| Kiril | Noto Sans, Kiril harfleri | 2.015 | 112 KB, italik 129 KB |
| Yunanca | Noto Sans, Yunan harfleri | 2.015 | 75 KB, italik 81 KB |
| Latin, Vietnamca ve diğer aksanlı harfler dahil | Noto Sans, Latin harfleri | 2.015 | 309 KB, italik 342 KB |
| Basitleştirilmiş Çince, GB 2312 karakterleri | Noto Sans SC | 2.004 | 1.9 MB |
| Geleneksel Çince, Big5 karakterleri | Noto Sans TC | 2.004 | 3.6 MB |
| Japonca, Shift_JIS karakterleri | Noto Sans JP | 2.004 | 2.1 MB |
| Korece, her Hangul hecesi ve KS X 1001 karakterleri | Noto Sans KR | 2.004 | 2.4 MB |

Her yazı tipinin ağırlık ekseni bütün olarak korunur; bu yüzden bir tasarımın istediği her ağırlık yine çizilir ve kalın bir Çince, Japonca veya Korece başlık kalın olur. Noto Sans yazı tiplerinin genişlik ekseni normalde sabitlenmiştir, bu da her dosyayı yarıya indirir; Çince, Japonca ve Korece yazı tiplerinin genişlik ekseni yoktur. Noto Sans yazı sistemine göre bölünmüştür; bu yüzden bir Kiril sözcük yalnızca Kiril harflerini indirir. Anahatlar, hiç değiştirilmemiş özgün anahatlardır.

Yazı tipleri tek bir paylaşılan klasörde durur, `community/fallback-fonts`; emoji setleri nasıl paylaşılıyorsa aynı şekilde her tasarım sistemine `/catalog/packs/fallback-fonts/` adresinden sunulur. `scripts/import-fallback-fonts.ts`, dosyaları `scripts/data/fallback-fonts.json` içinde sabitlenmiş özgün yazı tiplerinden üretir, her özgün dosyayı kayıtlı SHA-256 değerine karşı denetler ve lisans metinlerini yazı tiplerinin yanına yazar.

## Çince, Japonca ve Korece

Bütün bir Çince, Japonca veya Korece yazı tipi 9.6 MB ile 17.8 MB arasındadır; bu yüzden bu yazı tiplerinin her biri okurlarının her gün kullandığı ulusal karakter kümesine, ayrıca akan metnin noktalama işaretlerine, kanasına, tam genişlikli biçimlerine ve simgelerine göre kesilir:

- Basitleştirilmiş Çince: GB 2312, yaygın 6,763 hanzi ve simgeleri, toplam 7,522 karakter.
- Geleneksel Çince: Big5, 13,053 hanzi'si ve simgeleri, toplam 13,629 karakter. Hong Kong Supplementary Character Set dahil değildir.
- Japonca: Windows'un ve web'in okuduğu biçimiyle Shift_JIS; yani JIS X 0208 ile 髙 ve 﨑 gibi adların ihtiyaç duyduğu NEC ve IBM eklemeleri, her kana ve yarım genişlikli katakana, toplam 7,432 karakter.
- Korece: 11,172 Hangul hecesinin tamamı ve KS X 1001 ile onun 4,888 hanja'sı, toplam 17,082 karakter.

Latin, Yunan ve Kiril harfleri bu dört yazı tipinin dışında bırakılır, çünkü onları tasarım sisteminin yazı tipleri ve yukarıdaki yazı tipleri çizer. Kümeler Encoding Standard'ın sabitlenmiş bir commit'teki dizin dosyalarından okunur; bu yüzden yeniden derleme aynı dosyaları verir.

Çince, Japonca ve Korece karakterlerin çoğunu paylaşır ama her biri bunların birçoğunu farklı çizer. Aynı 直 karakteri Çincede bir biçimde, Japoncada başka bir biçimde yazılır. Bu yüzden bir metin parçası paylaşılan karakterlerinin hepsini bu yazı tiplerinden birinden alır, asla ikisinden değil, ve Lolly o yazı tipini şu sırayla seçer:

1. Metin parçasının dili; öğesinin veya belgede çevresindeki en yakın öğenin `lang` değerinden. Sertifikanın Language ayarı gibi bir aracın dil ayarı bunu belirler. Lolly'nin kendi arayüzünün dili ve tasarım sisteminin dili sayılmaz; bu yüzden bir belge herkes için aynı dışa aktarılır.
2. Metin parçasının yazı sistemi: kana Japonca, Hangul Korece demektir. Parçanın kendisinde ikisi de yoksa bütün belge okunur; bu yüzden Japonca bir belgede yalnızca kanji'den oluşan bir başlık Japonca çizilir. Hem kana hem Hangul içeren bir belge burada hiçbir şeyi kesinleştirmez.
3. Parçada ya da yoksa belgede yalnızca Geleneksel Çincenin kullandığı 體 veya 說 gibi bir karakter, aynı metin yalnızca Basitleştirilmiş Çincenin kullandığı bir karakter de içermedikçe Geleneksel Çince demektir.
4. Aksi halde Basitleştirilmiş Çince.

Seçilen yazı tipinde olmayan bir karakter asla diğer üç yazı tipinden birinden alınmaz. Aşağıda anlatıldığı gibi görsel olarak kalır. Seçilen yazı tipinde olmayan kana veya Hangul, örneğin Japonca işaretlenmiş bir satırdaki Korece sözcükler, yine Japonca veya Korece yazı tipinden gelebilir; ama yalnızca o yazı tipi satırın hiçbir paylaşılan karakterini çizmeyecekse.

Sayfada, bu dillerden ikisini içeren bir tuval her iki yazı tipini de listeler ve tarayıcı paylaşılan karakterleri ilkiyle çizer. Dışa aktarma her metin parçasını kendi yazı tipiyle çizer.

## Bir yazı tipi ne zaman iner

Bir belge, tasarım sisteminin hiçbir yazı tipinin çizemediği bir karakter içermedikçe hiçbir şey inmez. İngilizce bir belge veya tasarım sisteminin kapsadığı herhangi bir dildeki belge asla yedek yazı tipi indirmez. İngilizce bir satırdaki ★ veya ※ gibi bir simge asla Çince, Japonca veya Korece bir yazı tipi indirmez.

Bir belge bir yazı tipine ilk kez ihtiyaç duyduğunda Lolly o tek yazı tipini, o tek yazı sistemi için indirir ve cihazında tutar. Japonca bir belge yalnızca Japonca yazı tipini, 2.1 MB, Geleneksel Çince bir belge de 3.6 MB'lık Geleneksel yazı tipini indirir. O andan sonra yazı sistemi çevrimdışı çizilir ve katalog temizlendiğinde yazı tipi kalır. Yazı tipi kataloğun kendi dosyalarının yanında tutulur, asla yüklediğin yazı tiplerinin arasında değil; bu yüzden markanın yazı tipi listesinde görünmez.

Komut satırı, terminal uygulaması ve MCP sunucusu aynı dosyaları diskten okur; bu yüzden indirme gerekmez.

## Sayfada ve dışa aktarmada

Sayfa, dışa aktarmayla aynı yedek yazı tipini kullanır. Bu olmasaydı bir tarayıcı bu harfleri bir sistem yazı tipiyle çizerdi, dışa aktarma ise Noto kullanırdı ve bunları içeren bir satırın genişliği ikisi arasında değişirdi. Lolly yedek yazı tipini yalnızca o tuvalde, tasarım sisteminin yazı tipi listesinin sonuna, tasarım sisteminin kendi yazı tiplerinden sonra ve herhangi bir sistem yazı tipinden önce ekler. Tasarım sisteminin kapsadığı bir tuval yazı tipi listesini tamamen eskisi gibi korur.

Bir PDF'te, hangi metin ayarını seçersen seç sözcükler yedek yazı tipiyle çizilmiş anahatlara dönüşür; çünkü canlı PDF metni, gömülü yazı tipinde olmayan bir yazı sistemini taşıyamaz. SVG, EMF, EPS, DXF ve WMF'te metin anahatlara dönüştürüldüğünde anahatlara dönüşürler; metin canlı bırakıldığında onları eskisi gibi okuyucunun kendi yazı tipleri çizer. Bir yedek yazı tipi bir dışa aktarmanın bir kısmını çizdiğinde dışa aktarma paneli şuna benzer bir not gösterir:

> Japonca metin Noto Sans JP ile çizildi, çünkü bu tasarım sisteminin yazı tiplerinde bu harfler yok.

Komut satırı aynı cümleyi bir not olarak yazdırır.

## Görsel olarak kalanlar

Dört ulusal kümenin dışındaki bir karakter için yedek yazı tipi yoktur. 𠮷 gibi nadir karakterler, Hong Kong için eklenen ek kümedeki karakterler ve Tamil, Etiyopya veya Süryani gibi yedek yazı tipi olmayan yazı sistemleri aynı şekilde ele alınır. Bir PDF'te birini içeren satır 300 dpi'lık bir görsel olarak girer ve dışa aktarma paneli yazı sistemlerini listeler. Bir SVG'de metin parçası canlı metin olarak kalır ve onu okuyucunun kendi yazı tipleri çizer.

## Lisanslar ve atıflar

Her yedek yazı tipi SIL Open Font License 1.1 altındadır ve her katalog girdisi bu lisansı lisans metninin bir özetiyle (hash) kaydeder; böylece [Yaratıcı haklar ve atıflar](/info/creative-rights.html) içindeki hak kuralları lisansı diğer her yazı tipininki gibi okur. Lisans metinleri yazı tiplerinin yanında durur. Noto Sans dosyaları bir Reserved Font Name bildirmez. Çince, Japonca ve Korece yazı tipleri Adobe'nindir ve Source adını saklı tutar; kesilmiş dosyalar bu adı kullanmayan Noto adlarını korur.

Lisans, koşullarının bu yazı tipleriyle yapılmış belgelere uygulanmadığını söyler. Bir dışa aktarma, tasarım sisteminin kendi yazı tiplerinde olduğu gibi yalnızca kullandığı harflerin çizilmiş anahatlarını içerir ve Lolly bir yedek yazı tipi için hiçbir yazı tipi programı, hiçbir atıf satırı ve hiçbir yeni Content Credentials girdisi eklemez.
