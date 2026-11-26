# Ask Lolly

Ask Lolly, bir soruyu bu kılavuzların eşleşen bölümünü kelimesi kelimesine alıntılayarak yanıtlar; sayfasını kaynak gösterir ve o bölüme bir **Open in docs** bağlantısı verir. Hiçbir şey üretilmez: yanıt cihazında bulunur ve alıntılanır.

Alıntılanan bölümün altında uygulamada soruyla eşleşen yerler vardır: bir araç, yardımcı araç, kayıtlı proje, katalog varlığı, ayar veya uygulamanın bir sayfası. Her satır yalnızca gezinme sağlar. Bir yanıttaki hiçbir şey ayar değiştirmez, dosya açmaz veya senin adına işlem yapmaz; [Lolly Search](/info/search.html) ile aynı kural geçerlidir.

<!--i:eti-chat-->
## Soru sorma

Görünümün altındaki soru alanına yaz ve Enter tuşuna bas. İki karakterden kısa her şey yok sayılır. Yanıtlar alanın üzerinde birikir; en yenisi en sondadır.

![Ask Lolly açık ve boş: görünümün altında soru alanı ve yanıtların belgelerden geldiğini belirten not](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

::: note Her soru bağımsızdır
Önceki sorular sonraki sorulara bağlam taşımaz; bu yüzden dışa aktarmayla ilgili bir sorudan sonra "peki ya PDF?" yalnızca PDF hakkında bir soru olarak okunur. Her seferinde sorunun tamamını sor.
:::

Sorunun ilk sözcüğü, yanıtta neyin önce geleceğini belirler:

| Şununla başlarsan | Önce gelen |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | uygulamada eşleşen yerler |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | eşleşen araçlar |
| *how do I* ve *what is* dahil diğer her şey | varsayılan olan belge bölümü |

Her iki yarı da her zaman getirilir; bu yüzden yanlış yorumlanan bir soru yalnızca yanıtın sırasını değiştirir.

Eşleştirme, yaygın soru sözcüklerini (*how*, *do*, *I*, *the*, *my*) eler. Bir bölümü diğer sözcüklerinden kaçını kapsadığına, sonra da nerede eşleştiklerine göre sıralar: başlık, gövde metninden daha fazla ağırlık taşır. Eşleştirme büyük küçük harf ve aksan farklarını yok sayarak alt dizeye göre yapılır; bu yüzden yazım hatası düzeltilmez. Hiçbir şey eşleşmediğinde Ask bunu söyler ve belge dizinine yönlendirir.

**Better matching** isteğe bağlıdır. İlk yanıtından sonra Ask, indirme boyutuyla birlikte küçük bir eşleştirme modeli önerebilir. Model, bir soruyu aynı şey için farklı sözcükler kullanan bir kılavuzla eşleştirir. Yalnızca kabul ettiğinde indirilir, bu cihazda çalışır ve yalnızca hangi bölümlerin önce sıralandığını değiştirir. Yanıt yine belgelerin kendi sözleridir. Modeli **Settings → Preferences → Available offline** altında **Ask matching model** olarak da indirebilirsin ([Çevrimdışı kullanılabilir](/info/dashboard.html#available-offline)).

<!--i:eti-clipboard-->
## Yanıtta neler gelir

Yanıt kartının sırası sabittir:

1. **Bölümün kendisi**, belge kaynağından render edilir: paragraflar, listeler, tablolar, kod ve alıntılar; uygulama içi ve `/info` bağlantıları etkindir. Uzun bir bölüm, kalanını aynı yerde açan **Show more** ile biter. Görseller çıkarılır ve başka bir siteye bağlantı düz metin olarak görünür.
2. **Kaynak** - *Sayfa › Başlık* - ve tam o bölüme giden **Open in docs** bağlantısı.
3. **More in the docs** - eşleşen en fazla dört başka bölüm, bağlantı olarak.
4. **Uygulama içi satırlar**, Search'ün kullandığı grup başlıklarının altında.

Tam metin, her belge sayfasının `/info/<slug>.md` adresinde yayımladığı Markdown eşinden gelir. Bu eşler yalnızca İngilizcedir. Başka bir dilde ve Markdown'dan oluşturulmamış az sayıdaki sayfada yanıt, bunun yerine arama dizinindeki kısa alıntıyı gösterir. Kaynak ve **Open in docs** bağlantısı yine senin dilindeki sayfayı gösterir.

<!--i:eti-map-pin-->
## Nerede bulunur

Rota `#/ask` şeklindedir. Utilities ızgarasında sekmesi veya kartı yoktur. Görünüme arama çubuğundan veya adresinden ulaşırsın.

- <!--i:search--> **Aramadan.** Her sonuç paneli, diğer grupların sonuçlarının altında bir **Ask Lolly: *sorgun*** satırıyla biter. Satır `#/ask?q=…` adresini açar ve görünüm açıldığında soruyu bir kez sorar. Sözcükler küçük harfle ve noktalama olmadan gelir; bu yüzden gerekirse soru alanında düzelt.
- <!--i:link--> **Bir bağlantıdan.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png`, görünümü o soru zaten sorulmuş olarak açar. URL'nin hash bölümü yalnızca ilk soruyu belirler. Sonradan yazdığın sorular aynı yerde yanıtlanır ve adresi asla değiştirmez.

Soru alanı Enter tuşunu kullandığı için bu görünümde arama çubuğu gizlenir. Geri hapı seni geldiğin yere döndürür.

Yanıtlar bu oturum boyunca kalır: ayrılıp geri gelirsen hâlâ oradadırlar, sayfayı yeniden yüklemek onları temizler. Depolamaya hiçbir şey yazılmaz; bu yüzden yönetilecek geçmiş yoktur.

<!--i:eti-download-->
## Çevrimdışı

Yanıtlar, belge sitesinin yayımladığı iki statik dosyadan gelir: dile özel arama dizini ve sayfanın Markdown eşi. İkisi de adlarıyla getirilir; bu yüzden önbelleğe alındıktan sonra Ask bağlantı olmadan çalışır. Kılavuzları uygulamada okumak onları önbelleğe alır. [Çevrimdışı kullanılabilir](/info/dashboard.html#available-offline) altındaki **Guides & docs**, ekran görüntüleri dahil tüm siteyi tek seferde indirir.

Bu dosyalar olmadan yanıtın belge yarısı görünmez ve hata gösterilmez. Uygulama içi satırlar yine görünür; çünkü zaten cihazda bulunan verilerle eşleşirler.

<!--i:eti-lock-->
## Gizlilik

Sorduğun soru cihazdan asla ayrılmaz. Eşleştirme, adlarıyla getirilen dosyalar üzerinde yerel olarak çalışır; bu yüzden yazdıkların hiçbir isteğin parçası değildir. Hiçbir sunucu sorduğun soruyu görmez, hiçbir hesap onu tutmaz ve sayfayı yeniden yükledikten sonra hiçbir kayıt kalmaz. [Gizlilik Politikası](/info/privacy.html), uygulamanın getirdiği veya gönderdiği her şeyi listeler.

---

**İlgili:** Soruları aktaran çubuk için [Lolly Search](/info/search.html). Uygulamanın geri kalanı için [Lolly'yi kullanma](/info/using.html). Önce belgeleri çevrimdışına almak için [Lolly ayarları](/info/dashboard.html#available-offline).
