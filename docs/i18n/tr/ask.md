# Ask Lolly

Bir soru yaz; Ask Lolly, bu kılavuzların onu kapsayan bölümüyle, kelimesi kelimesine, geldiği sayfa belirtilerek ve doğrudan o bölüme giden bir **Open in docs** bağlantısıyla yanıtlar. Hiçbir şey üretilmez: yanıt cihazında alınır, alıntılanır ve kaynağı belirtilir.

Alıntılanan bölümün altında, aynı soruyla eşleşen uygulama içi yerler durur: bir araç, bir yardımcı araç, kayıtlı bir proje, bir katalog varlığı, bir ayar veya uygulamanın bir sayfası. Her satır yalnızca gezinir. Bir yanıttaki hiçbir şey bir ayarı değiştirmez, bir dosya açmaz veya senin adına işlem yapmaz; [Search](/info/search.html) de aynı kuralı izler.

## Soru sorma

Görünümün altındaki soru alanına yaz ve Enter'a bas. İki karakterden kısa her şey yok sayılır. Yanıtlar alanın üstünde, en yenisi sonda olacak şekilde istiflenir ve sormaya devam edebilirsin.

![Ask Lolly, açık ve boş: görünümün altındaki soru alanı ve yanıtların belgelerden geldiğini belirten not](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

Her soru kendi başına yanıtlanır: önceki sorular bağlam taşımaz, bu yüzden dışa aktarma hakkında bir sorudan sonra gelen "what about PDF?" yalnızca PDF hakkında bir soru olarak okunur. Her seferinde sorunun tamamını sor.

Sorunun ilk sözcüğü yanıtın neyle başlayacağına karar verir:

| Şununla başlarsan | Ne öne çıkar |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | eşleşen uygulama içi yerler |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | eşleşen araçlar |
| başka her şey - *how do I* ve *what is* dahil | varsayılan olan belgeleme bölümü |

Her iki yarı da her zaman alınır; bu yüzden yanlış okunmuş bir soru yanıtın yarısını kaybetmek yerine yanıtı yeniden sıralar.

Eşleştirme yaygın soru sözcüklerini (*how*, *do*, *I*, *the*, *my*) atar ve bir bölümü kalan sözcüklerinden kaçını kapsadığına, sonra nerede eşleştiklerine göre sıralar: bir başlık, gövde metninden daha çok sayılır. Eşleştirme alt dize ile yapılır, büyük/küçük harf ve aksanlar katlanır; bu yüzden bir yazım hatası düzeltilmez. Hiçbir şey eşleşmediğinde Ask bunu söyler ve bir yanıt uydurmak yerine belgeleme dizinine yönlendirir.

**Better matching** isteğe bağlıdır. İlk yanıtından sonra Ask, bir soruyu aynı şey için farklı sözcükler kullanan bir kılavuzla eşleştirmeye yardımcı olan küçük bir eşleştirme modelini, indirme boyutuyla birlikte sunabilir. Yalnızca sen kabul ettiğinde iner, bu cihazda çalışır ve yalnızca hangi bölümlerin önce sıralanacağını değiştirir: yanıt yine belgelerin kendi sözcükleridir. Ayrıca **Ask matching model** olarak listelendiği **Settings → Preferences → Available offline** altından da indirebilirsin ([Available offline](/info/dashboard.html#available-offline)).

## Neler geri gelir

Bir yanıt kartı sabit bir sırayla derlenir:

1. **Bölümün kendisi**, belgeleme kaynağından render edilir - paragraflar, listeler, tablolar, kod ve alıntılar; uygulama içi ve `/info` bağlantıları canlıdır. Uzun bir bölüm, yerinde açan bir **Show more** ile sınırlanır. Görseller atlanır ve başka bir siteye giden bağlantı bir çapa yerine düz metin olarak render edilir.
2. **Kaynak gösterimi** - *Sayfa › Başlık* - ve tam o bölüme giden **Open in docs** bağlantısı.
3. **More in the docs** - eşleşen en fazla dört başka bölüm, bağlantı olarak.
4. **Uygulama içi satırlar**, Search'ün kullandığı aynı grup başlıkları altında.

Tam metin, her belgeleme sayfasının `/info/<slug>.md` adresinde yayımladığı düz markdown ikizinden gelir ve bu ikizler yalnızca İngilizcedir. Başka bir dilde - ve markdown'dan üretilmeyen birkaç sayfada - yanıt, tüm bölüm yerine arama dizininde tutulan kısa özete geri döner. Kaynak gösterimi ve **Open in docs** bağlantısı her iki durumda da vardır ve kendi dilindeki sayfaya işaret eder.

## Nerede yaşar

Rota `#/ask`'tır. Utilities ızgarasında sekmesi veya karosu yoktur; girişler arama çubuğu ve adresin kendisidir.

- <!--i:search--> **Aramadan.** Her sonuç paneli en altta, diğer grupların bulduğu somut sonuçların altında bir **Ask Lolly: *your query*** satırı taşır. Soruyu `#/ask?q=…` olarak devreder ve görünüm sorgulamayı varışta bir kez yapar. Devredilen sözcükler küçük harfle ve noktalama atılmış olarak gelir; gerekirse soru alanında düzelt.
- <!--i:link--> **Bir bağlantıdan.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png`, görünümü o soru zaten sorulmuş olarak açar. Hash yalnızca başlangıç tohumudur: sonradan yazdığın sorular yerinde yanıtlanır ve adresi asla yeniden yazmaz.

Soru alanı Enter'ı aldığı için arama çubuğu bu görünümde kenara çekilir ve geri hapı seni geldiğin yere döndürür.

Ekrandaki yanıtlar bu oturum boyunca kalır: başka yere gidip döndüğünde hâlâ oradadır ve bir yenileme onları temizler. Depolamaya hiçbir şey yazılmaz, bu yüzden yönetilecek bir geçmiş yoktur.

## Çevrimdışı

Yanıtlar, belgeleme sitesinin zaten yayımladığı iki durağan dosyadan derlenir: dil başına arama dizini ve sayfanın markdown ikizi. İkisi de adla getirilir; bu yüzden Ask, önbelleğe alındıktan sonra bağlantı olmadan çalışmaya devam eder. Kılavuzları uygulamada okumak onları ilerledikçe önbelleğe alır ve [Available offline](/info/dashboard.html#available-offline) altındaki **Guides & docs** ekran görüntüleri dahil tüm siteyi tek indirmede alır.

Onlar olmadan bir yanıtın belgeleme yarısı hata vermeden görünmez. Uygulama içi satırlar yine görünür, çünkü onlar cihazdaki veriyle eşleştirilir.

## Gizlilik

Sorun cihazından hiç çıkmaz. Eşleştirme, adla getirilen dosyalara karşı yerel çalışır; bu yüzden yazdığın hiçbir isteğin parçası değildir; onu gören bir sunucu, bağlı olduğu bir hesap ve yeniledikten sonra bir kaydı yoktur. Uygulamanın getirdiği veya gönderdiği her şeyin tam listesi için [Privacy Policy](/info/privacy.html) sayfasına bak.

---

**İlgili:** soruları devreden çubuk için [Search](/info/search.html). Uygulamanın geri kalanı için [Using Lolly](/info/using.html). Önce belgelemeyi çevrimdışı almak için [Settings](/info/dashboard.html#available-offline).
